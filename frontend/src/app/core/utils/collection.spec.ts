import { METHOD_LABELS } from '../models/catalog.models';
import { importCsv, importJson, isMeaningful, mergeCollections, parseCsv, remapIds, toCsv, toExport } from './collection-io';
import { byContinent, byExpansion, byMethod, overall } from './collection-stats';
import { computeMilestones } from './milestones';
import { catalog, mount, st } from './test-fixtures';

describe('estadísticas', () => {
  const cat = catalog([mount(1, { expansionId: 2, locationIds: [2] }), mount(2, { locationIds: [1], methods: ['dungeon'] }), mount(3)]);
  const col = { 1: st(1, { obtained: true }), 2: st(2, { favorite: true }) };

  it('calcula el total', () => expect(overall(cat, col)).toEqual(jasmine.objectContaining({ total: 3, obtained: 1, pending: 2, percent: 33.3 })));
  it('agrupa por expansión', () => {
    const rows = byExpansion(cat, col);
    expect(rows.find((r) => r.key === 'tbc')).toEqual(jasmine.objectContaining({ total: 1, obtained: 1, percent: 100 }));
    expect(rows.find((r) => r.key === 'classic')).toEqual(jasmine.objectContaining({ total: 2, obtained: 0 }));
  });
  it('agrupa por continente con un grupo para las sin ubicación', () => {
    expect(byContinent(cat, col).map((r) => r.label)).toEqual(['Kalimdor', 'Sin ubicación verificada', 'Terrallende']);
  });
  it('agrupa por método', () => expect(byMethod(cat, col, METHOD_LABELS)[0]).toEqual(jasmine.objectContaining({ key: 'raid', total: 2 })));
});

describe('hitos', () => {
  it('se basan en la colección real e ignoran IDs fuera del catálogo', () => {
    const cat = catalog([mount(1, { expansionId: 2 }), mount(2)]);
    const ms = computeMilestones(cat, { 1: st(1, { obtained: true }), 999: st(999, { obtained: true }) });
    expect(ms.find((m) => m.id === 'count-1')?.achieved).toBeTrue();
    expect(ms.find((m) => m.id === 'count-50')).toEqual(jasmine.objectContaining({ achieved: false, current: 1 }));
    expect(ms.find((m) => m.id === 'exp-tbc')?.achieved).toBeTrue();
    expect(ms.find((m) => m.id === 'exp-classic')?.achieved).toBeFalse();
  });
});

describe('fusión local ↔ nube', () => {
  it('gana el registro más reciente y no duplica', () => {
    const a = { 1: st(1, { obtained: true, updatedAt: '2026-03-01T00:00:00Z' }), 2: st(2, { favorite: true }) };
    const b = { 1: st(1, { obtained: false, updatedAt: '2026-02-01T00:00:00Z' }), 3: st(3, { target: true }) };
    const m = mergeCollections(a, b);
    expect(Object.keys(m).sort()).toEqual(['1', '2', '3']);
    expect(m[1].obtained).toBeTrue();
    expect(mergeCollections(b, a)[1].obtained).toBeTrue();
  });
  it('detecta registros vacíos', () => {
    expect(isMeaningful(st(1))).toBeFalse();
    expect(isMeaningful(st(1, { notes: 'x' }))).toBeTrue();
  });
});

describe('remapIds (demo → ID oficial)', () => {
  it('mueve los registros, conserva el resto y no duplica', () => {
    const col = {
      4: st(4, { obtained: true, updatedAt: '2026-01-02T00:00:00Z' }),
      6: st(6, { favorite: true }),
      183: st(183, { notes: 'antiguo', updatedAt: '2025-01-01T00:00:00Z' }),
    };
    const out = remapIds(col, { '4': 183, '6': 160 });
    expect(Object.keys(out).sort()).toEqual(['160', '183']);
    expect(out[183]).toEqual(jasmine.objectContaining({ mountId: 183, obtained: true }));
    expect(out[160].favorite).toBeTrue();
  });
});

describe('exportar / importar', () => {
  const ids = new Set([1, 2, 3]);
  const col = {
    1: st(1, { obtained: true, notes: 'Con "comillas", comas\ny saltos' }),
    2: st(2),
    3: st(3, { target: true, targetPriority: 1, attempts: 12 }),
  };

  it('JSON ida y vuelta conserva datos y omite registros vacíos', () => {
    const exported = toExport(col);
    expect(exported.entries.map((e) => e.mountId)).toEqual([1, 3]);
    const back = importJson(JSON.stringify(exported), ids);
    expect(back.errors).toEqual([]);
    expect(back.entries.find((e) => e.mountId === 1)?.notes).toBe(col[1].notes);
    expect(back.entries.find((e) => e.mountId === 3)).toEqual(jasmine.objectContaining({ targetPriority: 1, attempts: 12 }));
  });

  it('CSV ida y vuelta con celdas escapadas', () => {
    const csv = toCsv(col, (id) => `Nombre, ${id}`);
    expect(parseCsv(csv)[1][1]).toBe('Nombre, 1');
    const back = importCsv(csv, ids);
    expect(back.entries.length).toBe(2);
    expect(back.entries[0].notes).toBe(col[1].notes);
  });

  it('rechaza archivos ajenos y monturas inexistentes', () => {
    expect(importJson('{"foo":1}', ids).errors.length).toBe(1);
    expect(importJson('no json', ids).errors.length).toBe(1);
    const r = importCsv('mount_id,obtained\n1,true\n42,true\nabc,true\n1,false\n', ids);
    expect(r.skipped).toBe(2);
    expect(r.entries.length).toBe(1);
    expect(r.entries[0].obtained).toBeFalse(); // la última fila de una montura gana
  });

  it('sanea valores fuera de rango', () => {
    const r = importCsv('mount_id,attempts,target_priority,obtained_at\n2,-5,9,no-es-fecha\n', ids);
    expect(r.entries[0]).toEqual(jasmine.objectContaining({ attempts: 0, targetPriority: 2, obtainedAt: null }));
  });
});
