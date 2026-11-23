#!/usr/bin/env node
/**
 * Importador de WoW MountDex.
 *
 *   node scripts/importer/index.mjs                 # dry-run: descarga, normaliza, genera informe (no escribe en BD)
 *   node scripts/importer/index.mjs --write-json    # además escribe frontend/public/data/catalog.json
 *   node scripts/importer/index.mjs --apply         # además escribe en Supabase (requiere service_role)
 *   Opciones: --offline (solo caché), --skip-icons, --ttl 24
 *
 * Variables (en .env.importer en la raíz o en el entorno; NUNCA en el frontend):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY          (solo para --apply)
 *   BLIZZARD_CLIENT_ID, BLIZZARD_CLIENT_SECRET         (opcional: renders oficiales)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHttp } from './lib/http.mjs';
import { loadWago } from './adapters/wago.mjs';
import { loadRarity, loadSimpleArmory } from './adapters/community.mjs';
import { loadBlizzardRenders, resolveWikiPages, verifyIcons } from './adapters/reference.mjs';
import { normalize } from './normalize.mjs';
import { applyToSupabase, createSupabase, writeCatalogJson } from './sinks.mjs';
import { writeReport } from './report.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);

// .env.importer (ignorado por git)
const envFile = resolve(root, '.env.importer');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const log = (...a) => console.log(...a);
const now = new Date().toISOString();
const http = createHttp({ cacheDir: resolve(root, '.cache/importer'), ttlHours: Number(opt('--ttl', 24)), offline: flag('--offline'), log });

async function main() {
  log('1/6 Descargando fuentes');
  const wago = await loadWago(http, log);
  const simpleArmory = await loadSimpleArmory(http, log);
  const rarity = await loadRarity(http, log);

  log('2/6 Referencias e imágenes');
  const names = [...simpleArmory.keys()].map((id) => wago.mounts.find((m) => m.id === id)?.name).filter(Boolean);
  const wikiPages = await resolveWikiPages(http, names, log);
  const icons = [...simpleArmory.values()].map((s) => s.icon).filter(Boolean);
  const iconStatus = flag('--skip-icons') ? new Map() : await verifyIcons(http, icons, log);
  let renders = new Map();
  if (process.env.BLIZZARD_CLIENT_ID && process.env.BLIZZARD_CLIENT_SECRET) {
    renders = await loadBlizzardRenders(http, [...simpleArmory.keys()], {
      clientId: process.env.BLIZZARD_CLIENT_ID, clientSecret: process.env.BLIZZARD_CLIENT_SECRET,
    }, log);
  } else log('  Blizzard API: sin credenciales → sin renders del modelo (se indica en el informe)');

  log('3/6 Normalizando');
  const demoSrc = await import(pathToFileURL(resolve(root, 'database/seeds/demo-catalog.source.mjs')).href);
  const { mounts, locations, report } = normalize({ wago, simpleArmory, rarity, wikiPages, iconStatus, renders, demo: demoSrc.mounts, now });
  report.sources = {
    wago: 'https://wago.tools/db2/{Tabla}/csv', simpleArmory: 'kevinclement/SimpleArmory (MIT)', rarity: 'WowRarity/Rarity (GPL-2.0)',
    wiki: 'warcraft.wiki.gg/api.php', blizzardRenders: renders.size ? 'Game Data API' : 'no configurado',
  };
  report.mode = flag('--apply') ? 'apply' : 'dry-run';

  const expansions = demoSrc.expansions.map((e) => ({
    id: e.id, slug: e.slug, name: e.name, shortName: e.shortName, sortOrder: e.id, releaseDate: e.releaseDate,
    description: null, color: e.color, imageUrl: null,
  }));
  const dataSources = [
    { id: 'wago-tools', name: 'wago.tools (datos del cliente)', url: 'https://wago.tools', kind: 'client-data' },
    { id: 'blizzard-render', name: 'Blizzard render CDN', url: 'https://render.worldofwarcraft.com', kind: 'official' },
    { id: 'blizzard-api', name: 'Blizzard Game Data API', url: 'https://community.developer.battle.net', kind: 'official' },
    { id: 'simple-armory', name: 'Simple Armory (MIT)', url: 'https://github.com/kevinclement/SimpleArmory', kind: 'community' },
    { id: 'rarity', name: 'Rarity addon (GPL-2.0)', url: 'https://github.com/WowRarity/Rarity', kind: 'community' },
    { id: 'warcraft-wiki', name: 'Warcraft Wiki', url: 'https://warcraft.wiki.gg', kind: 'reference' },
    { id: 'wowhead', name: 'Wowhead', url: 'https://www.wowhead.com', kind: 'reference' },
  ];

  if (flag('--write-json') || flag('--apply')) {
    log('4/6 Escribiendo catálogo JSON');
    const bytes = writeCatalogJson(resolve(root, 'frontend/public/data/catalog.json'), { mounts, locations, expansions, sources: dataSources, report, now });
    log(`  catalog.json: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
    writeFileSync(resolve(root, 'frontend/public/data/legacy-ids.json'),
      JSON.stringify({ version: 'demo-1-to-official', mapping: report.legacyMapping }, null, 2) + '\n');
  } else log('4/6 JSON omitido (usa --write-json)');

  if (flag('--apply')) {
    log('5/6 Aplicando en Supabase');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.importer');
    const db = createSupabase(url, key);
    await applyToSupabase(db, { mounts, locations, report, now }, log);
    report.finishedAt = new Date().toISOString();
    await db.insert('import_runs', [{ started_at: now, finished_at: report.finishedAt, dry_run: false, report }]);
  } else log('5/6 Supabase omitido (dry-run)');

  log('6/6 Informe');
  report.finishedAt ??= new Date().toISOString();
  const paths = writeReport(resolve(root, 'reports'), report, now);
  log(`  ${paths.md}`);
  log(JSON.stringify(report.counts, null, 2));
}

main().catch((e) => {
  console.error('Importación fallida:', e.message);
  mkdirSync(resolve(root, 'reports'), { recursive: true });
  writeFileSync(resolve(root, 'reports', 'last-error.txt'), `${new Date().toISOString()}\n${e.stack}\n`);
  process.exit(1);
});
