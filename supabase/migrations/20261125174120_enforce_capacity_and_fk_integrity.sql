
-- Correct composite FK deletion behaviour: preserve the tenant key while nulling
-- only the optional relationship column.
alter table public.reservations drop constraint if exists reservations_organization_id_guest_id_fkey;
alter table public.reservations add constraint reservations_organization_guest_fk
  foreign key (organization_id, guest_id)
  references public.guests(organization_id, id) on delete set null (guest_id);

alter table public.reservations drop constraint if exists reservations_organization_id_room_id_fkey;
alter table public.reservations add constraint reservations_organization_room_fk
  foreign key (organization_id, room_id)
  references public.rooms(organization_id, id) on delete set null (room_id);

alter table public.calls drop constraint if exists calls_organization_id_phone_number_id_fkey;
alter table public.calls add constraint calls_organization_phone_fk
  foreign key (organization_id, phone_number_id)
  references public.organization_phone_numbers(organization_id, id) on delete set null (phone_number_id);

alter table public.calls drop constraint if exists calls_organization_id_receptionist_instance_id_fkey;
alter table public.calls add constraint calls_organization_receptionist_fk
  foreign key (organization_id, receptionist_instance_id)
  references public.receptionist_instances(organization_id, id) on delete set null (receptionist_instance_id);

alter table public.call_capacity_reservations drop constraint if exists call_capacity_reservations_organization_id_receptionist_in_fkey;
alter table public.call_capacity_reservations add constraint call_capacity_receptionist_fk
  foreign key (organization_id, receptionist_instance_id)
  references public.receptionist_instances(organization_id, id) on delete set null (receptionist_instance_id);

alter table public.phone_number_channels
  add constraint phone_number_channels_org_number_channel_unique
  unique (organization_id, phone_number_id, channel);

alter table public.receptionist_number_routes
  add constraint receptionist_routes_require_channel
  foreign key (organization_id, phone_number_id, channel)
  references public.phone_number_channels(organization_id, phone_number_id, channel)
  on delete cascade;

update public.subscription_plan_entitlements e
set phone_number_limit = 1,
    receptionist_instance_limit = 1,
    concurrent_call_limit = 1,
    configuration_status = 'configured',
    custom_entitlements = false
from public.subscription_plans p
where p.id = e.plan_id and p.code = 'starter';

update public.subscription_plan_entitlements e
set phone_number_limit = null,
    receptionist_instance_limit = null,
    concurrent_call_limit = null,
    configuration_status = 'pending',
    custom_entitlements = false
from public.subscription_plans p
where p.id = e.plan_id and p.code in ('growth','premium');

update public.subscription_plan_entitlements e
set phone_number_limit = null,
    receptionist_instance_limit = null,
    concurrent_call_limit = null,
    configuration_status = 'pending',
    custom_entitlements = true
from public.subscription_plans p
where p.id = e.plan_id and p.code = 'enterprise';

create or replace function public.register_verified_phone_number(
  p_organization_id uuid,
  p_phone_e164 text,
  p_label text default 'Main number',
  p_created_by uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_limit integer;
  v_count bigint;
  v_id uuid;
begin
  if p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone number must be normalized to E.164 format' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text, 0));

  select s.phone_number_limit into v_limit
  from public.organization_subscriptions s
  where s.organization_id = p_organization_id
    and s.status in ('active','trialing')
    and s.entitlements_configured = true
  order by s.created_at desc
  limit 1;

  if v_limit is null or v_limit < 1 then
    raise exception 'An active subscription with configured phone capacity is required' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.organization_phone_numbers n
  where n.organization_id = p_organization_id
    and n.status in ('pending','active','suspended');

  if v_count >= v_limit then
    raise exception 'The subscription phone-number limit has been reached' using errcode = '54000';
  end if;

  insert into public.organization_phone_numbers
    (organization_id, phone_e164, label, verification_status, status, verified_at, created_by)
  values
    (p_organization_id, p_phone_e164, coalesce(nullif(pg_catalog.btrim(p_label),''),'Main number'),
     'verified','active',pg_catalog.now(),p_created_by)
  returning id into v_id;

  return v_id;
end;
$function$;
revoke all on function public.register_verified_phone_number(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.register_verified_phone_number(uuid,text,text,uuid) to service_role;

create or replace function public.create_receptionist_instance(
  p_organization_id uuid,
  p_display_name text,
  p_description text default '',
  p_greeting text default '',
  p_language_code text default 'en-GH',
  p_timezone text default 'Africa/Accra',
  p_created_by uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_limit integer;
  v_count bigint;
  v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text, 0));

  select s.receptionist_instance_limit into v_limit
  from public.organization_subscriptions s
  where s.organization_id = p_organization_id
    and s.status in ('active','trialing')
    and s.entitlements_configured = true
  order by s.created_at desc
  limit 1;

  if v_limit is null or v_limit < 1 then
    raise exception 'An active subscription with configured receptionist capacity is required' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.receptionist_instances r
  where r.organization_id = p_organization_id
    and r.status <> 'archived';

  if v_count >= v_limit then
    raise exception 'The subscription receptionist-instance limit has been reached' using errcode = '54000';
  end if;

  insert into public.receptionist_instances
    (organization_id, display_name, description, greeting, language_code, timezone, created_by)
  values
    (p_organization_id, p_display_name, coalesce(p_description,''), coalesce(p_greeting,''),
     coalesce(p_language_code,'en-GH'), coalesce(p_timezone,'Africa/Accra'), p_created_by)
  returning id into v_id;

  return v_id;
end;
$function$;
revoke all on function public.create_receptionist_instance(uuid,text,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.create_receptionist_instance(uuid,text,text,text,text,text,uuid) to service_role;

create or replace function public.reserve_call_capacity(
  p_organization_id uuid,
  p_call_id uuid,
  p_receptionist_instance_id uuid,
  p_lease_seconds integer default 120
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_limit integer;
  v_active bigint;
  v_reservation_id uuid;
begin
  if p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception 'Lease must be between 15 and 900 seconds' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text, 0));

  select s.concurrent_call_limit into v_limit
  from public.organization_subscriptions s
  where s.organization_id = p_organization_id
    and s.status in ('active','trialing')
    and s.entitlements_configured = true
  order by s.created_at desc
  limit 1;

  if v_limit is null or v_limit < 1 then
    raise exception 'An active subscription with configured call capacity is required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.calls c
    where c.organization_id = p_organization_id and c.id = p_call_id
      and c.status in ('queued','ringing','in_progress')
  ) then
    raise exception 'Call does not exist or is not eligible for capacity reservation' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.receptionist_instances r
    where r.organization_id = p_organization_id
      and r.id = p_receptionist_instance_id
      and r.status = 'active'
  ) then
    raise exception 'Receptionist instance is not active for this workspace' using errcode = '22023';
  end if;

  select r.id into v_reservation_id
  from public.call_capacity_reservations r
  where r.organization_id = p_organization_id and r.call_id = p_call_id;

  if v_reservation_id is not null and exists (
    select 1 from public.call_capacity_reservations r
    where r.id = v_reservation_id and r.status = 'active'
      and r.lease_expires_at > pg_catalog.now()
  ) then
    return v_reservation_id;
  end if;

  select count(*) into v_active
  from public.call_capacity_reservations r
  where r.organization_id = p_organization_id
    and r.status = 'active'
    and r.lease_expires_at > pg_catalog.now();

  if v_active >= v_limit then
    raise exception 'The subscription simultaneous-call limit has been reached' using errcode = '54000';
  end if;

  if v_reservation_id is null then
    insert into public.call_capacity_reservations
      (organization_id, call_id, receptionist_instance_id, status, lease_expires_at)
    values
      (p_organization_id, p_call_id, p_receptionist_instance_id, 'active',
       pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds))
    returning id into v_reservation_id;
  else
    update public.call_capacity_reservations
    set status = 'active', receptionist_instance_id = p_receptionist_instance_id,
        lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
        released_at = null
    where id = v_reservation_id
    returning id into v_reservation_id;
  end if;

  return v_reservation_id;
end;
$function$;
revoke all on function public.reserve_call_capacity(uuid,uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.reserve_call_capacity(uuid,uuid,uuid,integer) to service_role;

create or replace function public.release_call_capacity(p_call_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_updated integer;
begin
  update public.call_capacity_reservations
  set status = 'released', released_at = pg_catalog.now()
  where call_id = p_call_id and status = 'active';
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$function$;
revoke all on function public.release_call_capacity(uuid) from public, anon, authenticated;
grant execute on function public.release_call_capacity(uuid) to service_role;

-- Realtime publication is optional on projects where it is already configured.
do $block$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='calls') then
      alter publication supabase_realtime add table public.calls;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reservations') then
      alter publication supabase_realtime add table public.reservations;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='activity_events') then
      alter publication supabase_realtime add table public.activity_events;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rooms') then
      alter publication supabase_realtime add table public.rooms;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='guests') then
      alter publication supabase_realtime add table public.guests;
    end if;
  end if;
end
$block$;
