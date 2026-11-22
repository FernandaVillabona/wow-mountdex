import { TestBed } from '@angular/core/testing';
import { catalog, mount } from '../utils/test-fixtures';
import { BlizzardService } from './blizzard.service';
import { CatalogService } from './catalog.service';
import { CollectionService } from './collection.service';

describe('CollectionService (modo invitado)', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('marca obtenida con fecha, la persiste y la limpia al desmarcar', () => {
    const svc = TestBed.inject(CollectionService);
    svc.toggle(7, 'obtained');
    expect(svc.get(7).obtained).toBeTrue();
    expect(svc.get(7).obtainedAt).not.toBeNull();
    expect(svc.obtainedCount()).toBe(1);
    expect(JSON.parse(localStorage.getItem('mountdex:collection:guest')!)['7'].obtained).toBeTrue();
    svc.toggle(7, 'obtained');
    expect(svc.get(7).obtainedAt).toBeNull();
    expect(svc.obtainedCount()).toBe(0);
  });

  it('registra intentos sin bajar de cero', () => {
    const svc = TestBed.inject(CollectionService);
    svc.addAttempt(3, 1);
    svc.addAttempt(3, 1);
    svc.addAttempt(3, -5);
    expect(svc.get(3).attempts).toBe(0);
  });

  it('markObtained solo cuenta las nuevas', () => {
    const svc = TestBed.inject(CollectionService);
    svc.toggle(1, 'obtained');
    expect(svc.markObtained([1, 2, 3])).toBe(2);
  });
});

describe('BlizzardService.match', () => {
  it('empareja por blizzard_id y por nombre normalizado', () => {
    TestBed.configureTestingModule({});
    const cat = TestBed.inject(CatalogService);
    cat.catalog.set(catalog([mount(1, { blizzardId: 183, name: "Ashes of Al'ar" }), mount(2, { name: 'Invincible' }), mount(3)]));
    const res = TestBed.inject(BlizzardService).match([
      { id: 183, name: 'Otro nombre' },
      { id: 363, name: 'INVINCIBLE' },
      { id: 999, name: 'No existe' },
    ]);
    expect(res.matchedIds.sort()).toEqual([1, 2]);
    expect(res.matchedByName).toBe(1);
    expect(res.unmatched.map((m) => m.id)).toEqual([999]);
  });
});
