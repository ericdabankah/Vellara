
create or replace function private.guard_reservation_room_availability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_capacity smallint;
  v_room_status text;
begin
  if new.room_id is null or new.status not in ('pending','confirmed','checked_in') then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.room_id::text, 0));

  select r.capacity, r.status into v_capacity, v_room_status
  from public.rooms r
  where r.organization_id = new.organization_id and r.id = new.room_id;

  if v_capacity is null then
    raise exception 'Room does not belong to this workspace' using errcode = '23503';
  end if;

  if new.adults + new.children > v_capacity then
    raise exception 'Guest count exceeds this room capacity' using errcode = '23514';
  end if;

  if new.status in ('pending','confirmed') and v_room_status <> 'available' then
    raise exception 'Room is not currently available for a new reservation' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.reservations r
    where r.organization_id = new.organization_id
      and r.room_id = new.room_id
      and r.id <> new.id
      and r.status in ('pending','confirmed','checked_in')
      and r.arrival_date < new.departure_date
      and r.departure_date > new.arrival_date
  ) then
    raise exception 'Room already has an overlapping reservation' using errcode = '23P01';
  end if;

  return new;
end;
$function$;

drop trigger if exists reservations_guard_room_availability on public.reservations;
create trigger reservations_guard_room_availability
before insert or update of organization_id, room_id, arrival_date, departure_date, adults, children, status
on public.reservations
for each row execute function private.guard_reservation_room_availability();

revoke all on function private.guard_reservation_room_availability() from public, anon, authenticated;
create index if not exists reservations_room_date_overlap_idx
  on public.reservations(organization_id, room_id, arrival_date, departure_date)
  where status in ('pending','confirmed','checked_in');
