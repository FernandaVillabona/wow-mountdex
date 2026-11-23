import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LABELS = {
  found: 'Monturas encontradas (coleccionables)',
  new: 'Monturas nuevas',
  updated: 'Monturas actualizadas',
  demoRenumbered: 'Monturas de demo renumeradas a su ID oficial',
  excludedNotCollectible: 'Descartadas (pruebas / no coleccionables)',
  duplicateNames: 'Nombres duplicados (revisión manual)',
  withoutImage: 'Sin imagen (ni icono ni render)',
  withoutRender: 'Sin render del modelo',
  withoutMethod: 'Sin método de obtención',
  withoutLocation: 'Sin ubicación',
  withoutProbability: 'Sin información de probabilidad',
  withoutExpansion: 'Sin expansión',
  withBossFromJournal: 'Con jefe del Diario de encuentros',
  withCoordinates: 'Con coordenadas',
  locations: 'Ubicaciones distintas',
};

export function writeReport(dir, report, now) {
  mkdirSync(dir, { recursive: true });
  const stamp = now.replace(/[:T]/g, '-').slice(0, 16);
  const json = join(dir, `import-${stamp}.json`);
  const md = join(dir, `import-${stamp}.md`);
  writeFileSync(json, JSON.stringify(report, null, 2));
  const lines = [
    `# Informe de importación — ${now}`,
    '',
    `Modo: **${report.mode}**`,
    '',
    '| Métrica | Valor |',
    '|---|---|',
    ...Object.entries(report.counts).map(([k, v]) => `| ${LABELS[k] ?? k} | ${v} |`),
    '',
    '## Fuentes',
    ...Object.entries(report.sources).map(([k, v]) => `- ${k}: ${v}`),
    '',
    `## Correspondencia demo → ID oficial (${Object.keys(report.legacyMapping).length})`,
    ...Object.entries(report.legacyMapping).map(([a, b]) => `- ${a} → ${b}`),
    ...(report.unmatchedDemo.length ? ['', '### Demo sin correspondencia', ...report.unmatchedDemo.map((d) => `- ${d.id} ${d.name}`)] : []),
    '',
    `## Nombres duplicados (${report.duplicates.length})`,
    ...report.duplicates.slice(0, 50).map((d) => `- ${d.name}: ${d.ids.join(', ')}`),
    '',
    `## Errores (${report.errors.length})`,
    ...report.errors.slice(0, 100).map((e) => `- ${e}`),
    '',
  ];
  writeFileSync(md, lines.join('\n'));
  return { json, md };
}
