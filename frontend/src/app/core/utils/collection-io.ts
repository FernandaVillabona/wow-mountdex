import { CollectionExport, CollectionMap, UserMountState, emptyState } from '../models/collection.models';

/** Fusiona dos colecciones: por montura gana el registro con updatedAt más reciente. */
export function mergeCollections(a: CollectionMap, b: CollectionMap): CollectionMap {
  const out: CollectionMap = { ...a };
  for (const [key, entry] of Object.entries(b)) {
    const id = Number(key);
    const current = out[id];
    if (!current || Date.parse(entry.updatedAt) > Date.parse(current.updatedAt)) out[id] = entry;
  }
  return out;
}

/**
 * Renumera una colección según un mapa id_antiguo → id_nuevo (catálogo de demo → IDs oficiales).
 * Si el destino ya tiene registro, se conserva el más reciente.
 */
export function remapIds(col: CollectionMap, mapping: Record<string, number>): CollectionMap {
  const moved: CollectionMap = {};
  const rest: CollectionMap = {};
  for (const [key, entry] of Object.entries(col)) {
    const to = mapping[key];
    if (to !== undefined) moved[to] = { ...entry, mountId: to };
    else rest[Number(key)] = entry;
  }
  return mergeCollections(rest, moved);
}

/** Un registro "vacío" no necesita guardarse. */
export function isMeaningful(s: UserMountState): boolean {
  return s.obtained || s.favorite || s.target || s.notes.trim() !== '' || s.attempts > 0;
}

export function toExport(col: CollectionMap): CollectionExport {
  return {
    format: 'wow-mountdex',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: Object.values(col).filter(isMeaningful).sort((x, y) => x.mountId - y.mountId),
  };
}

const CSV_HEADERS = [
  'mount_id', 'name', 'obtained', 'favorite', 'target', 'target_priority',
  'obtained_at', 'attempts', 'last_attempt_at', 'notes', 'updated_at',
] as const;

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(col: CollectionMap, nameOf: (id: number) => string): string {
  const rows = toExport(col).entries.map((e) =>
    [e.mountId, nameOf(e.mountId), e.obtained, e.favorite, e.target, e.targetPriority,
      e.obtainedAt, e.attempts, e.lastAttemptAt, e.notes, e.updatedAt].map(csvCell).join(','),
  );
  return [CSV_HEADERS.join(','), ...rows].join('\r\n') + '\r\n';
}

/** Parser CSV RFC 4180 mínimo (comillas, comas y saltos de línea dentro de celdas). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ''));
}

export interface ImportResult {
  entries: UserMountState[];
  skipped: number;
  errors: string[];
}

const bool = (v: unknown) => v === true || v === 'true' || v === '1';
const isoOrNull = (v: unknown): string | null => {
  if (typeof v !== 'string' || v === '') return null;
  return Number.isNaN(Date.parse(v)) ? null : new Date(v).toISOString();
};

function sanitize(raw: Record<string, unknown>, validIds: Set<number>): UserMountState | string {
  const id = Number(raw['mountId'] ?? raw['mount_id']);
  if (!Number.isInteger(id)) return 'Fila sin mount_id válido';
  if (!validIds.has(id)) return `La montura ${id} no existe en el catálogo actual`;
  const base = emptyState(id);
  const prio = Number(raw['targetPriority'] ?? raw['target_priority'] ?? 2);
  const attempts = Number(raw['attempts'] ?? 0);
  return {
    ...base,
    obtained: bool(raw['obtained']),
    favorite: bool(raw['favorite']),
    target: bool(raw['target']),
    targetPriority: (prio === 1 || prio === 3 ? prio : 2) as 1 | 2 | 3,
    obtainedAt: isoOrNull(raw['obtainedAt'] ?? raw['obtained_at']),
    attempts: Number.isFinite(attempts) && attempts >= 0 ? Math.min(Math.floor(attempts), 100000) : 0,
    lastAttemptAt: isoOrNull(raw['lastAttemptAt'] ?? raw['last_attempt_at']),
    notes: String(raw['notes'] ?? '').slice(0, 2000),
    updatedAt: isoOrNull(raw['updatedAt'] ?? raw['updated_at']) ?? new Date().toISOString(),
  };
}

export function importJson(text: string, validIds: Set<number>): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { entries: [], skipped: 0, errors: ['El archivo no es un JSON válido.'] };
  }
  const obj = data as Partial<CollectionExport>;
  if (obj?.format !== 'wow-mountdex' || !Array.isArray(obj.entries)) {
    return { entries: [], skipped: 0, errors: ['El JSON no es una exportación de WoW MountDex.'] };
  }
  return collect(obj.entries as unknown as Record<string, unknown>[], validIds);
}

export function importCsv(text: string, validIds: Set<number>): ImportResult {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (rows.length === 0) return { entries: [], skipped: 0, errors: ['El CSV está vacío.'] };
  const header = rows[0].map((h) => h.trim());
  if (!header.includes('mount_id')) return { entries: [], skipped: 0, errors: ['Falta la columna mount_id.'] };
  const records = rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
  return collect(records, validIds);
}

function collect(records: Record<string, unknown>[], validIds: Set<number>): ImportResult {
  const byId = new Map<number, UserMountState>();
  const errors: string[] = [];
  let skipped = 0;
  for (const r of records) {
    const s = sanitize(r, validIds);
    if (typeof s === 'string') { skipped++; if (errors.length < 10) errors.push(s); continue; }
    byId.set(s.mountId, s); // última fila gana → sin duplicados
  }
  return { entries: [...byId.values()], skipped, errors };
}
