-- VELLARA Property Management foundation.
-- Adds vertical-aware properties, property-scoped room types and inventory,
-- and property-scoped staff access. This migration is a reviewed draft only;
-- it must not be applied to production until replayed and tested in isolation.

create table public.organization_modules (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null check (module_key in ('hospitality','real_estate')),
  is_enabled boolean not null default true,
  enabled_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, module_key),
  check ((is_enabled and disabled_at is null) or (not is_enabled and disabled_at is not null))
);
alter table public.organization_modules enable row level security;
grant select, insert on public.organization_modules to authenticated;
grant update (is_enabled, disabled_at) on public.organization_modules to authenticated;
grant all on public.organization_modules to service_role;

insert into public.organization_modules (organization_id, module_key)
select organization_id,
       case business_type when 'hotel' then 'hospitality' when 'real_estate' then 'real_estate' end
from public.business_profiles
where business_type in ('hotel','real_estate')
on conflict (organization_id, module_key) do nothing;

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vertical text not null check (vertical in ('hospitality','real_estate')),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  status text not null default 'active' check (status in ('active','inactive','archived')),
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  country_code char(2) not null default 'GH' check (country_code ~ '^[A-Z]{2}$'),
  timezone_override text check (timezone_override is null or char_length(btrim(timezone_override)) between 1 and 80),
  currency_override char(3) check (currency_override is null or currency_override ~ '^[A-Z]{3}$'),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, slug)
);
create index properties_org_vertical_status_idx
  on public.properties (organization_id, vertical, status, created_at desc);

create table public.property_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  user_id uuid not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (organization_id, property_id)
    references public.properties(organization_id, id) on delete cascade,
  foreign key (organization_id, user_id)
    references public.organization_memberships(organization_id, user_id) on delete cascade,
  check (revoked_at is null or revoked_at >= created_at)
);
create unique index property_staff_assignments_one_active
  on public.property_staff_assignments (organization_id, property_id, user_id)
  where revoked_at is null;
create index property_staff_assignments_user_active_idx
  on public.property_staff_assignments (organization_id, user_id, property_id)
  where revoked_at is null;
create index property_staff_assignments_property_active_idx
  on public.property_staff_assignments (organization_id, property_id, user_id)
  where revoked_at is null;

create or replace function private.has_property_role(
  p_organization_id uuid,
  p_property_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and (
        membership.role::text = 'owner'
        or (
          membership.role::text = any (p_roles)
          and exists (
            select 1
            from public.property_staff_assignments assignment
            where assignment.organization_id = p_organization_id
              and assignment.property_id = p_property_id
              and assignment.user_id = membership.user_id
              and assignment.revoked_at is null
          )
        )
      )
  );
$function$;
revoke all on function private.has_property_role(uuid, uuid, text[]) from public, anon;
grant execute on function private.has_property_role(uuid, uuid, text[]) to authenticated;

create or replace function private.assign_property_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.created_by is distinct from (select auth.uid()) then
    raise exception 'Property creator must be the authenticated user'
      using errcode = '42501';
  end if;

  insert into public.property_staff_assignments
    (organization_id, property_id, user_id, granted_by)
  select new.organization_id, new.id, membership.user_id, membership.user_id
  from public.organization_memberships membership
  where membership.organization_id = new.organization_id
    and membership.user_id = new.created_by
    and membership.status = 'active'
    and membership.role::text <> 'owner'
  on conflict do nothing;

  return new;
end;
$function$;
revoke all on function private.assign_property_creator() from public, anon, authenticated;
create trigger properties_assign_creator
after insert on public.properties
for each row execute function private.assign_property_creator();

create table public.room_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '',
  default_capacity smallint not null default 2 check (default_capacity between 1 and 30),
  bed_configuration jsonb not null default '{}'::jsonb
    check (jsonb_typeof(bed_configuration) = 'object'),
  amenities text[] not null default '{}',
  default_nightly_rate_minor bigint check (default_nightly_rate_minor is null or default_nightly_rate_minor >= 0),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, property_id)
    references public.properties(organization_id, id) on delete restrict,
  unique (organization_id, property_id, id),
  check (archived_at is null or not is_active)
);
create unique index room_types_property_name_unique
  on public.room_types (organization_id, property_id, lower(name));
create index room_types_property_active_idx
  on public.room_types (organization_id, property_id, is_active, lower(name));

-- Preflight legacy records before creating or assigning any property data.
-- Never guess when an organization already has multiple hospitality properties.
do $preflight$
declare
  ambiguous_org_count integer;
  blank_room_type_count bigint;
begin
  select count(*) into blank_room_type_count
  from public.rooms
  where room_type is null or btrim(room_type) = '';

  if blank_room_type_count > 0 then
    raise exception
      'Property migration stopped: % legacy room(s) have a blank room_type. Resolve these explicitly before replay.',
      blank_room_type_count
      using errcode = '23514';
  end if;

  select count(*) into ambiguous_org_count
  from (
    select legacy_orgs.organization_id
    from (
      select organization_id from public.rooms
      union
      select organization_id from public.reservations
    ) legacy_orgs
    join public.properties property
      on property.organization_id = legacy_orgs.organization_id
     and property.vertical = 'hospitality'
    group by legacy_orgs.organization_id
    having count(*) > 1
  ) ambiguous;

  if ambiguous_org_count > 0 then
    raise exception
      'Property migration stopped: % organization(s) have multiple hospitality properties and legacy records cannot be assigned safely.',
      ambiguous_org_count
      using errcode = '23514';
  end if;
end
$preflight$;

-- Enable the hospitality module for organizations with legacy inventory.
insert into public.organization_modules (organization_id, module_key)
select distinct organization_id, 'hospitality'
from (
  select organization_id from public.rooms
  union
  select organization_id from public.reservations
) legacy_orgs
on conflict (organization_id, module_key) do update
set is_enabled = true, disabled_at = null;

-- Create a legacy property only when no hospitality property exists.
-- The organization UUID suffix avoids colliding with a real property's slug.
insert into public.properties (organization_id, vertical, name, slug, description)
select legacy_orgs.organization_id, 'hospitality',
       pg_catalog.left(coalesce(nullif(btrim(profile.display_name), ''), org.name) || ' (Legacy)', 120),
       'legacy-property-' || pg_catalog.left(pg_catalog.replace(legacy_orgs.organization_id::text, '-', ''), 8),
       'Automatically created to preserve existing room and reservation history.'
from (
  select organization_id from public.rooms
  union
  select organization_id from public.reservations
) legacy_orgs
join public.organizations org on org.id = legacy_orgs.organization_id
left join public.business_profiles profile on profile.organization_id = legacy_orgs.organization_id
where not exists (
  select 1 from public.properties property
  where property.organization_id = legacy_orgs.organization_id
    and property.vertical = 'hospitality'
);

-- Freeze one unambiguous organization-to-property mapping for this migration.
create temporary table vellara_legacy_property_map
on commit drop
as
select property.organization_id, min(property.id) as property_id
from public.properties property
join (
  select organization_id from public.rooms
  union
  select organization_id from public.reservations
) legacy_orgs
  on legacy_orgs.organization_id = property.organization_id
where property.vertical = 'hospitality'
group by property.organization_id
having count(*) = 1;

do $mapping_check$
declare
  affected_org_count bigint;
  mapped_org_count bigint;
begin
  select count(*) into affected_org_count
  from (
    select organization_id from public.rooms
    union
    select organization_id from public.reservations
  ) legacy_orgs;

  select count(*) into mapped_org_count
  from vellara_legacy_property_map;

  if affected_org_count <> mapped_org_count then
    raise exception
      'Property migration stopped: not every legacy organization has exactly one hospitality property mapping (% of % mapped).',
      mapped_org_count, affected_org_count
      using errcode = '23514';
  end if;
end
$mapping_check$;

-- Normalize legacy room types case-insensitively without losing the source text
-- on rooms. Blank values were rejected in preflight rather than invented.
insert into public.room_types (
  organization_id, property_id, name, description, default_capacity
)
select room.organization_id, mapping.property_id,
       min(btrim(room.room_type)),
       'Preserved from the previous room type field.',
       max(room.capacity)::smallint
from public.rooms room
join vellara_legacy_property_map mapping
  on mapping.organization_id = room.organization_id
group by room.organization_id, mapping.property_id, lower(btrim(room.room_type));

alter table public.rooms
  add column property_id uuid,
  add column room_type_id uuid;

update public.rooms room
set property_id = mapping.property_id,
    room_type_id = room_type.id
from vellara_legacy_property_map mapping
join public.room_types room_type
  on room_type.organization_id = mapping.organization_id
 and room_type.property_id = mapping.property_id
where mapping.organization_id = room.organization_id
  and lower(room_type.name) = lower(btrim(room.room_type));

alter table public.reservations add column property_id uuid;
update public.reservations reservation
set property_id = room.property_id
from public.rooms room
where reservation.organization_id = room.organization_id
  and reservation.room_id = room.id;
update public.reservations reservation
set property_id = mapping.property_id
from vellara_legacy_property_map mapping
where reservation.property_id is null
  and mapping.organization_id = reservation.organization_id;

-- Existing data is assigned before these columns become mandatory.
alter table public.rooms alter column property_id set not null;
alter table public.rooms alter column room_type_id set not null;
alter table public.reservations alter column property_id set not null;

do $block$
declare
  constraint_name text;
begin
  for constraint_name in
    select constraint_row.conname
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.rooms'::regclass
      and constraint_row.contype = 'u'
      and pg_catalog.pg_get_constraintdef(constraint_row.oid) = 'UNIQUE (organization_id, room_number)'
  loop
    execute pg_catalog.format('alter table public.rooms drop constraint %I', constraint_name);
  end loop;
end
$block$;

alter table public.rooms
  add constraint rooms_org_property_id_unique unique (organization_id, property_id, id),
  add constraint rooms_org_property_fk
    foreign key (organization_id, property_id)
    references public.properties(organization_id, id) on delete restrict,
  add constraint rooms_org_property_room_type_fk
    foreign key (organization_id, property_id, room_type_id)
    references public.room_types(organization_id, property_id, id) on delete restrict;

create unique index rooms_property_room_number_unique
  on public.rooms (organization_id, property_id, lower(room_number));
create index rooms_property_status_idx
  on public.rooms (organization_id, property_id, status);

alter table public.reservations
  add constraint reservations_org_property_fk
    foreign key (organization_id, property_id)
    references public.properties(organization_id, id) on delete restrict,
  add constraint reservations_org_property_room_fk
    foreign key (organization_id, property_id, room_id)
    references public.rooms(organization_id, property_id, id) on delete restrict;
create index reservations_property_arrival_idx
  on public.reservations (organization_id, property_id, arrival_date, status);


create or replace function private.enforce_hospitality_property()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if not exists (
    select 1 from public.properties property
    where property.organization_id = new.organization_id
      and property.id = new.property_id
      and property.vertical = 'hospitality'
  ) then
    raise exception 'This inventory record must belong to a hospitality property'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;
revoke all on function private.enforce_hospitality_property() from public, anon, authenticated;

create trigger room_types_require_hospitality_property
before insert or update of organization_id, property_id on public.room_types
for each row execute function private.enforce_hospitality_property();
create trigger rooms_require_hospitality_property
before insert or update of organization_id, property_id on public.rooms
for each row execute function private.enforce_hospitality_property();
create trigger reservations_require_hospitality_property
before insert or update of organization_id, property_id on public.reservations
for each row execute function private.enforce_hospitality_property();

-- New tables are protected by RLS. Owners see every property; other roles
-- must have an explicit active assignment for the property being accessed.
alter table public.properties enable row level security;
alter table public.property_staff_assignments enable row level security;
alter table public.room_types enable row level security;

grant select, insert on public.properties to authenticated;
grant update (name, slug, description, status, address_line_1, address_line_2, city, region, postal_code, country_code, timezone_override, currency_override) on public.properties to authenticated;
grant select, insert on public.property_staff_assignments to authenticated;
grant update (revoked_at) on public.property_staff_assignments to authenticated;
grant select, insert on public.room_types to authenticated;
grant update (name, description, default_capacity, bed_configuration, amenities, default_nightly_rate_minor, is_active, archived_at) on public.room_types to authenticated;
grant all on public.properties, public.property_staff_assignments, public.room_types to service_role;

create policy organization_modules_member_read
  on public.organization_modules for select to authenticated
  using ((select private.is_organization_member(organization_id)));
create policy organization_modules_owner_manager_insert
  on public.organization_modules for insert to authenticated
  with check ((select private.has_organization_role(organization_id, array['owner','manager']::text[])));
create policy organization_modules_owner_manager_update
  on public.organization_modules for update to authenticated
  using ((select private.has_organization_role(organization_id, array['owner','manager']::text[])))
  with check ((select private.has_organization_role(organization_id, array['owner','manager']::text[])));

create policy properties_member_read
  on public.properties for select to authenticated
  using ((select private.has_property_role(organization_id, id, array['owner','manager','operations','verification']::text[])));
create policy properties_owner_manager_insert
  on public.properties for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.has_organization_role(organization_id, array['owner','manager']::text[]))
    and exists (
      select 1 from public.organization_modules module
      where module.organization_id = properties.organization_id
        and module.module_key = properties.vertical
        and module.is_enabled
    )
  );
create policy properties_owner_manager_update
  on public.properties for update to authenticated
  using ((select private.has_property_role(organization_id, id, array['owner','manager']::text[])))
  with check ((select private.has_property_role(organization_id, id, array['owner','manager']::text[])));

create or replace function private.protect_property_identity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.created_by is distinct from old.created_by
     or new.vertical is distinct from old.vertical then
    raise exception 'Property identity and vertical fields are immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;
revoke all on function private.protect_property_identity() from public, anon, authenticated;
create trigger properties_protect_identity
before update on public.properties
for each row execute function private.protect_property_identity();

create policy property_staff_assignments_member_read
  on public.property_staff_assignments for select to authenticated
  using ((select private.has_property_role(organization_id, property_id, array['owner','manager']::text[])));
create policy property_staff_assignments_owner_insert
  on public.property_staff_assignments for insert to authenticated
  with check (
    (select private.has_organization_role(organization_id, array['owner']::text[]))
    and exists (
      select 1 from public.organization_memberships membership
      where membership.organization_id = property_staff_assignments.organization_id
        and membership.user_id = property_staff_assignments.user_id
        and membership.status = 'active'
    )
    and granted_by = (select auth.uid())
  );
create policy property_staff_assignments_owner_update
  on public.property_staff_assignments for update to authenticated
  using ((select private.has_organization_role(organization_id, array['owner']::text[])))
  with check ((select private.has_organization_role(organization_id, array['owner']::text[])));

create policy room_types_property_read
  on public.room_types for select to authenticated
  using ((select private.has_property_role(organization_id, property_id, array['owner','manager','operations']::text[])));
create policy room_types_property_insert
  on public.room_types for insert to authenticated
  with check ((select private.has_property_role(organization_id, property_id, array['owner','manager','operations']::text[])));
create policy room_types_property_update
  on public.room_types for update to authenticated
  using ((select private.has_property_role(organization_id, property_id, array['owner','manager','operations']::text[])))
  with check ((select private.has_property_role(organization_id, property_id, array['owner','manager','operations']::text[])));

revoke update on public.rooms from authenticated;
grant update (room_number, room_type_id, floor_label, capacity, status, nightly_rate_minor, currency, notes) on public.rooms to authenticated;
revoke update on public.reservations from authenticated;
grant update (guest_id, room_id, confirmation_code, status, source, arrival_date, departure_date, adults, children, total_amount_minor, currency, special_requests) on public.reservations to authenticated;

drop policy if exists rooms_member_read on public.rooms;
drop policy if exists rooms_ops_insert on public.rooms;
drop policy if exists rooms_ops_update on public.rooms;
create policy rooms_property_read
  on public.rooms for select to authenticated
  using ((select private.has_property_role(organization_id, property_id, array['owner','manager','operations']::text[])));
create policy rooms_property_insert
  on public.rooms for insert to authenticated
  with check ((select private.has_property_role(organization_id, property_id, array['owner','manager','operations']::text[])));
create policy rooms_property_update
  on public.rooms for update to authenticated
  using ((select private.has_property_role(organization_id, property_id, array['owner','manager','operations']::text[])))
  with check ((select private.has_property_role(organization_id, property_id, array['owner','manager','operations']::text[])));

drop policy if exists reservations_member_read on public.reservations;
drop policy if exists reservations_ops_insert on public.reservations;
drop policy if exists reservations_ops_update on public.reservations;
create policy reservations_property_read
  on public.reservations for select to authenticated
  using ((select private.has_property_role(organization_id, property_id, array['owner','manager','operations','verification']::text[])));
create policy reservations_property_insert
  on public.reservations for insert to authenticated
  with check ((select private.has_property_role(organization_id, property_id, array['owner','manager','operations']::text[])));
create policy reservations_property_update
  on public.reservations for update to authenticated
  using ((select private.has_property_role(organization_id, property_id, array['owner','manager','operations']::text[])))
  with check ((select private.has_property_role(organization_id, property_id, array['owner','manager','operations']::text[])));

create trigger organization_modules_touch_updated_at
  before update on public.organization_modules
  for each row execute function private.touch_updated_at();
create trigger properties_touch_updated_at
  before update on public.properties
  for each row execute function private.touch_updated_at();
create trigger room_types_touch_updated_at
  before update on public.room_types
  for each row execute function private.touch_updated_at();
