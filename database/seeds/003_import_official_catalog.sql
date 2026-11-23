-- WoW MountDex — importación del catálogo oficial SIN claves secretas.
-- Se ejecuta en el SQL Editor de Supabase (rol postgres). Descarga el catalog.json generado por
-- scripts/importer (fuentes: wago.tools, Simple Armory, Rarity, Warcraft Wiki, Blizzard render CDN)
-- desde el repositorio público y lo aplica de forma idempotente:
--   1) renumera las monturas de demostración a su ID oficial (las colecciones siguen por ON UPDATE CASCADE),
--   2) upsert de ubicaciones y monturas,
--   3) reemplaza fuentes, ubicaciones, referencias, multimedia y procedencia de cada montura importada.
-- Requiere la migración 20261122000003_provenance_media.sql.
create extension if not exists http with schema extensions;

do $$
declare
  cat jsonb;
  k text;
  v int;
  ids int[];
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '120');
  select content::jsonb into cat
  from extensions.http_get('https://raw.githubusercontent.com/FernandaVillabona/wow-mountdex/main/frontend/public/data/catalog.json');
  if cat is null or jsonb_array_length(cat->'mounts') < 100 then
    raise exception 'catalog.json no válido';
  end if;

  -- 1) Demo → ID oficial (paso intermedio por IDs negativos para evitar choques)
  for k, v in select key, value::int from jsonb_each_text(cat->'legacyIds') loop
    update public.mounts set id = -k::int, slug = 'legacy-' || k where id = k::int and is_demo;
  end loop;
  for k, v in select key, value::int from jsonb_each_text(cat->'legacyIds') loop
    if not exists (select 1 from public.mounts where id = v) then
      update public.mounts set id = v where id = -k::int;
    end if;
  end loop;

  -- 2) Ubicaciones
  insert into public.locations (id, continent, region, zone, dungeon, raid, map_id, coordinates)
  select x.id, x.continent, x.region, x.zone, x.dungeon, x.raid, x."mapId", null
  from jsonb_to_recordset(cat->'locations') as x(id int, continent text, region text, zone text, dungeon text, raid text, "mapId" int)
  on conflict (id) do update set continent = excluded.continent, region = excluded.region, zone = excluded.zone,
    dungeon = excluded.dungeon, raid = excluded.raid, map_id = excluded.map_id;

  -- 3) Monturas
  insert into public.mounts (
    id, blizzard_id, slug, name, description, icon_url, image_url, expansion_id, mount_type, rarity, difficulty,
    availability_status, lockout, limited_attempts, faction, acquisition_method, acquisition_methods,
    drop_percentage, probability_status, probability_source, known_attempts, tips, external_reference,
    source_verified_at, is_demo, spell_id, item_id, source_text, category, last_imported_at)
  select (m->>'id')::int, (m->>'blizzardId')::int, m->>'slug', m->>'name', m->>'description', m->>'iconUrl', m->>'imageUrl',
    (m->>'expansionId')::int, m->>'mountType', null, null, m->>'availability', m->>'lockout', false, m->>'faction',
    m->'methods'->>0, array(select jsonb_array_elements_text(m->'methods')),
    (m->'probability'->>'percentage')::numeric, m->'probability'->>'status', m->'probability'->>'source', null, null,
    'https://www.wowhead.com/mount/' || (m->>'id'), (m->>'verifiedAt')::timestamptz, false,
    (m->>'spellId')::int, (m->>'itemId')::int, m->>'sourceText', m->>'category', now()
  from jsonb_array_elements(cat->'mounts') m
  on conflict (id) do update set blizzard_id = excluded.blizzard_id, slug = excluded.slug, name = excluded.name,
    description = excluded.description, icon_url = excluded.icon_url, image_url = excluded.image_url,
    expansion_id = excluded.expansion_id, mount_type = excluded.mount_type, availability_status = excluded.availability_status,
    lockout = excluded.lockout, faction = excluded.faction, acquisition_method = excluded.acquisition_method,
    acquisition_methods = excluded.acquisition_methods, drop_percentage = excluded.drop_percentage,
    probability_status = excluded.probability_status, probability_source = excluded.probability_source,
    external_reference = excluded.external_reference, source_verified_at = excluded.source_verified_at, is_demo = false,
    spell_id = excluded.spell_id, item_id = excluded.item_id, source_text = excluded.source_text,
    category = excluded.category, last_imported_at = excluded.last_imported_at;

  select array_agg((m->>'id')::int) into ids from jsonb_array_elements(cat->'mounts') m;
  delete from public.mount_sources where mount_id = any(ids);
  delete from public.mount_locations where mount_id = any(ids);
  delete from public.mount_references where mount_id = any(ids);

  -- 4) Fuentes de obtención
  insert into public.mount_sources (mount_id, source_type, npc_name, boss_name, vendor_name, achievement_name,
    reputation_requirement, currency_requirement, requirements, instructions, source_url, npc_id, encounter_id,
    instance_id, instance_name, zone_name, ui_map_id, map_x, map_y, coordinates_kind, data_source_id, trust, fetched_at)
  select (m->>'id')::int, s->>'sourceType', s->>'npcName', s->>'bossName', s->>'vendorName', s->>'achievementName',
    s->>'reputationRequirement', s->>'currencyRequirement', s->>'requirements', s->>'instructions', s->>'sourceUrl',
    (s->>'npcId')::int, (s->>'encounterId')::int, (s->>'instanceId')::int, s->>'instanceName', s->>'zoneName',
    (s->>'uiMapId')::int, (s->>'mapX')::numeric, (s->>'mapY')::numeric, s->>'coordinatesKind', s->>'dataSourceId',
    s->>'trust', (m->>'verifiedAt')::timestamptz
  from jsonb_array_elements(cat->'mounts') m, jsonb_array_elements(m->'sources') s;

  -- 5) Ubicaciones, referencias, multimedia y procedencia
  insert into public.mount_locations (mount_id, location_id)
  select (m->>'id')::int, l::int from jsonb_array_elements(cat->'mounts') m, jsonb_array_elements_text(m->'locationIds') l
  on conflict do nothing;

  insert into public.mount_references (mount_id, label, url)
  select (m->>'id')::int, r->>'label', r->>'url' from jsonb_array_elements(cat->'mounts') m, jsonb_array_elements(m->'references') r
  on conflict do nothing;

  insert into public.mount_media (mount_id, kind, url, resource_id, data_source_id, status, checked_at)
  select (m->>'id')::int, x->>'kind', x->>'url', x->>'resourceId', x->>'dataSourceId', x->>'status', (x->>'checkedAt')::timestamptz
  from jsonb_array_elements(cat->'mounts') m, jsonb_array_elements(m->'media') x
  on conflict (mount_id, kind) do update set url = excluded.url, resource_id = excluded.resource_id,
    data_source_id = excluded.data_source_id, status = excluded.status, checked_at = excluded.checked_at;

  insert into public.field_provenance (mount_id, field, data_source_id, source_url, info_type, trust, fetched_at, verified_at)
  select (m->>'id')::int, p.key, p.value->>'source', p.value->>'url', p.value->>'infoType', p.value->>'trust',
    (p.value->>'fetchedAt')::timestamptz,
    case when p.value->>'trust' in ('official', 'verified') then (p.value->>'fetchedAt')::timestamptz end
  from jsonb_array_elements(cat->'mounts') m, jsonb_each(m->'provenance') p
  on conflict (mount_id, field) do update set data_source_id = excluded.data_source_id, source_url = excluded.source_url,
    info_type = excluded.info_type, trust = excluded.trust, fetched_at = excluded.fetched_at, verified_at = excluded.verified_at;

  insert into public.import_runs (started_at, finished_at, dry_run, report)
  values (now(), now(), false, jsonb_build_object('mode', 'sql-from-json', 'version', cat->>'version', 'mounts', array_length(ids, 1)));
end $$;

select count(*) as monturas, count(*) filter (where is_demo) as demo_restantes from public.mounts;
