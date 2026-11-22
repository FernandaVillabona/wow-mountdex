/** Parsers mínimos y sin dependencias: CSV (RFC 4180) y tablas Lua literales. */

export function parseCsv(text) {
  const rows = [];
  let row = [];
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
  const [header, ...data] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/**
 * Parser de un subconjunto de Lua suficiente para las bases de datos de addons:
 * tablas { ... }, claves [expr] = / ident =, cadenas, números, booleanos, nil,
 * identificadores con puntos (CONSTANTS.X → "CONSTANTS.X") y llamadas L["texto"] → "texto".
 * Devuelve objetos JS; las tablas tipo array se devuelven como arrays.
 */
export function parseLuaTable(src, start = 0) {
  let i = start;
  const ws = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith('--[[', i)) { const e = src.indexOf(']]', i); i = e < 0 ? src.length : e + 2; continue; }
      if (src.startsWith('--', i)) { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e + 1; continue; }
      break;
    }
  };
  const str = () => {
    const q = src[i++];
    let out = '';
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') { const n = src[i + 1]; out += n === 'n' ? '\n' : n; i += 2; }
      else out += src[i++];
    }
    i++;
    return out;
  };
  const ident = () => {
    const m = /^[A-Za-z_][\w.]*/.exec(src.slice(i, i + 200));
    if (!m) throw new Error(`Token inesperado en ${i}: ${src.slice(i, i + 30)}`);
    i += m[0].length;
    return m[0];
  };
  const value = () => {
    ws();
    const c = src[i];
    if (c === '{') return table();
    if (c === '"' || c === "'") return str();
    if (/[-\d.]/.test(c)) {
      const m = /^-?(0x[0-9a-fA-F]+|\d*\.?\d+(e-?\d+)?)/.exec(src.slice(i, i + 40));
      i += m[0].length;
      return Number(m[0]);
    }
    const id = ident();
    if (id === 'true') return true;
    if (id === 'false') return false;
    if (id === 'nil') return null;
    ws();
    if (src[i] === '[') { // L["texto"]
      i++; ws();
      const k = value(); ws();
      i++; // ]
      return k;
    }
    if (src[i] === '(') { // llamada f(...) → se ignora el valor
      let depth = 0;
      do { if (src[i] === '(') depth++; else if (src[i] === ')') depth--; i++; } while (depth > 0 && i < src.length);
      return null;
    }
    return id;
  };
  const table = () => {
    i++; // {
    const obj = {};
    const arr = [];
    let isArray = true;
    for (;;) {
      ws();
      if (src[i] === '}') { i++; break; }
      let key = null;
      if (src[i] === '[') {
        i++;
        key = value(); ws(); i++; // ]
        ws(); i++; // =
      } else {
        const save = i;
        const m = /^[A-Za-z_]\w*\s*=(?!=)/.exec(src.slice(i, i + 100));
        if (m) { key = m[0].replace(/\s*=$/, ''); i += m[0].length; } else i = save;
      }
      const v = value();
      if (key === null) arr.push(v);
      else { isArray = false; obj[key] = v; }
      ws();
      if (src[i] === ',' || src[i] === ';') i++;
    }
    if (isArray) return arr;
    if (arr.length) obj.__array = arr;
    return obj;
  };
  ws();
  const v = value();
  return { value: v, end: i };
}

/** Busca todas las asignaciones de nivel superior `X = { ... }` o `local X = { ... }` y devuelve sus tablas. */
export function extractLuaTables(src) {
  const out = [];
  const re = /(?:^|\n)\s*(?:local\s+)?[\w.[\]"']+\s*=\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const brace = m.index + m[0].length - 1;
    try {
      const { value, end } = parseLuaTable(src, brace);
      out.push(value);
      re.lastIndex = end;
    } catch {
      /* bloque no soportado: se ignora */
    }
  }
  return out;
}

/** Limpia códigos de color/texturas del cliente (|cFFxxxxxx, |r, |n, |T...|t). */
export function cleanClientText(s) {
  return (s ?? '')
    .replace(/\|T[^|]*\|t/g, '')
    .replace(/\|c[0-9A-Fa-f]{8}/g, '')
    .replace(/\|r/g, '')
    .replace(/\|n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
