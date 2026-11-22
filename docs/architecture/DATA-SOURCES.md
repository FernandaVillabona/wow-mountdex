# Fuentes de datos y política de veracidad

## Fuentes

| Fuente | Uso | Condiciones |
|---|---|---|
| **Blizzard Game Data API** (`/data/wow/mount/index`, `/data/wow/mount/{id}`, `/data/wow/media/creature-display/{id}`) | Catálogo oficial: ID, nombre, descripción, tipo de fuente (`DROP`, `VENDOR`, `ACHIEVEMENT`...), facción, imagen del modelo. | Requiere credenciales del Developer Portal. Cumplir los *Blizzard Developer API Terms of Use*; mostrar atribución; no revender datos. |
| **Blizzard Profile API** (`/profile/user/wow/collections/mounts`, scope `wow.profile`) | Monturas obtenidas por la cuenta del jugador. | OAuth Authorization Code. Sólo el servidor usa el `client_secret`. |
| **Warcraft Wiki** (warcraft.wiki.gg) | Referencia humana para jefe, instancia, zona, expansión. | Contenido CC BY-SA: se enlaza, no se copia texto. |
| **Wowhead** | Referencia humana (probabilidades reportadas por la comunidad). | No se hace scraping. Sólo enlaces y datos introducidos manualmente con su fuente. |

## Lo que la API oficial **no** proporciona

- Probabilidad de drop → sólo datos curados manualmente con `probability_source`.
- Expansión de origen de cada montura → curado (`expansion_id` puede quedar `NULL` → "Sin clasificar").
- Coordenadas y jefe concreto → curado manualmente (`mount_sources`, `locations`).
- Rareza/dificultad → clasificación editorial, opcional.

## Catálogo de demostración

`frontend/public/data/catalog.json` contiene un **catálogo de demostración** pequeño
(`"isDemo": true`). Reglas aplicadas:

- Solo monturas con jefe/instancia/zona ampliamente documentados.
- `probability.status = "unknown"` en todas: no se publica ningún porcentaje.
- Sin coordenadas, sin rareza, sin dificultad.
- `verifiedAt = null` → la UI muestra "Pendiente de verificación".
- Cada montura enlaza a una búsqueda en Warcraft Wiki y Wowhead para que un editor la verifique.

Para tener el catálogo real y completo, ejecutar `scripts/import-blizzard-catalog.mjs`
(ver `docs/api/BLIZZARD.md`).
