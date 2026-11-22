# WoW MountDex — Arquitectura

## 1. Resumen

WoW MountDex es una SPA en **Angular 19** (standalone components + signals) que se publica
como sitio estático en **Vercel**. Los datos de usuario viven en **Supabase**
(PostgreSQL + Auth + RLS) y la integración con Blizzard se resuelve con una
**Supabase Edge Function** para no exponer secretos en el navegador.

```
 Navegador (Angular)                    Supabase                       Blizzard
 ───────────────────                    ────────                       ────────
 CatalogService ──── lee ────────────▶  mounts / expansions / ...      (catálogo importado
   └─ fallback: /data/catalog.json      (solo lectura, RLS)             con scripts/import)
 CollectionService ─ guest: localStorage
                    └ user: user_mounts / farming_attempts (RLS por user_id)
 AuthService ─────── Supabase Auth (email + password, reset)
 BlizzardService ─── OAuth authorize (client_id público) ───────────▶ oauth.battle.net
                    └ code ──▶ Edge Function `blizzard-import` ──────▶ token + /profile/user/wow/collections/mounts
                                (client_secret solo en el servidor)
```

## 2. Decisiones técnicas

| Decisión | Motivo |
|---|---|
| Angular standalone + signals | Estado reactivo simple sin NgRx; menos boilerplate. |
| Rutas con lazy loading (`loadComponent`) | Cada sección se descarga bajo demanda. |
| Catálogo con dos orígenes (`CatalogSource`) | Funciona sin backend (JSON estático) y usa Supabase cuando está configurado. |
| Colección offline-first | Invitados usan `localStorage`; al iniciar sesión se fusiona con la nube (gana el `updated_at` más reciente, upsert por `(user_id, mount_id)` → sin duplicados). |
| Sin backend Node propio | Supabase + Edge Functions cubren la fase inicial. `docs/api/` describe cómo añadir Express si hiciera falta. |
| Configuración por variables de entorno en build | `scripts/set-env.mjs` genera `runtime-config.ts` a partir de `.env` / variables de Vercel. Sólo valores públicos (URL, anon key, client id). |
| Sin datos inventados | Probabilidad, rareza, dificultad y coordenadas son `null` salvo fuente verificable; la UI muestra "Desconocido". |
| Sonido por Web Audio | Pitidos sintetizados, sin assets con licencia dudosa. Desactivado por defecto. |
| Iconos | Si no hay `icon_url` verificado se dibuja un sprite generado (iniciales + color de expansión). Los iconos importados vienen del endpoint oficial de media de Blizzard. |

## 3. Capas del frontend

```
src/app/
  core/
    config/       runtime-config (generado), app constants
    models/       interfaces de dominio (Mount, Expansion, Location, UserMountState...)
    services/     catalog, collection, auth, supabase, sync, blizzard, sound, recent, toast
    guards/       authGuard, guestOnlyGuard
    utils/        filtros, estadísticas, hitos, CSV/JSON (funciones puras + tests)
  shared/
    components/   sprite, progress-bar, screen-panel, mount-row, filter-bar, empty-state, led...
  features/
    home, pokedex, mount-detail, expansions, locations, acquisition-methods,
    collection (estadísticas + hitos + export/import), favorites, objectives,
    secrets, authentication, profile, blizzard
```

La lógica de negocio (filtrar, ordenar, estadísticas, hitos, fusión de colecciones, CSV)
vive en `core/utils/*.ts` como funciones puras, cubiertas por tests unitarios. Los
componentes sólo orquestan.

## 4. Modelo de datos

Ver `database/migrations/`. Tablas: `expansions`, `locations`, `mounts`, `mount_sources`,
`mount_locations`, `mount_references`, `profiles`, `characters`, `user_mounts`,
`farming_attempts`. El número de registro de la MountDex es `mounts.id` y es estable;
`mounts.blizzard_id` enlaza con el ID oficial de Blizzard (único, opcional).

## 5. Rareza vs. probabilidad

- `probability_percentage` + `probability_status` (`published` | `community` | `unverified` | `unknown`) + `probability_source`.
- `rarity` es una clasificación editorial independiente (`common` → `legendary`) y puede ser `null`.
- `farm_difficulty` y `lockout` (`daily`/`weekly`) son atributos separados.
La UI nunca deriva una cosa de la otra.

## 6. Futuras expansiones

Las expansiones son filas en `expansions` con `sort_order`. Añadir una nueva expansión
= insertar una fila + importar sus monturas. La UI no tiene listas codificadas de
expansiones salvo el catálogo inicial (en datos, no en código).

## 7. PWA

El build es estático y con rutas reescritas a `index.html`. Para convertirlo en PWA:
`ng add @angular/pwa` (añade service worker y manifest). No se incluye todavía para no
cachear agresivamente durante el desarrollo.
