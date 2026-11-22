-- WoW MountDex — esquema inicial
-- Catálogo global (solo lectura para usuarios) + datos personales por usuario.

create extension if not exists pgcrypto;

-- ───────────────────────── Utilidades ─────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────────────────────── Catálogo ─────────────────────────
create table public.expansions (
  id            integer primary key,
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name          text not null,
  short_name    text not null,
  sort_order    integer not null,
  description   text,
  release_date  date,
  image_url     text,
  color         text not null default '#7a7a7a' check (color ~ '^#[0-9a-fA-F]{6}$')
);

create table public.locations (
  id           integer primary key,
  continent    text not null,
  region       text,
  zone         text not null,
  dungeon      text,
  raid         text,
  map_id       integer,
  -- "x, y" en % del mapa (0-100). Solo datos verificados.
  coordinates  text check (coordinates is null or coordinates ~ '^\d{1,2}(\.\d+)?, ?\d{1,2}(\.\d+)?$')
);
create index locations_continent_idx on public.locations (continent);
create index locations_zone_idx on public.locations (zone);

create table public.mounts (
  id                   integer primary key,           -- Nº de registro MountDex
  blizzard_id          integer unique,                -- ID oficial de la Game Data API
  slug                 text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name                 text not null,
  description          text,
  icon_url             text,
  image_url            text,
  expansion_id         integer references public.expansions (id) on update cascade on delete set null,
  mount_type           text not null default 'unknown'
                       check (mount_type in ('ground','flying','aquatic','skyriding','unknown')),
  rarity               text check (rarity in ('common','uncommon','rare','epic','legendary')),
  difficulty           text check (difficulty in ('easy','medium','hard','extreme')),
  availability_status  text not null default 'unknown'
                       check (availability_status in ('available','unavailable','limited','unknown')),
  lockout              text check (lockout in ('daily','weekly','none')),
  limited_attempts     boolean not null default false,
  faction              text check (faction in ('alliance','horde')),
  acquisition_method   text not null default 'unknown',   -- método principal
  acquisition_methods  text[] not null default '{}',       -- todos los métodos
  drop_percentage      numeric(7,4) check (drop_percentage is null or (drop_percentage > 0 and drop_percentage <= 100)),
  probability_status   text not null default 'unknown'
                       check (probability_status in ('published','community','unverified','unknown')),
  probability_source   text,
  known_attempts       integer check (known_attempts is null or known_attempts > 0),
  tips                 text,
  external_reference   text,
  source_verified_at   timestamptz,
  is_demo              boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- No se puede publicar un porcentaje sin fuente, ni marcar "desconocida" con porcentaje.
  constraint mounts_probability_consistency check (
    (probability_status = 'unknown' and drop_percentage is null)
    or (probability_status <> 'unknown' and drop_percentage is not null and probability_source is not null)
  )
);
create index mounts_expansion_idx on public.mounts (expansion_id);
create index mounts_methods_idx on public.mounts using gin (acquisition_methods);
create index mounts_name_idx on public.mounts (lower(name));
create trigger mounts_updated_at before update on public.mounts
  for each row execute function public.set_updated_at();

create table public.mount_sources (
  id                      bigint generated always as identity primary key,
  mount_id                integer not null references public.mounts (id) on delete cascade,
  source_type             text not null,
  npc_name                text,
  boss_name               text,
  vendor_name             text,
  achievement_name        text,
  reputation_requirement  text,
  currency_requirement    text,
  requirements            text,
  instructions            text,
  source_url              text
);
create index mount_sources_mount_idx on public.mount_sources (mount_id);

create table public.mount_locations (
  mount_id     integer not null references public.mounts (id) on delete cascade,
  location_id  integer not null references public.locations (id) on delete cascade,
  primary key (mount_id, location_id)
);
create index mount_locations_location_idx on public.mount_locations (location_id);

create table public.mount_references (
  id        bigint generated always as identity primary key,
  mount_id  integer not null references public.mounts (id) on delete cascade,
  label     text not null,
  url       text not null check (url ~ '^https://'),
  unique (mount_id, url)
);

-- ───────────────────────── Usuarios ─────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique check (char_length(username) between 3 and 24),
  avatar_url  text check (avatar_url is null or avatar_url ~ '^https://'),
  region      text not null default 'us' check (region in ('us','eu','kr','tw')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.characters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 12),
  realm       text not null check (char_length(realm) between 2 and 40),
  region      text not null check (region in ('us','eu','kr','tw')),
  created_at  timestamptz not null default now(),
  unique (user_id, name, realm, region)
);
create index characters_user_idx on public.characters (user_id);

create table public.user_mounts (
  id               bigint generated always as identity primary key,
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mount_id         integer not null references public.mounts (id) on delete cascade,
  obtained         boolean not null default false,
  favorite         boolean not null default false,
  target           boolean not null default false,
  target_priority  smallint not null default 2 check (target_priority between 1 and 3),
  obtained_at      timestamptz,
  notes            text not null default '' check (char_length(notes) <= 2000),
  updated_at       timestamptz not null default now(),
  unique (user_id, mount_id)          -- evita duplicados en la colección
);
create index user_mounts_user_idx on public.user_mounts (user_id);

create table public.farming_attempts (
  id               bigint generated always as identity primary key,
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mount_id         integer not null references public.mounts (id) on delete cascade,
  attempts         integer not null default 0 check (attempts between 0 and 100000),
  last_attempt_at  timestamptz,
  notes            text not null default '' check (char_length(notes) <= 2000),
  updated_at       timestamptz not null default now(),
  unique (user_id, mount_id)
);
create index farming_attempts_user_idx on public.farming_attempts (user_id);

-- Crea el perfil automáticamente al registrarse.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      case when wanted is not null and not exists (select 1 from public.profiles where username = wanted)
           then left(wanted, 24) end,
      'aventurero-' || left(replace(new.id::text, '-', ''), 8)
    )
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
