# Despliegue

Arquitectura: **GitHub** (código) → **Vercel** (sitio estático Angular) + **Supabase** (BD, Auth, Edge Functions).

## 1. Supabase

1. Crea un proyecto en <https://supabase.com/dashboard>.
2. **SQL Editor** → ejecuta en orden:
   1. `database/migrations/20261122000001_schema.sql`
   2. `database/migrations/20261122000002_rls.sql`
   3. (opcional) `database/seeds/002_demo_catalog.sql` — catálogo de demostración.
   > Las migraciones incluyen sus propios `GRANT`, así que funcionan aunque al crear el proyecto se deje desmarcado *Grant API access to new tables automatically*.
   > Con la CLI: `supabase link --project-ref <ref>`, copia los archivos de `database/migrations/` a `supabase/migrations/` y ejecuta `supabase db push`.
3. **Authentication → URL Configuration**
   - *Site URL*: `https://tu-dominio.vercel.app`
   - *Redirect URLs*: `http://localhost:4200/**`, `https://tu-dominio.vercel.app/**`
4. **Authentication → Providers → Email**: activa *Confirm email* (recomendado).
5. **Project Settings → API**: copia `Project URL` y la clave `anon public`.
   La `service_role` key **no** va nunca al frontend ni a Vercel.

### Comprobar RLS

```sql
-- Como usuario anónimo no debe poder escribir en el catálogo:
set role anon;
insert into public.mounts (id, slug, name) values (9999, 'x', 'x'); -- ERROR: permission denied
reset role;
```

## 2. Vercel

1. Sube el repositorio a GitHub.
2. En Vercel: **Add New → Project → Import** el repositorio. `vercel.json` ya define:
   - install: `npm ci --prefix frontend`
   - build: `npm run build --prefix frontend` (ejecuta `scripts/set-env.mjs` antes)
   - output: `frontend/dist/frontend/browser`
   - reescritura SPA hacia `index.html` y cabeceras de seguridad.
3. **Settings → Environment Variables** (Production y Preview):

   | Variable | Valor |
   |---|---|
   | `NG_SUPABASE_URL` | URL del proyecto Supabase |
   | `NG_SUPABASE_ANON_KEY` | clave anon public |
   | `NG_BLIZZARD_CLIENT_ID` | (opcional) client id de Battle.net |
   | `NG_BLIZZARD_REDIRECT_URI` | `https://tu-dominio.vercel.app/blizzard/callback` |

4. Cada push a `main` genera un despliegue de producción; cada PR, un *preview*.
5. **Dominio propio**: *Settings → Domains → Add*. Actualiza después la Site URL de Supabase y la Redirect URL de Blizzard.

Sin variables de Supabase la app funciona igualmente en **modo local** (invitado, catálogo estático).

## 3. Edge Function de Blizzard

Ver `docs/api/BLIZZARD.md`.

## 4. PWA (opcional, futuro)

```bash
cd frontend
npx ng add @angular/pwa
```
Revisa `ngsw-config.json` para no cachear `data/catalog.json` de forma permanente.
