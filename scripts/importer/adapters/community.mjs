/**
 * Adaptadores de fuentes comunitarias de código abierto (sin API; ficheros públicos en GitHub).
 *  - Simple Armory (MIT): lista curada, expansión/categoría, icono, facción, obtenibilidad.
 *  - Rarity (GPL-2.0): probabilidades de drop estimadas, NPC y coordenadas comunitarias.
 */
import { extractLuaTables } from '../lib/parsers.mjs';

export const SA_URL = 'https://raw.githubusercontent.com/kevinclement/SimpleArmory/master/static/data/mounts.json';
const RARITY_BASE = 'https://raw.githubusercontent.com/WowRarity/Rarity/HEAD/DB/Mounts/';
const RARITY_FILES = [
  'Classic', 'TheBurningCrusade', 'WrathOfTheLichKing', 'Cataclysm', 'MistsOfPandaria', 'WarlordsOfDraenor', 'Legion',
  'BattleForAzeroth', 'Shadowlands', 'Dragonflight', 'TheWarWithin', 'Midnight',
  'HolidayEvents_TheBurningCrusade', 'HolidayEvents_WrathOfTheLichKing', 'HolidayEvents_WarlordsOfDraenor',
  'HolidayEvents_Dragonflight', 'HolidayEvents_TheWarWithin',
];
export const rarityFileUrl = (f) => `${RARITY_BASE}${f}.lua`;

const EXPANSION_BY_CATEGORY = {
  Classic: 1, 'The Burning Crusade': 2, 'Wrath of the Lich King': 3, Cataclysm: 4, 'Mists of Pandaria': 5,
  'Warlords of Draenor': 6, Legion: 7, 'Battle for Azeroth': 8, Shadowlands: 9, Dragonflight: 10,
  'The War Within': 11, Midnight: 12,
};

/** Subcategorías de Simple Armory → métodos de obtención de MountDex (solo coincidencias claras). */
const METHOD_BY_SUBCAT = [
  [/raid/i, 'raid'], [/dungeon|mythic\+/i, 'dungeon'], [/achievement/i, 'achievement'],
  [/reputation|renown|paragon/i, 'reputation'], [/quest|campaign/i, 'quest'], [/vendor/i, 'vendor'],
  [/profession|crafted|engineering|tailoring|leatherworking|jewelcrafting|blacksmith|alchemy|fishing|archaeology/i, 'profession'],
  [/pvp|arena|battleground|gladiator/i, 'pvp'], [/rare spawn|world boss/i, 'world_boss'],
  [/riddle|secret|puzzle/i, 'secret'], [/store|shop/i, 'store'], [/promotion|recruit|collector|blizzcon|anniversary|tcg/i, 'promotion'],
  [/trading post/i, 'trading_post'], [/season/i, 'season_reward'], [/event|holiday|brewfest|hallow|love is|lunar|winter veil|noblegarden|midsummer|darkmoon/i, 'world_event'],
  [/zone drop|treasure|drop/i, 'random_drop'],
];

export async function loadSimpleArmory(http, log) {
  const data = await http.get(SA_URL, { provider: 'github', as: 'json' });
  const byMountId = new Map();
  for (const cat of data) {
    for (const sub of cat.subcats ?? []) {
      for (const it of sub.items ?? []) {
        if (!it.ID || byMountId.has(it.ID)) continue;
        const method = METHOD_BY_SUBCAT.find(([re]) => re.test(sub.name) || re.test(cat.name))?.[1] ?? null;
        byMountId.set(it.ID, {
          mountId: it.ID,
          name: it.name,
          icon: it.icon ? String(it.icon).toLowerCase() : null,
          itemId: it.itemId ?? null,
          spellId: it.spellid ?? null,
          faction: it.side === 'A' ? 'alliance' : it.side === 'H' ? 'horde' : null,
          notObtainable: !!it.notObtainable,
          notReleased: !!it.notReleased,
          category: `${cat.name} › ${sub.name}`,
          expansionId: EXPANSION_BY_CATEGORY[cat.name] ?? null,
          limitedTime: /limited time/i.test(cat.name),
          method,
        });
      }
    }
  }
  log(`  Simple Armory: ${byMountId.size} monturas`);
  return byMountId;
}

export async function loadRarity(http, log) {
  const bySpell = new Map();
  for (const f of RARITY_FILES) {
    let src;
    try {
      src = await http.get(rarityFileUrl(f), { provider: 'github' });
    } catch (e) {
      log(`  Rarity ${f}: no disponible (${e.message})`);
      continue;
    }
    for (const table of extractLuaTables(src)) {
      if (!table || typeof table !== 'object' || Array.isArray(table)) continue;
      for (const entry of Object.values(table)) {
        if (!entry || typeof entry !== 'object' || !entry.spellId) continue;
        const chance = typeof entry.chance === 'number' && entry.chance > 0 ? entry.chance : null;
        const coords = (Array.isArray(entry.coords) ? entry.coords : [])
          .filter((c) => c && typeof c.m === 'number' && typeof c.x === 'number' && typeof c.y === 'number')
          .map((c) => ({ uiMapId: c.m, x: c.x, y: c.y, instance: !!c.i }));
        const diffs = entry.instanceDifficulties && typeof entry.instanceDifficulties === 'object'
          ? Object.keys(entry.instanceDifficulties).map((k) => k.replace(/^CONSTANTS\.INSTANCE_DIFFICULTIES\./, ''))
          : [];
        bySpell.set(entry.spellId, {
          spellId: entry.spellId,
          chance, // 1 de cada N
          npcIds: Array.isArray(entry.npcs) ? entry.npcs.filter((n) => typeof n === 'number' && n !== 99999) : [],
          lockBossName: typeof entry.lockBossName === 'string' ? entry.lockBossName : null,
          difficulties: diffs,
          coords,
          file: rarityFileUrl(f),
        });
      }
    }
  }
  log(`  Rarity: ${bySpell.size} monturas con datos`);
  return bySpell;
}
