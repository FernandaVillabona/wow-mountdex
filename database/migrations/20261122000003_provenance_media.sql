-- WoW MountDex — fuentes, procedencia por campo, multimedia e informes de importación.
-- Idempotente en lo posible (if not exists) para poder re-ejecutarse.

-- ───────── Registro de fuentes ─────────
create table if not exists public.data_sources (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  name        text not null,
  url         text not null check (url ~ '^https://'),
  license     text,
  kind        text not null check (kind in ('official','client-data','community','reference')),
  notes       text
);

insert into public.data_sources (id, name, url, license, kind, notes) values
  ('blizzard-api', 'Blizzard Game Data API', 'https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis', 'Blizzard Developer API Terms of Use', 'official', null),
  ('blizzard-render', 'Blizzard render CDN', 'https://render.worldofwarcraft.com', 'Blizzard Developer API Terms of Use', 'official', 'Iconos oficiales por nombre'),
  ('wago-tools', 'wago.tools (tablas DB2 del cliente de WoW)', 'https://wago.tools', null, 'client-data', 'Datos extraídos del cliente oficial'),
  ('simple-armory', 'Simple Armory', 'https://github.com/kevinclement/SimpleArmory', 'MIT', 'community', 'Lista curada, expansión, categoría e icono'),
  ('rarity', 'Rarity (addon)', 'https://github.com/WowRarity/Rarity', 'GPL-2.0', 'community', 'Probabilidades de drop estimadas por la comunidad'),
  ('warcraft-wiki', 'Warcraft Wiki', 'https://warcraft.wiki.gg', 'CC BY-SA 4.0', 'reference', 'Solo enlaces'),
  ('wowhead', 'Wowhead', 'https://www.wowhead.com', null, 'reference', 'Solo enlaces; sin extracción'),
  ('icy-veins', 'Icy Veins', 'https://www.icy-veins.com/wow/', null, 'reference', 'Solo enlaces; sin extracción'),
  ('demo', 'Catálogo de demostración', 'https://github.com/FernandaVillabona/wow-mountdex', null, 'community', 'Datos iniciales pendientes de verificación')
on conflict (id) do update set name = excluded.name, url = excluded.url, license = excluded.license, kind = excluded.kind, notes = excluded.notes;

-- ───────── Montura: campos oficiales adicionales ─────────
alter table public.mounts add column if not exists spell_id integer;
alter table public.mounts add column if not exists item_id integer;
alter table public.mounts add column if not exists source_text text;          -- texto de origen del Diario de monturas (oficial)
alter table public.mounts add column if not exists category text;             -- subcategoría (comunitaria)
alter table public.mounts add column if not exists last_imported_at timestamptz;

-- ───────── Fuentes de obtención: identificadores y coordenadas ─────────
alter table public.mount_sources add column if not exists npc_id integer;
alter table public.mount_sources add column if not exists encounter_id integer;
alter table public.mount_sources add column if not exists instance_id integer;
alter table public.mount_sources add column if not exists instance_name text;
alter table public.mount_sources add column if not exists zone_name text;
alter table public.mount_sources add column if not exists ui_map_id integer;
alter table public.mount_sources add column if not exists map_x numeric(6,3) check (map_x is null or (map_x >= 0 and map_x <= 100));
alter table public.mount_sources add column if not exists map_y numeric(6,3) check (map_y is null or (map_y >= 0 and map_y <= 100));
alter table public.mount_sources add column if not exists coordinates_kind text check (coordinates_kind in ('instance','world'));
alter table public.mount_sources add column if not exists data_source_id text references public.data_sources (id);
alter table public.mount_sources add column if not exists trust text check (trust in ('official','verified','community','pending','outdated','unknown'));
alter table public.mount_sources add column if not exists fetched_at timestamptz;

alter table public.locations add column if not exists natural_key text unique;

-- ───────── Multimedia ─────────
create table if not exists public.mount_media (
  id              bigint generated always as identity primary key,
  mount_id        integer not null references public.mounts (id) on update cascade on delete cascade,
  kind            text not null check (kind in ('icon','render','zoom')),
  url             text not null check (url ~ '^https://'),
  resource_id     text,
  data_source_id  text not null references public.data_sources (id),
  status          text not null check (status in ('verified','unverified','broken')),
  checked_at      timestamptz,
  unique (mount_id, kind)
);

-- ───────── Procedencia por campo ─────────
create table if not exists public.field_provenance (
  mount_id        integer not null references public.mounts (id) on update cascade on delete cascade,
  field           text not null,
  data_source_id  text not null references public.data_sources (id),
  source_url      text,
  info_type       text not null,
  trust           text not null check (trust in ('official','verified','community','pending','outdated','unknown')),
  fetched_at      timestamptz not null,
  verified_at     timestamptz,
  primary key (mount_id, field)
);

-- ───────── Informes de importación (solo service_role) ─────────
create table if not exists public.import_runs (
  id           bigint generated always as identity primary key,
  started_at   timestamptz not null,
  finished_at  timestamptz,
  dry_run      boolean not null,
  report       jsonb not null
);

-- ───────── Permitir renumerar monturas (demo → ID oficial) sin perder colecciones ─────────
do $$
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl
    from pg_constraint c
    where c.confrelid = 'public.mounts'::regclass and c.contype = 'f' and c.confupdtype <> 'c'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (mount_id) references public.mounts (id) on update cascade on delete cascade',
      r.tbl, r.conname);
  end loop;
end $$;

-- ───────── RLS y permisos ─────────
alter table public.data_sources     enable row level security;
alter table public.mount_media      enable row level security;
alter table public.field_provenance enable row level security;
alter table public.import_runs      enable row level security;

drop policy if exists "catalog read" on public.data_sources;
drop policy if exists "catalog read" on public.mount_media;
drop policy if exists "catalog read" on public.field_provenance;
create policy "catalog read" on public.data_sources     for select to anon, authenticated using (true);
create policy "catalog read" on public.mount_media      for select to anon, authenticated using (true);
create policy "catalog read" on public.field_provenance for select to anon, authenticated using (true);
-- import_runs: sin políticas → solo service_role.

revoke all on public.data_sources, public.mount_media, public.field_provenance, public.import_runs from anon, authenticated;
grant select on public.data_sources, public.mount_media, public.field_provenance to anon, authenticated;
