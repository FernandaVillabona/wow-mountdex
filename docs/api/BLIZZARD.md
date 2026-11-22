# Integración con Blizzard (Battle.net)

Documentación oficial: <https://develop.battle.net/documentation>

## Qué se usa

| Necesidad | API | Autenticación |
|---|---|---|
| Catálogo de monturas | Game Data API: `GET /data/wow/mount/index`, `GET /data/wow/mount/{id}`, `GET /data/wow/media/creature-display/{id}` — namespace `static-{region}` | Client Credentials |
| Monturas del jugador | Profile API: `GET /profile/user/wow/collections/mounts` — namespace `profile-{region}` | Authorization Code, scope `wow.profile` |

Endpoints OAuth: `https://oauth.battle.net/authorize` y `https://oauth.battle.net/token`.

## Limitaciones conocidas (no se asumen datos que la API no da)

- La API **no** expone probabilidades de drop, coordenadas ni expansión de origen.
- `source.type` es genérico (`DROP`, `VENDOR`, `ACHIEVEMENT`…) y no indica el jefe concreto.
- La colección del jugador es por cuenta y región; una cuenta sin personajes en la región devuelve 404 (se trata como colección vacía).
- Los nombres dependen del `locale`. El emparejamiento fiable es por `blizzard_id`; por nombre solo como respaldo para el catálogo de demostración.

## Flujo implementado

```
Angular (/coleccion)                       Battle.net                  Edge Function blizzard-import
  │ genera state aleatorio (sessionStorage)
  │ redirige a /authorize?client_id&redirect_uri&scope=wow.profile&state
  │ ───────────────────────────────────────▶ usuario autoriza
  │ ◀─── /blizzard/callback?code&state
  │ valida state
  │ supabase.functions.invoke('blizzard-import', {code, region, redirectUri}) ─▶ token (client_secret)
  │                                                                             └▶ /profile/user/wow/collections/mounts
  │ ◀──────────────────────────────────────────────────────────── { mounts: [{id, name}] }
  │ empareja con el catálogo y marca "obtenida" (sin borrar marcas manuales)
```

- No se almacena la contraseña ni el token de Blizzard.
- El `client_secret` vive solo como secreto de Supabase.
- `redirectUri` se valida contra una lista blanca (`ALLOWED_REDIRECT_URIS`).

## Activación

1. <https://develop.battle.net/access/clients> → **Create Client**.
   Redirect URLs: `http://localhost:4200/blizzard/callback` y `https://tu-dominio.vercel.app/blizzard/callback`.
2. Secretos de la función:
   ```bash
   supabase secrets set BLIZZARD_CLIENT_ID=... BLIZZARD_CLIENT_SECRET=... \
     ALLOWED_REDIRECT_URIS="http://localhost:4200/blizzard/callback,https://tu-dominio.vercel.app/blizzard/callback"
   supabase functions deploy blizzard-import
   ```
3. Frontend: `NG_BLIZZARD_CLIENT_ID` y `NG_BLIZZARD_REDIRECT_URI` (en `.env` o Vercel).

Hasta completar estos pasos, la sección "Importar desde Battle.net" indica exactamente qué falta y no muestra el botón.

## Importar el catálogo oficial

```bash
BLIZZARD_CLIENT_ID=... BLIZZARD_CLIENT_SECRET=... \
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/import-blizzard-catalog.mjs --region us --locale en_US
```

- `--dry-run` muestra las primeras filas sin escribir.
- Actualiza monturas existentes (por `blizzard_id` o nombre) y añade las nuevas con el siguiente nº de registro.
- Después, un editor debe curar `expansion_id`, `mount_sources`, `mount_locations` y, si hay fuente fiable,
  `drop_percentage` + `probability_status` + `probability_source` (la restricción SQL impide porcentajes sin fuente).
- Las imágenes son las del endpoint oficial de media de Blizzard; respeta sus *API Terms of Use*.

## Futuro: API propia (Node + Express)

Si se necesita lógica que no encaje en Edge Functions (cola de importaciones, caché de la Game Data API,
panel de edición del catálogo), crear `backend/` con Express que use la `service_role` key solo en el servidor
y exponer rutas `/api/*`. El frontend ya aísla el acceso a datos en servicios (`CatalogService`,
`CollectionService`, `BlizzardService`), así que bastaría con cambiar su implementación.
