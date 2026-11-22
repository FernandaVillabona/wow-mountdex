# Integración de fuentes reales — investigación y diseño

Investigación realizada el 2026-11-22. Cada fila se comprobó con peticiones reales
(HTTP 200 y estructura de respuesta) o leyendo la documentación/políticas publicadas.
Lo que no se pudo verificar se indica como tal.

## 1. Matriz de fuentes

| Fuente | API disponible | Información disponible (comprobada) | Autenticación | Limitaciones |
|---|---|---|---|---|
| **Blizzard Game Data API** | Sí, oficial. `GET /data/wow/mount/index`, `/data/wow/mount/{id}`, `/data/wow/search/mount`, `/data/wow/journal-encounter/{id}`, `/data/wow/journal-instance/{id}`, `/data/wow/journal-expansion/index`, `/data/wow/media/creature-display/{id}`, `/data/wow/media/item/{id}`, `/data/wow/media/spell/{id}` (namespace `static-{region}`) | Catálogo oficial, nombres y descripciones localizados, tipo de fuente, facción, **renders del modelo** (creature-display), iconos (item/spell media), jefes e instancias del Encounter Journal | OAuth **Client Credentials** (`client_id` + `client_secret`) | 36.000 peticiones/hora y 100/s (429 al superar). Requiere cuenta con 2FA y aceptar los *Developer API Terms of Use*. Sin probabilidades ni coordenadas de mundo. **Pendiente: credenciales del proyecto.** |
| **Blizzard Profile API** | Sí, oficial. `GET /profile/user/wow/collections/mounts` (cuenta) y `GET /profile/wow/character/{realm}/{name}/collections/mounts` (personaje) | Monturas obtenidas por el jugador | Cuenta: **Authorization Code** con scope `wow.profile` (`https://oauth.battle.net/authorize` / `/token`). Personaje: no confirmado si basta Client Credentials | Mismo límite. APAC sustituye a las regiones KR/TW en OAuth. |
| **Blizzard render CDN** | Sí (archivos estáticos) | Iconos oficiales por nombre: `https://render.worldofwarcraft.com/us/icons/{36\|56}/{icon}.jpg` → 200 `image/jpeg` | Ninguna | El nombre del icono debe venir de una fuente (Blizzard media o Simple Armory). Se verifica cada URL con `HEAD`. |
| **wago.tools** (datos del cliente del juego) | Sí. Documentado en `/apis` (`/api/builds`, `/api/maps`, `/api/map/{mapID}` PNG). Exportación de tablas DB2 en `/db2/{Tabla}/csv` (comprobada) | `Mount` (ID oficial, nombre, **descripción**, **texto de origen del Diario de monturas**: Vendedor/Zona/Coste/Drop/Logro…, `SourceTypeEnum`, `SourceSpellID`), `MountXDisplay`, `ItemEffect` (objeto ↔ hechizo), `JournalEncounterItem` (objeto ↔ jefe), `JournalEncounter` (**jefe + coordenadas en el mapa de la instancia** + `UiMapID`), `JournalInstance`, `JournalTier(XInstance)` (expansión), `AreaTable`, `UiMap` | Ninguna | Sin términos de uso publicados ("All rights reserved"). Son datos extraídos del cliente de Blizzard: se citan como **oficiales (cliente)**, se descargan pocas tablas por importación y se cachean. Las coordenadas del Diario son del **mapa de la instancia**, no del mundo. |
| **Simple Armory** | Sin API; repositorio público **MIT** con `static/data/mounts.json` y `planner.json` | 1.658 monturas con **ID oficial de montura**, `spellid`, `itemId`, **nombre de icono**, facción, `notObtainable`, `notReleased`, agrupadas por **expansión** y subcategoría (Raid Drop, Dungeon Drop, Rare Spawn, Riddle…) | Ninguna (raw GitHub) | Clasificación comunitaria. Atribución MIT obligatoria. No se copia su aplicación, solo se consumen sus datos. |
| **Rarity (addon)** | Sin API; repositorio público **GPL-2.0**, base de datos en `DB/Mounts/*.lua` | **Probabilidad de drop** (`chance = N` → 1/N), NPC IDs, `lockBossName`, dificultades, coordenadas con `uiMapID` e indicador de instancia | Ninguna (raw GitHub) | Estimaciones **comunitarias**. Se almacenan como hechos con atribución, nunca como oficiales. Formato Lua (se parsea un subconjunto). |
| **Warcraft Wiki** (wiki.gg) | Sí, MediaWiki API `https://warcraft.wiki.gg/api.php` (comprobada, `action=query`) | Existencia y URL canónica de la página de cada montura, fecha de revisión, wikitexto | Ninguna. User-Agent identificativo | Contenido **CC BY-SA 4.0**: se **enlaza**, no se copia texto. Peticiones por lotes de 50 títulos. |
| **Wowhead** | **No** hay API pública documentada. El script de tooltips existe (`wow.zamimg.com/js/tooltips.js`) | — | — | `robots.txt` bloquea Scrapy, img2dataset y bots de IA. No se encontró la página de términos. **No se extraen datos**: solo enlaces de búsqueda/objeto. |
| **Icy Veins** | **No** | Guías editoriales | — | No se pudo leer su página de términos (403). **Solo enlaces**, sin extracción. |

## 2. Fuentes seleccionadas y uso

| Dato | Fuente principal | Confianza | Respaldo |
|---|---|---|---|
| ID, nombre, descripción, texto de origen | wago.tools `Mount` | Oficial (cliente) | Blizzard Game Data API |
| Lista de monturas obtenibles | Simple Armory (excluye monturas de prueba) | Comunitario | — |
| Expansión | Encounter Journal (`JournalTier`) para drops de jefe; Simple Armory para el resto | Oficial / Comunitario | — |
| Jefe, instancia, coordenadas del jefe | wago.tools (`ItemEffect` → `JournalEncounterItem` → `JournalEncounter` → `JournalInstance`) | Oficial (cliente) | Rarity (`coords`) |
| Vendedor, zona, coste, logro, reputación, profesión | Texto de origen oficial del Diario de monturas | Oficial (cliente) | — |
| Icono | Nombre de Simple Armory + CDN oficial de Blizzard, comprobado con `HEAD` | Verificado | — |
| Render del modelo | Blizzard `media/creature-display` | Oficial | Requiere credenciales |
| Probabilidad de drop | Rarity (`chance`) | Comunitario | — |
| Enlaces de referencia | Warcraft Wiki (página comprobada por API), Wowhead (`/mount/{id}`), Icy Veins (búsqueda) | — | — |

## 3. Arquitectura de integración

```
scripts/importer/
  index.mjs              orquestador: fetch → normalize → link → diff → report → (apply)
  lib/http.mjs           fetch con caché en disco, reintentos, límite por proveedor, User-Agent
  lib/csv.mjs, lib/lua.mjs   parsers
  adapters/
    wago.mjs             tablas DB2 del cliente
    simplearmory.mjs     lista curada + expansión/categoría + icono
    rarity.mjs           probabilidades comunitarias
    wiki.mjs             URLs verificadas de Warcraft Wiki
    blizzard.mjs         (opcional) renders e iconos oficiales vía Game Data API
    media.mjs            verificación HEAD de URLs de imagen
  normalize.mjs          registro canónico por blizzard_id + procedencia por campo
  sinks/
    json.mjs             frontend/public/data/catalog.json (modo sin Supabase)
    supabase.mjs         upsert idempotente con service_role (solo en local/CI)
  report.mjs             reports/import-YYYYMMDD-HHMM.{json,md}
```

Principios:
- **Nada se consulta desde Angular a fuentes externas.** El navegador solo lee Supabase o el JSON generado.
- **Caché en disco** (`.cache/importer`, 24 h por defecto) para no repetir descargas.
- **Idempotencia**: la clave es el ID oficial de montura (`blizzard_id`); repetir la importación actualiza, no duplica.
- **Procedencia**: cada dato guarda fuente, URL, tipo, fecha de consulta y estado de confianza.
- **Secretos**: `SUPABASE_SERVICE_ROLE_KEY`, `BLIZZARD_CLIENT_SECRET` solo en variables de entorno de la máquina que importa.

## 4. Estados de confianza

`official` (Blizzard API o datos del cliente) · `verified` (comprobado automáticamente, p. ej. URL que responde 200)
· `community` (Simple Armory, Rarity) · `pending` · `outdated` · `unknown`.

## 5. Límites conocidos (se muestran como "desconocido")

- Coordenadas de **mundo** de vendedores y NPC: el cliente no las expone en tablas descargadas; solo hay coordenadas de jefes en mapas de instancia (Encounter Journal) y las coordenadas comunitarias de Rarity.
- Probabilidades **oficiales**: Blizzard no las publica salvo excepciones; solo hay estimaciones comunitarias.
- Renders 3D: requieren credenciales de Blizzard.
