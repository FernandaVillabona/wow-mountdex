import { Catalog } from '../models/catalog.models';
import { CollectionMap } from '../models/collection.models';

export interface Milestone {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  current: number;
  goal: number;
}

const COUNT_GOALS: [number, string][] = [
  [1, 'Primera montura'],
  [50, 'Establo modesto'],
  [100, 'Centenar de riendas'],
  [250, 'Maestro de establos'],
  [500, 'Leyenda de Azeroth'],
];

/** Hitos calculados exclusivamente a partir de la colección real del usuario. */
export function computeMilestones(catalog: Catalog, col: CollectionMap): Milestone[] {
  const catalogIds = new Set(catalog.mounts.map((m) => m.id));
  const obtained = Object.values(col).filter((s) => s.obtained && catalogIds.has(s.mountId)).length;

  const list: Milestone[] = COUNT_GOALS.map(([goal, title]) => ({
    id: `count-${goal}`,
    title,
    description: goal === 1 ? 'Registra tu primera montura.' : `Registra ${goal} monturas.`,
    achieved: obtained >= goal,
    current: Math.min(obtained, goal),
    goal,
  }));

  for (const e of [...catalog.expansions].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const mounts = catalog.mounts.filter((m) => m.expansionId === e.id);
    if (mounts.length === 0) continue;
    const got = mounts.filter((m) => col[m.id]?.obtained).length;
    list.push({
      id: `exp-${e.slug}`,
      title: `${e.shortName} al 100%`,
      description: `Completa todas las monturas de ${e.name} del catálogo actual.`,
      achieved: got === mounts.length,
      current: got,
      goal: mounts.length,
    });
  }
  return list;
}
