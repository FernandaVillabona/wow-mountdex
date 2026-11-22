-- WoW MountDex — Row Level Security
-- Catálogo: lectura pública, escritura solo con service_role (que ignora RLS).
-- Datos personales: cada usuario solo ve y modifica sus propias filas.

alter table public.expansions       enable row level security;
alter table public.locations        enable row level security;
alter table public.mounts           enable row level security;
alter table public.mount_sources    enable row level security;
alter table public.mount_locations  enable row level security;
alter table public.mount_references enable row level security;
alter table public.profiles         enable row level security;
alter table public.characters       enable row level security;
alter table public.user_mounts      enable row level security;
alter table public.farming_attempts enable row level security;

-- Catálogo de solo lectura
create policy "catalog read" on public.expansions       for select to anon, authenticated using (true);
create policy "catalog read" on public.locations        for select to anon, authenticated using (true);
create policy "catalog read" on public.mounts           for select to anon, authenticated using (true);
create policy "catalog read" on public.mount_sources    for select to anon, authenticated using (true);
create policy "catalog read" on public.mount_locations  for select to anon, authenticated using (true);
create policy "catalog read" on public.mount_references for select to anon, authenticated using (true);

-- Perfiles
create policy "profile select own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profile update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Personajes
create policy "characters own" on public.characters
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Colección
create policy "user_mounts own" on public.user_mounts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Intentos de farmeo
create policy "farming_attempts own" on public.farming_attempts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Privilegios explícitos. No dependen de la opción "Grant API access to new tables
-- automatically" del proyecto: RLS decide QUÉ filas, estos GRANT deciden QUÉ operaciones.
grant usage on schema public to anon, authenticated;

-- Catálogo: solo lectura para todos.
revoke insert, update, delete on public.expansions, public.locations, public.mounts,
  public.mount_sources, public.mount_locations, public.mount_references from anon, authenticated;
grant select on public.expansions, public.locations, public.mounts,
  public.mount_sources, public.mount_locations, public.mount_references to anon, authenticated;

-- Datos personales: nada para anon; CRUD para usuarios autenticados (filtrado por RLS).
revoke all on public.profiles, public.characters, public.user_mounts, public.farming_attempts from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.characters, public.user_mounts, public.farming_attempts to authenticated;
grant usage, select on all sequences in schema public to authenticated;
