import { DEFAULT_FILTERS, countActiveFilters, filterMounts } from './mount-filters';
import { catalog, mount, st } from './test-fixtures';

describe('filterMounts', () => {
  const cat = catalog([
    mount(1, { name: "Ashes of Al'ar", expansionId: 2, locationIds: [2], sources: [{ sourceType: 'raid', bossName: "Kael'thas Sunstrider", npcName: null, vendorName: null, achievementName: null, reputationRequirement: null, currencyRequirement: null, requirements: null, instructions: null, sourceUrl: null }], lockout: 'weekly' }),
    mount(2, { name: 'Drake of the North Wind', expansionId: 1, methods: ['dungeon'], locationIds: [1], probability: { percentage: 0.8, status: 'community', source: 'x', knownAttempts: null } }),
    mount(3, { name: 'Lucid Nightmare', methods: ['secret'], rarity: 'legendary' }),
    mount(4, { name: 'Ápice Ñandú', probability: { percentage: 7, status: 'published', source: 'y', knownAttempts: null } }),
  ]);
  const col = { 1: st(1, { obtained: true, obtainedAt: '2026-02-01T00:00:00Z' }), 3: st(3, { favorite: true, target: true }) };
  const run = (p: Partial<typeof DEFAULT_FILTERS>) => filterMounts(cat, col, { ...DEFAULT_FILTERS, ...p }).map((m) => m.id);

  it('devuelve todo ordenado por número por defecto', () => expect(run({})).toEqual([1, 2, 3, 4]));
  it('busca por jefe, zona e instancia, sin acentos', () => {
    expect(run({ text: 'kaelthas' })).toEqual([]);
    expect(run({ text: "kael'thas" })).toEqual([1]);
    expect(run({ text: 'vortex' })).toEqual([2]);
    expect(run({ text: 'apice nandu' })).toEqual([4]);
  });
  it('busca por número de registro', () => expect(run({ text: '#3' })).toEqual([3]));
  it('combina filtros simultáneos', () => {
    expect(run({ status: 'pending', method: 'dungeon' })).toEqual([2]);
    expect(run({ continent: 'Terrallende', status: 'obtained' })).toEqual([1]);
    expect(run({ favoritesOnly: true, targetsOnly: true, secretOnly: true })).toEqual([3]);
    expect(run({ weeklyLockoutOnly: true })).toEqual([1]);
  });
  it('filtra por tramos de probabilidad sin tratar desconocida como baja', () => {
    expect(run({ probability: 'lt1' })).toEqual([2]);
    expect(run({ probability: 'lt10' })).toEqual([2, 4]);
    expect(run({ probability: 'unknown' })).toEqual([1, 3]);
  });
  it('ordena dejando los valores desconocidos al final en ambas direcciones', () => {
    expect(run({ sort: 'probability' })).toEqual([2, 4, 1, 3]);
    expect(run({ sort: 'probability', sortDir: 'desc' })).toEqual([4, 2, 1, 3]);
    expect(run({ sort: 'obtainedAt' })[0]).toBe(1);
  });
  it('cuenta filtros activos ignorando el orden', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, sort: 'name' })).toBe(0);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, text: 'a', favoritesOnly: true })).toBe(2);
  });
});
