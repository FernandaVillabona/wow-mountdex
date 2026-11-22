/**
 * CATÁLOGO DE DEMOSTRACIÓN — WoW MountDex
 *
 * Fuente única para generar:
 *   - frontend/public/data/catalog.json
 *   - database/seeds/002_demo_catalog.sql
 * con `node scripts/build-catalog.mjs`.
 *
 * Reglas (ver docs/architecture/DATA-SOURCES.md):
 *   - Solo monturas cuyo jefe / instancia / zona están ampliamente documentados.
 *   - NINGÚN porcentaje de drop: probability = unknown.
 *   - Sin coordenadas, sin rareza, sin dificultad (null = desconocido).
 *   - verifiedAt = null → "pendiente de verificación" hasta que un editor lo confirme.
 *   - Nombres de zona/instancia/NPC en inglés (en_US) hasta disponer de localización verificada.
 *   - blizzardId = null: se rellena al ejecutar el importador oficial.
 */

export const expansions = [
  { id: 1, slug: 'classic', name: 'Classic', shortName: 'WoW', releaseDate: '2004-11-23', color: '#c9a227' },
  { id: 2, slug: 'the-burning-crusade', name: 'The Burning Crusade', shortName: 'TBC', releaseDate: '2007-01-16', color: '#3f9b3f' },
  { id: 3, slug: 'wrath-of-the-lich-king', name: 'Wrath of the Lich King', shortName: 'WotLK', releaseDate: '2008-11-13', color: '#4a90c8' },
  { id: 4, slug: 'cataclysm', name: 'Cataclysm', shortName: 'Cata', releaseDate: '2010-12-07', color: '#c8502a' },
  { id: 5, slug: 'mists-of-pandaria', name: 'Mists of Pandaria', shortName: 'MoP', releaseDate: '2012-09-25', color: '#2e9e83' },
  { id: 6, slug: 'warlords-of-draenor', name: 'Warlords of Draenor', shortName: 'WoD', releaseDate: '2014-11-13', color: '#8a5a2b' },
  { id: 7, slug: 'legion', name: 'Legion', shortName: 'Legion', releaseDate: '2016-08-30', color: '#55b832' },
  { id: 8, slug: 'battle-for-azeroth', name: 'Battle for Azeroth', shortName: 'BfA', releaseDate: '2018-08-14', color: '#2f5fa8' },
  { id: 9, slug: 'shadowlands', name: 'Shadowlands', shortName: 'SL', releaseDate: '2020-11-23', color: '#6b6f8a' },
  { id: 10, slug: 'dragonflight', name: 'Dragonflight', shortName: 'DF', releaseDate: '2022-11-28', color: '#c0392b' },
  { id: 11, slug: 'the-war-within', name: 'The War Within', shortName: 'TWW', releaseDate: '2024-08-26', color: '#b07d2b' },
  { id: 12, slug: 'midnight', name: 'Midnight', shortName: 'MN', releaseDate: null, color: '#6d3fa8' },
  { id: 99, slug: 'additional-content', name: 'Contenido adicional', shortName: 'Extra', releaseDate: null, color: '#7a7a7a' },
];

// [id, continent, zone, dungeon, raid]
export const locations = [
  [1, 'Reinos del Este', 'Northern Stranglethorn', null, "Zul'Gurub"],
  [2, 'Reinos del Este', 'Deadwind Pass', null, 'Karazhan'],
  [3, 'Terrallende', 'Netherstorm', null, 'Tempest Keep: The Eye'],
  [4, 'Terrallende', 'Terokkar Forest', 'Sethekk Halls', null],
  [5, 'Reinos del Este', "Isle of Quel'Danas", "Magisters' Terrace", null],
  [6, 'Rasganorte', 'Icecrown', null, 'Icecrown Citadel'],
  [7, 'Rasganorte', 'The Storm Peaks', null, 'Ulduar'],
  [8, 'Rasganorte', 'Howling Fjord', 'Utgarde Pinnacle', null],
  [9, 'Rasganorte', 'Borean Tundra', null, 'The Eye of Eternity'],
  [10, 'Rasganorte', 'The Storm Peaks', null, null],
  [11, 'Kalimdor', 'Uldum', 'The Vortex Pinnacle', null],
  [12, 'Kalimdor', 'Uldum', null, 'Throne of the Four Winds'],
  [13, 'Infralar', 'Deepholm', 'The Stonecore', null],
  [14, 'Pandaria', 'Kun-Lai Summit', null, "Mogu'shan Vaults"],
  [15, 'Pandaria', 'Kun-Lai Summit', null, null],
  [16, 'Pandaria', 'Vale of Eternal Blossoms', null, 'Siege of Orgrimmar'],
  [17, 'Draenor', 'Gorgrond', null, 'Blackrock Foundry'],
  [18, 'Draenor', 'Tanaan Jungle', null, 'Hellfire Citadel'],
  [19, 'Reinos del Este', 'Deadwind Pass', 'Return to Karazhan', null],
  [20, 'Islas Abruptas', 'Suramar', null, 'The Nighthold'],
  [21, 'Zandalar', 'Zuldazar', null, "Battle of Dazar'alor"],
  [22, 'Tierras Sombrías', 'The Maw', null, 'Sanctum of Domination'],
  [23, 'Islas Dragón', 'The Waking Shores', null, null],
];

/**
 * Formato compacto:
 * id, name, expansionId, mountType, methods[], availability,
 * source: { boss?, npc?, vendor?, achievement?, requirements?, instructions? },
 * locationIds[], lockout?
 */
export const mounts = [
  { id: 1, name: 'Swift Razzashi Raptor', exp: 1, type: 'ground', methods: ['raid'], availability: 'unavailable',
    source: { boss: 'Bloodlord Mandokir', requirements: "Versión original de Zul'Gurub (retirada con Cataclysm)." }, loc: [1] },
  { id: 2, name: 'Swift Zulian Tiger', exp: 1, type: 'ground', methods: ['raid'], availability: 'unavailable',
    source: { boss: 'High Priest Thekal', requirements: "Versión original de Zul'Gurub (retirada con Cataclysm)." }, loc: [1] },
  { id: 3, name: 'Fiery Warhorse', exp: 2, type: 'ground', methods: ['raid'], availability: 'unknown',
    source: { boss: 'Attumen the Huntsman' }, loc: [2], lockout: 'weekly' },
  { id: 4, name: "Ashes of Al'ar", exp: 2, type: 'flying', methods: ['raid'], availability: 'unknown',
    source: { boss: "Kael'thas Sunstrider" }, loc: [3], lockout: 'weekly' },
  { id: 5, name: 'Raven Lord', exp: 2, type: 'ground', methods: ['dungeon'], availability: 'unknown',
    source: { boss: 'Anzu', requirements: 'Dificultad heroica.' }, loc: [4] },
  { id: 6, name: 'Swift White Hawkstrider', exp: 2, type: 'ground', methods: ['dungeon'], availability: 'unknown',
    source: { boss: "Kael'thas Sunstrider", requirements: 'Dificultad heroica.' }, loc: [5] },
  { id: 7, name: 'Invincible', exp: 3, type: 'flying', methods: ['raid'], availability: 'unknown',
    source: { boss: 'The Lich King', requirements: '25 jugadores, dificultad heroica.' }, loc: [6], lockout: 'weekly' },
  { id: 8, name: "Mimiron's Head", exp: 3, type: 'flying', methods: ['raid'], availability: 'unknown',
    source: { boss: 'Yogg-Saron', requirements: '25 jugadores.' }, loc: [7], lockout: 'weekly' },
  { id: 9, name: 'Blue Proto-Drake', exp: 3, type: 'flying', methods: ['dungeon'], availability: 'unknown',
    source: { boss: 'Skadi the Ruthless', requirements: 'Dificultad heroica.' }, loc: [8] },
  { id: 10, name: 'Blue Drake', exp: 3, type: 'flying', methods: ['raid'], availability: 'unknown',
    source: { boss: 'Malygos' }, loc: [9], lockout: 'weekly' },
  { id: 11, name: 'White Polar Bear', exp: 3, type: 'ground', methods: ['quest', 'random_drop'], availability: 'unknown',
    source: { instructions: 'Recompensa aleatoria de las misiones diarias de los Hyldnir (Brunnhildar Village).' }, loc: [10] },
  { id: 12, name: 'Sea Turtle', exp: 3, type: 'aquatic', methods: ['profession', 'random_drop'], availability: 'unknown',
    source: { requirements: 'Pesca.', instructions: 'Se obtiene pescando en bancos de peces.' }, loc: [] },
  { id: 13, name: 'Drake of the North Wind', exp: 4, type: 'flying', methods: ['dungeon'], availability: 'unknown',
    source: { boss: 'Altairus' }, loc: [11] },
  { id: 14, name: 'Drake of the South Wind', exp: 4, type: 'flying', methods: ['raid'], availability: 'unknown',
    source: { boss: "Al'Akir" }, loc: [12], lockout: 'weekly' },
  { id: 15, name: 'Vitreous Stone Drake', exp: 4, type: 'flying', methods: ['dungeon'], availability: 'unknown',
    source: { boss: 'Slabhide' }, loc: [13] },
  { id: 16, name: 'Astral Cloud Serpent', exp: 5, type: 'flying', methods: ['raid'], availability: 'unknown',
    source: { boss: 'Elegon' }, loc: [14], lockout: 'weekly' },
  { id: 17, name: 'Heavenly Onyx Cloud Serpent', exp: 5, type: 'flying', methods: ['world_boss'], availability: 'unknown',
    source: { boss: 'Sha of Anger' }, loc: [15] },
  { id: 18, name: "Kor'kron Juggernaut", exp: 5, type: 'ground', methods: ['raid'], availability: 'unknown',
    source: { boss: 'Garrosh Hellscream', requirements: 'Dificultad mítica.' }, loc: [16], lockout: 'weekly' },
  { id: 19, name: 'Ironhoof Destroyer', exp: 6, type: 'ground', methods: ['raid'], availability: 'unknown',
    source: { boss: 'Blackhand', requirements: 'Dificultad mítica.' }, loc: [17], lockout: 'weekly' },
  { id: 20, name: 'Felsteel Annihilator', exp: 6, type: 'flying', methods: ['raid'], availability: 'unknown',
    source: { boss: 'Archimonde', requirements: 'Dificultad mítica.' }, loc: [18], lockout: 'weekly' },
  { id: 21, name: "Midnight's Eternal Reins", exp: 7, type: 'flying', methods: ['dungeon'], availability: 'unknown',
    source: { boss: 'Attumen the Huntsman', requirements: 'Dificultad mítica.' }, loc: [19] },
  { id: 22, name: 'Living Infernal Core', exp: 7, type: 'flying', methods: ['raid'], availability: 'unknown',
    source: { boss: "Gul'dan", requirements: 'Dificultad mítica.' }, loc: [20], lockout: 'weekly' },
  { id: 23, name: 'Lucid Nightmare', exp: 7, type: 'flying', methods: ['secret'], availability: 'unknown',
    source: { instructions: 'Montura secreta: se obtiene resolviendo una cadena de acertijos repartida por Azeroth. Consulta las referencias.' }, loc: [] },
  { id: 24, name: "Riddler's Mind-Worm", exp: 7, type: 'flying', methods: ['secret'], availability: 'unknown',
    source: { instructions: 'Montura secreta: requiere encontrar una serie de páginas ocultas. Consulta las referencias.' }, loc: [] },
  { id: 25, name: 'G.M.O.D.', exp: 8, type: 'flying', methods: ['raid'], availability: 'unknown',
    source: { boss: 'Lady Jaina Proudmoore', requirements: 'Dificultad mítica.' }, loc: [21], lockout: 'weekly' },
  { id: 26, name: "Vengeance's Reins", exp: 9, type: 'flying', methods: ['raid'], availability: 'unknown',
    source: { boss: 'Sylvanas Windrunner', requirements: 'Dificultad mítica.' }, loc: [22], lockout: 'weekly' },
  { id: 27, name: 'Renewed Proto-Drake', exp: 10, type: 'skyriding', methods: ['quest'], availability: 'unknown',
    source: { instructions: 'Se obtiene durante las misiones iniciales de surcacielos en The Waking Shores.' }, loc: [23] },
];
