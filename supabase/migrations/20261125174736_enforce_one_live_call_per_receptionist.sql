
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
  v_existing_instance uuid;
  v_existing_status text;
  v_existing_lease timestamptz;
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

  -- Expire abandoned leases before evaluating either plan-wide or per-instance capacity.
  update public.call_capacity_reservations r
  set status = 'expired', released_at = pg_catalog.now()
  where r.organization_id = p_organization_id
    and r.status = 'active'
    and r.lease_expires_at <= pg_catalog.now();

  select r.id, r.receptionist_instance_id, r.status, r.lease_expires_at
    into v_reservation_id, v_existing_instance, v_existing_status, v_existing_lease
  from public.call_capacity_reservations r
  where r.organization_id = p_organization_id and r.call_id = p_call_id;

  -- Idempotent heartbeat: renew the existing call's lease without double-counting it.
  if v_reservation_id is not null and v_existing_status = 'active'
     and v_existing_lease > pg_catalog.now() then
    if v_existing_instance <> p_receptionist_instance_id then
      raise exception 'This call already holds capacity on another receptionist instance' using errcode = '23514';
    end if;
    update public.call_capacity_reservations
    set lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds)
    where id = v_reservation_id;
    return v_reservation_id;
  end if;

  -- Each receptionist instance handles one live call at a time. Multiple instances
  -- provide parallel call handling up to the plan-wide concurrency ceiling.
  if exists (
    select 1 from public.call_capacity_reservations r
    where r.organization_id = p_organization_id
      and r.receptionist_instance_id = p_receptionist_instance_id
      and r.status = 'active'
      and r.lease_expires_at > pg_catalog.now()
      and r.call_id <> p_call_id
  ) then
    raise exception 'This AI receptionist instance is already handling another call' using errcode = '54000';
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
