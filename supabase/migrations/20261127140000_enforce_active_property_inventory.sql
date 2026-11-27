-- Keep new inventory and reservation writes attached to active hospitality
-- properties. A room must also reference an active, non-archived room type
-- belonging to that same property. Composite FKs remain the final integrity
-- boundary for organization/property/room relationships.

-- These tenant-owned tables have no anonymous/public read surface.
-- Preserve authenticated column grants and service_role access explicitly.
revoke all on table
  public.organization_modules,
  public.properties,
  public.property_staff_assignments,
  public.room_types
from public, anon;


create or replace function private.enforce_hospitality_property()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  target_vertical text;
  target_status text;
begin
  select property.vertical, property.status
    into target_vertical, target_status
  from public.properties property
  where property.organization_id = new.organization_id
    and property.id = new.property_id;

  if not found
     or target_vertical <> 'hospitality'
     or target_status <> 'active' then
    raise exception 'Inventory and reservations must belong to an active hospitality property'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function private.enforce_hospitality_property() from public, anon, authenticated;

drop trigger if exists room_types_require_hospitality_property on public.room_types;
create trigger room_types_require_hospitality_property
before insert or update of organization_id, property_id on public.room_types
for each row execute function private.enforce_hospitality_property();

drop trigger if exists rooms_require_hospitality_property on public.rooms;
create trigger rooms_require_hospitality_property
before insert or update of organization_id, property_id on public.rooms
for each row execute function private.enforce_hospitality_property();

drop trigger if exists reservations_require_hospitality_property on public.reservations;
create trigger reservations_require_hospitality_property
before insert or update of organization_id, property_id on public.reservations
for each row execute function private.enforce_hospitality_property();

create or replace function private.enforce_active_room_type()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.room_types room_type
    where room_type.organization_id = new.organization_id
      and room_type.property_id = new.property_id
      and room_type.id = new.room_type_id
      and room_type.is_active
      and room_type.archived_at is null
  ) then
    raise exception 'A room must use an active room type belonging to the same property'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function private.enforce_active_room_type() from public, anon, authenticated;

drop trigger if exists rooms_require_active_room_type on public.rooms;
create trigger rooms_require_active_room_type
before insert or update of organization_id, property_id, room_type_id on public.rooms
for each row execute function private.enforce_active_room_type();
