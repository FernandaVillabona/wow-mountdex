/**
 * Cliente HTTP del importador:
 *  - caché en disco con TTL (no se repiten descargas en cada ejecución),
 *  - límite de peticiones por proveedor (intervalo mínimo entre llamadas),
 *  - reintentos con backoff para 429/5xx,
 *  - User-Agent identificativo.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const USER_AGENT = 'WoWMountDex-Importer/1.0 (+https://github.com/FernandaVillabona/wow-mountdex)';
const lastCall = new Map();

export function createHttp({ cacheDir, ttlHours = 24, offline = false, log = () => {} }) {
  mkdirSync(cacheDir, { recursive: true });

  async function throttle(provider, minIntervalMs) {
    const prev = lastCall.get(provider) ?? 0;
    const wait = prev + minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall.set(provider, Date.now());
  }

  /**
   * @param {string} url
   * @param {{provider:string, minIntervalMs?:number, headers?:Record<string,string>, cache?:boolean, method?:string, as?:'text'|'json'}} opts
   */
  async function get(url, opts) {
    const { provider, minIntervalMs = 250, headers = {}, cache = true, method = 'GET', as = 'text' } = opts;
    const key = createHash('sha1').update(method + ' ' + url).digest('hex');
    const file = join(cacheDir, `${provider}-${key}.cache`);
    if (cache && existsSync(file)) {
      const age = (Date.now() - statSync(file).mtimeMs) / 3_600_000;
      if (offline || age < ttlHours) {
        const body = readFileSync(file, 'utf8');
        return as === 'json' ? JSON.parse(body) : body;
      }
    }
    if (offline) throw new Error(`Sin caché y modo offline: ${url}`);

    for (let attempt = 0; attempt < 5; attempt++) {
      await throttle(provider, minIntervalMs);
      let res;
      try {
        res = await fetch(url, { method, headers: { 'User-Agent': USER_AGENT, ...headers } });
      } catch (e) {
        log(`  red: ${e.message} (${provider}), reintento ${attempt + 1}`);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        const retry = Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt;
        log(`  HTTP ${res.status} en ${provider}, esperando ${retry} ms`);
        await new Promise((r) => setTimeout(r, retry));
        continue;
      }
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} ${url}`);
        err.status = res.status;
        throw err;
      }
      const body = method === 'HEAD' ? '' : await res.text();
      if (cache && method !== 'HEAD') writeFileSync(file, body);
      return as === 'json' ? JSON.parse(body) : body;
    }
    throw new Error(`Agotados los reintentos: ${url}`);
  }

  /** HEAD sin caché de contenido; devuelve status y content-type. */
  async function head(url, { provider, minIntervalMs = 50 }) {
    await throttle(provider, minIntervalMs);
    try {
      const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': USER_AGENT } });
      return { status: res.status, type: res.headers.get('content-type') ?? '' };
    } catch {
      return { status: 0, type: '' };
    }
  }

  return { get, head };
}
