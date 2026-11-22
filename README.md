# WoW MountDex

Enciclopedia interactiva y registro de colección de monturas de **World of Warcraft**, con la estética
de una Pokédex clásica: carcasa roja, pantallas LCD, botones físicos y LEDs de estado.

> Proyecto de fans no afiliado a Blizzard Entertainment. World of Warcraft® es marca registrada de Blizzard Entertainment, Inc.

## Funcionalidades

- **MountDex**: catálogo numerado con vista lista / cuadrícula / compacta, búsqueda instantánea
  (nombre, nº, jefe, NPC, vendedor, zona, instancia) y filtros combinables (expansión, continente, zona,
  mazmorra/banda, método, probabilidad, rareza, dificultad, disponibilidad, obtenidas, pendientes,
  favoritas, objetivos, secretas, intentos limitados, bloqueo semanal) con 7 criterios de orden.
- **Ficha individual** estilo Pokémon: datos generales, obtención, probabilidad (con estado
  *publicada / comunidad / no verificada / desconocida*), ubicación, fuentes y fecha de verificación.
  Marcar obtenida/pendiente, favorita, objetivo; fecha de obtención, notas e intentos. Navegación ◀ ▶ y con teclado (← →).
- **Expansiones**, **Regiones** (continente → zona → instancia) y **Métodos de obtención** con progreso.
- **Objetivos de farmeo** con prioridad, notas, intentos y "completada".
- **Monturas secretas**, **favoritas**, **montura aleatoria pendiente** (toda la colección, expansión, zona o método).
- **Estadísticas** por expansión, continente, método y rareza + **hitos** (1, 50, 100, 250, 500, 100 % de una expansión).
- **Exportar / importar** JSON y CSV (validado, sin duplicados).
- **Invitado** (localStorage) o **cuenta** (Supabase Auth + RLS) con fusión automática del progreso local al iniciar sesión.
- **Importación desde Battle.net** (OAuth seguro vía Edge Function) — preparada, requiere credenciales.
- Sonidos de navegación opcionales (Web Audio), responsive, navegación por teclado y lectores de pantalla.

## Política de datos

La app **no inventa** probabilidades, coordenadas, NPC ni disponibilidad. Lo que no tiene fuente se muestra
como *desconocido*. El catálogo incluido es una **demostración** de 27 monturas pendiente de verificación;
el catálogo real se importa desde la API oficial de Blizzard. Ver [`docs/architecture/DATA-SOURCES.md`](docs/architecture/DATA-SOURCES.md).

## Estructura

```
frontend/            Angular 19 (standalone, signals, lazy loading)
  src/app/core/      modelos, servicios, guards, utilidades puras (+ tests)
  src/app/shared/    componentes reutilizables (sprite, lista, barra de progreso...)
  src/app/features/  home, pokedex, mount-detail, expansions, locations, acquisition-methods,
                     collection, favorites, objectives, secrets, authentication, profile, blizzard
  public/data/       catálogo estático generado
database/
  migrations/        esquema + RLS (PostgreSQL / Supabase)
  seeds/             fuente del catálogo demo + SQL generado
supabase/functions/  Edge Function blizzard-import
scripts/             build-catalog.mjs, import-blizzard-catalog.mjs
docs/                architecture/, api/, deployment/
```

## Desarrollo local

Requisitos: Node 20+ y npm.

```bash
cd frontend
npm install
cp .env.example .env      # opcional: sin variables funciona en modo local
npm start                 # http://localhost:4200
```

| Comando (en `frontend/`) | Descripción |
|---|---|
| `npm start` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/frontend/browser` |
| `npm run test:ci` | Tests unitarios (Chrome headless) |
| `node ../scripts/build-catalog.mjs` | Regenera `catalog.json` y el seed SQL desde `database/seeds/demo-catalog.source.mjs` |

## Configuración

Variables públicas del frontend (`frontend/.env` o Vercel): `NG_SUPABASE_URL`, `NG_SUPABASE_ANON_KEY`,
`NG_BLIZZARD_CLIENT_ID`, `NG_BLIZZARD_REDIRECT_URI`. Los secretos (`service_role`, `client_secret`)
nunca van al frontend: viven en Supabase o en la máquina que ejecuta el importador.

- Supabase y Vercel: [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md)
- Blizzard API: [`docs/api/BLIZZARD.md`](docs/api/BLIZZARD.md)
- Arquitectura: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)
- Diseño visual: [`docs/architecture/DESIGN.md`](docs/architecture/DESIGN.md)
