#!/usr/bin/env node
/**
 * Genera, a partir de database/seeds/demo-catalog.source.mjs:
 *   - frontend/public/data/catalog.json      (catálogo estático para invitados / sin Supabase)
 *   - database/seeds/002_demo_catalog.sql     (seed para Supabase)
 *
 * Uso: node scripts/build-catalog.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = await import(pathToFileURL(resolve(root, 'database/seeds/demo-catalog.source.mjs')).href);

const slugify = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const references = (name) => [
  { label: 'Warcraft Wiki (búsqueda)', url: `https://warcraft.wiki.gg/wiki/Special:Search?search=${encodeURIComponent(name)}` },
  { label: 'Wowhead (búsqueda)', url: `https://www.wowhead.com/search?q=${encodeURIComponent(name)}` },
];

const expansions = src.expansions.map((e) => ({
  id: e.id, slug: e.slug, name: e.name, shortName: e.shortName,
  sortOrder: e.id, releaseDate: e.releaseDate, description: null, color: e.color, imageUrl: null,
}));

const locations = src.locations.map(([id, continent, zone, dungeon, raid]) => ({
  id, continent, region: null, zone, dungeon, raid, mapId: null, coordinates: null,
}));

const mounts = src.mounts.map((m) => ({
  id: m.id,
  blizzardId: null,
  slug: slugify(m.name),
  name: m.name,
  description: null,
  iconUrl: null,
  imageUrl: null,
  expansionId: m.exp,
  mountType: m.type,
  rarity: null,
  difficulty: null,
  availability: m.availability,
  lockout: m.lockout ?? null,
  limitedAttempts: false,
  faction: null,
  methods: m.methods,
  sources: [{
    sourceType: m.methods[0],
    npcName: m.source.npc ?? null,
    bossName: m.source.boss ?? null,
    vendorName: m.source.vendor ?? null,
    achievementName: m.source.achievement ?? null,
    reputationRequirement: null,
    currencyRequirement: null,
    requirements: m.source.requirements ?? null,
    instructions: m.source.instructions ?? null,
    sourceUrl: null,
  }],
  locationIds: m.loc,
  probability: { percentage: null, status: 'unknown', source: null, knownAttempts: null },
  tips: null,
  references: references(m.name),
  verifiedAt: null,
  isDemo: true,
}));

// Validaciones básicas para no publicar datos inconsistentes
const ids = new Set();
for (const m of mounts) {
  if (ids.has(m.id)) throw new Error(`ID duplicado ${m.id}`);
  ids.add(m.id);
  if (!expansions.some((e) => e.id === m.expansionId)) throw new Error(`Expansión inexistente en ${m.name}`);
  for (const l of m.locationIds) if (!locations.some((x) => x.id === l)) throw new Error(`Ubicación ${l} inexistente en ${m.name}`);
  if (m.probability.percentage !== null && !m.probability.source) throw new Error(`Probabilidad sin fuente en ${m.name}`);
}

const catalog = {
  version: 'demo-1',
  isDemo: true,
  generatedAt: new Date().toISOString(),
  notice:
    'Selección reducida de monturas, pendiente de verificación y sin probabilidades de drop. ' +
    'El catálogo completo se carga con el importador oficial de Blizzard.',
  expansions,
  locations,
  mounts,
};

const jsonPath = resolve(root, 'frontend/public/data/catalog.json');
mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, JSON.stringify(catalog, null, 2) + '\n');

// ───────── SQL ─────────
const q = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(q).join(',')}]::text[]`;
const lines = [
  '-- GENERADO por scripts/build-catalog.mjs — no editar a mano.',
  '-- Catálogo de DEMOSTRACIÓN (is_demo = true). Sin probabilidades de drop.',
  'begin;',
];
for (const e of expansions) {
  lines.push(`insert into public.expansions (id, slug, name, short_name, sort_order, release_date, color) values (${[e.id, e.slug, e.name, e.shortName, e.sortOrder, e.releaseDate, e.color].map(q).join(', ')}) on conflict (id) do update set name = excluded.name, short_name = excluded.short_name, sort_order = excluded.sort_order, release_date = excluded.release_date, color = excluded.color;`);
}
for (const l of locations) {
  lines.push(`insert into public.locations (id, continent, region, zone, dungeon, raid) values (${[l.id, l.continent, l.region, l.zone, l.dungeon, l.raid].map(q).join(', ')}) on conflict (id) do update set continent = excluded.continent, zone = excluded.zone, dungeon = excluded.dungeon, raid = excluded.raid;`);
}
for (const m of mounts) {
  lines.push(`insert into public.mounts (id, slug, name, expansion_id, mount_type, availability_status, lockout, acquisition_method, acquisition_methods, probability_status, is_demo) values (${[m.id, m.slug, m.name, m.expansionId, m.mountType, m.availability, m.lockout, m.methods[0]].map(q).join(', ')}, ${arr(m.methods)}, 'unknown', true) on conflict (id) do update set name = excluded.name, expansion_id = excluded.expansion_id, mount_type = excluded.mount_type, availability_status = excluded.availability_status, lockout = excluded.lockout, acquisition_method = excluded.acquisition_method, acquisition_methods = excluded.acquisition_methods;`);
  lines.push(`delete from public.mount_sources where mount_id = ${m.id};`);
  for (const s of m.sources) {
    lines.push(`insert into public.mount_sources (mount_id, source_type, npc_name, boss_name, vendor_name, achievement_name, requirements, instructions) values (${[m.id, s.sourceType, s.npcName, s.bossName, s.vendorName, s.achievementName, s.requirements, s.instructions].map(q).join(', ')});`);
  }
  for (const l of m.locationIds) lines.push(`insert into public.mount_locations (mount_id, location_id) values (${m.id}, ${l}) on conflict do nothing;`);
  for (const r of m.references) lines.push(`insert into public.mount_references (mount_id, label, url) values (${m.id}, ${q(r.label)}, ${q(r.url)}) on conflict do nothing;`);
}
lines.push('commit;', '');
writeFileSync(resolve(root, 'database/seeds/002_demo_catalog.sql'), lines.join('\n'));

console.log(`Catálogo generado: ${mounts.length} monturas, ${expansions.length} expansiones, ${locations.length} ubicaciones.`);
