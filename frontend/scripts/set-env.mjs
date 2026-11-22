#!/usr/bin/env node
/**
 * Genera src/app/core/config/runtime-config.ts a partir de variables de entorno
 * (Vercel) o de un archivo frontend/.env local. Solo se aceptan valores PÚBLICOS:
 * nunca pongas aquí service_role keys ni el client_secret de Blizzard.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(here, '../.env');

const fileVars = {};
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) fileVars[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const get = (k) => process.env[k] ?? fileVars[k] ?? '';

const forbidden = Object.keys({ ...fileVars, ...process.env }).filter((k) =>
  /SERVICE_ROLE|CLIENT_SECRET/.test(k) && k.startsWith('NG_'),
);
if (forbidden.length) {
  console.error(`[set-env] Variables secretas no permitidas en el frontend: ${forbidden.join(', ')}`);
  process.exit(1);
}

const config = {
  supabaseUrl: get('NG_SUPABASE_URL'),
  supabaseAnonKey: get('NG_SUPABASE_ANON_KEY'),
  blizzardClientId: get('NG_BLIZZARD_CLIENT_ID'),
  blizzardRedirectUri: get('NG_BLIZZARD_REDIRECT_URI'),
};

const out = `// GENERADO por scripts/set-env.mjs — no editar ni versionar.
import { RuntimeConfig } from './runtime-config.model';

export const runtimeConfig: RuntimeConfig = ${JSON.stringify(config, null, 2)};
`;
writeFileSync(resolve(here, '../src/app/core/config/runtime-config.ts'), out);
console.log(
  `[set-env] Supabase: ${config.supabaseUrl ? 'configurado' : 'no configurado (modo local)'} · ` +
    `Blizzard: ${config.blizzardClientId ? 'configurado' : 'no configurado'}`,
);
