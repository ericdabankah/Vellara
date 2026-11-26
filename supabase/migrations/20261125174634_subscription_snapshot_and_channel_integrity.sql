
alter table public.organization_phone_numbers
  add constraint organization_phone_active_requires_verification
  check (status <> 'active' or verification_status = 'verified');

alter table public.phone_number_channels
  add constraint phone_channel_active_requires_connected_at
  check (status <> 'active' or connected_at is not null);

create or replace function private.guard_subscription_entitlement_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.entitlements_configured then
    if new.phone_number_limit is null
       or new.receptionist_instance_limit is null
       or new.concurrent_call_limit is null then
      raise exception 'Configured subscriptions require explicit number, receptionist, and concurrency limits'
        using errcode = '23514';
    end if;
  end if;

  if old.entitlements_configured and (
    new.plan_id is distinct from old.plan_id
    or new.price_id is distinct from old.price_id
    or new.phone_number_limit is distinct from old.phone_number_limit
    or new.receptionist_instance_limit is distinct from old.receptionist_instance_limit
    or new.concurrent_call_limit is distinct from old.concurrent_call_limit
    or new.team_member_limit is distinct from old.team_member_limit
  ) then
    raise exception 'An activated subscription entitlement snapshot is immutable; create a new subscription version for plan changes'
      using errcode = '23514';
  end if;

  if new.price_id is not null and not exists (
    select 1 from public.subscription_prices p
    where p.id = new.price_id and p.plan_id = new.plan_id
  ) then
    raise exception 'Subscription price does not belong to the selected plan'
      using errcode = '23503';
  end if;

  return new;
end;
$function$;

drop trigger if exists organization_subscriptions_guard_entitlements on public.organization_subscriptions;
create trigger organization_subscriptions_guard_entitlements
before insert or update on public.organization_subscriptions
for each row execute function private.guard_subscription_entitlement_snapshot();
revoke all on function private.guard_subscription_entitlement_snapshot() from public, anon, authenticated;

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
    and (s.current_period_end is null or s.current_period_end > pg_catalog.now())
    and (s.trial_end is null or s.trial_end > pg_catalog.now())
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
    and (s.current_period_end is null or s.current_period_end > pg_catalog.now())
    and (s.trial_end is null or s.trial_end > pg_catalog.now())
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
    and (s.current_period_end is null or s.current_period_end > pg_catalog.now())
    and (s.trial_end is null or s.trial_end > pg_catalog.now())
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
