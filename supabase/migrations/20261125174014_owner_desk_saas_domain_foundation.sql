
-- VELLARA production SaaS domain foundation.
-- Existing tenant foundation is preserved. New client-facing tables are RLS protected
-- and browser grants are limited to the operations the Owner Desk actually needs.

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('starter','growth','premium','enterprise')),
  name text not null,
  description text not null default '',
  display_order smallint not null unique check (display_order > 0),
  is_listed boolean not null default true,
  is_available_for_purchase boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_plan_entitlements (
  plan_id uuid primary key references public.subscription_plans(id) on delete restrict,
  phone_number_limit integer check (phone_number_limit is null or phone_number_limit >= 1),
  receptionist_instance_limit integer check (receptionist_instance_limit is null or receptionist_instance_limit >= 1),
  concurrent_call_limit integer check (concurrent_call_limit is null or concurrent_call_limit >= 1),
  team_member_limit integer check (team_member_limit is null or team_member_limit >= 1),
  custom_entitlements boolean not null default false,
  configuration_status text not null default 'pending' check (configuration_status in ('pending','configured','retired')),
  updated_at timestamptz not null default now()
);

create table public.subscription_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  currency char(3) not null default 'GHS' check (currency ~ '^[A-Z]{3}$'),
  billing_interval text not null check (billing_interval in ('monthly','yearly')),
  amount_minor bigint not null check (amount_minor > 0),
  provider text not null check (provider in ('paystack','stripe','manual')),
  provider_price_ref text,
  is_active boolean not null default false,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from),
  unique (plan_id, currency, billing_interval, provider, effective_from)
);
create unique index subscription_prices_one_active_per_plan
  on public.subscription_prices(plan_id, currency, billing_interval, provider)
  where is_active = true;

create table public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  price_id uuid references public.subscription_prices(id) on delete restrict,
  status text not null default 'incomplete'
    check (status in ('incomplete','pending','trialing','active','past_due','paused','canceled','expired')),
  billing_provider text check (billing_provider in ('paystack','stripe','manual')),
  provider_customer_ref text,
  provider_subscription_ref text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  -- Immutable entitlement snapshot for this subscription version.
  phone_number_limit integer check (phone_number_limit is null or phone_number_limit >= 1),
  receptionist_instance_limit integer check (receptionist_instance_limit is null or receptionist_instance_limit >= 1),
  concurrent_call_limit integer check (concurrent_call_limit is null or concurrent_call_limit >= 1),
  team_member_limit integer check (team_member_limit is null or team_member_limit >= 1),
  entitlements_configured boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start),
  check (trial_end is null or trial_start is null or trial_end > trial_start)
);
create unique index organization_subscriptions_one_current
  on public.organization_subscriptions(organization_id)
  where status in ('incomplete','pending','trialing','active','past_due','paused');
create unique index organization_subscriptions_provider_ref
  on public.organization_subscriptions(billing_provider, provider_subscription_ref)
  where provider_subscription_ref is not null;
create index organization_subscriptions_org_status_idx
  on public.organization_subscriptions(organization_id, status, created_at desc);

create table public.subscription_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paystack','stripe','manual')),
  provider_event_id text not null,
  event_type text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  processing_status text not null default 'received'
    check (processing_status in ('received','processing','processed','failed','ignored')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  unique (provider, provider_event_id)
);
create index subscription_provider_events_org_received_idx
  on public.subscription_provider_events(organization_id, received_at desc);

create table public.organization_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  label text not null default 'Main number' check (char_length(btrim(label)) between 1 and 80),
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected')),
  status text not null default 'pending'
    check (status in ('pending','active','suspended','disconnected')),
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phone_e164),
  unique (organization_id, id),
  check ((verification_status = 'verified' and verified_at is not null) or verification_status <> 'verified')
);
create index organization_phone_numbers_org_status_idx
  on public.organization_phone_numbers(organization_id, status);

create table public.phone_number_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  phone_number_id uuid not null,
  channel text not null check (channel in ('voice','whatsapp')),
  status text not null default 'pending' check (status in ('pending','active','suspended','disconnected')),
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, phone_number_id)
    references public.organization_phone_numbers(organization_id, id) on delete cascade,
  unique (phone_number_id, channel)
);
create index phone_number_channels_org_status_idx
  on public.phone_number_channels(organization_id, status);

create table public.receptionist_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  greeting text not null default '',
  language_code text not null default 'en-GH' check (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  timezone text not null default 'Africa/Accra',
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index receptionist_instances_org_status_idx
  on public.receptionist_instances(organization_id, status);

create table public.receptionist_number_routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  phone_number_id uuid not null,
  receptionist_instance_id uuid not null,
  channel text not null check (channel in ('voice','whatsapp')),
  priority smallint not null default 100 check (priority between 1 and 1000),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, phone_number_id)
    references public.organization_phone_numbers(organization_id, id) on delete cascade,
  foreign key (organization_id, receptionist_instance_id)
    references public.receptionist_instances(organization_id, id) on delete cascade,
  unique (phone_number_id, channel, receptionist_instance_id)
);
create index receptionist_number_routes_org_enabled_idx
  on public.receptionist_number_routes(organization_id, is_enabled, priority);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text,
  notes text not null default '',
  tags text[] not null default '{}',
  source text not null default 'owner_desk' check (source in ('owner_desk','voice','whatsapp','import','other')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index guests_org_phone_unique
  on public.guests(organization_id, phone_e164) where phone_e164 is not null;
create index guests_org_name_idx on public.guests(organization_id, lower(full_name));
create index guests_org_created_idx on public.guests(organization_id, created_at desc);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  room_number text not null check (char_length(btrim(room_number)) between 1 and 32),
  room_type text not null default 'Standard' check (char_length(btrim(room_type)) between 1 and 80),
  floor_label text,
  capacity smallint not null default 2 check (capacity between 1 and 30),
  status text not null default 'available'
    check (status in ('available','occupied','maintenance','out_of_service')),
  nightly_rate_minor bigint check (nightly_rate_minor is null or nightly_rate_minor >= 0),
  currency char(3) not null default 'GHS' check (currency ~ '^[A-Z]{3}$'),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, room_number)
);
create index rooms_org_status_idx on public.rooms(organization_id, status);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guest_id uuid,
  room_id uuid,
  confirmation_code text,
  status text not null default 'inquiry'
    check (status in ('inquiry','pending','confirmed','checked_in','checked_out','canceled','no_show')),
  source text not null default 'owner_desk'
    check (source in ('owner_desk','voice','whatsapp','website','walk_in','other')),
  arrival_date date not null,
  departure_date date not null,
  adults smallint not null default 1 check (adults between 1 and 30),
  children smallint not null default 0 check (children between 0 and 30),
  total_amount_minor bigint check (total_amount_minor is null or total_amount_minor >= 0),
  currency char(3) not null default 'GHS' check (currency ~ '^[A-Z]{3}$'),
  special_requests text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, guest_id) references public.guests(organization_id, id) on delete set null,
  foreign key (organization_id, room_id) references public.rooms(organization_id, id) on delete set null,
  unique (organization_id, id),
  check (departure_date > arrival_date),
  check (confirmation_code is null or char_length(confirmation_code) between 4 and 40)
);
create unique index reservations_org_confirmation_unique
  on public.reservations(organization_id, confirmation_code) where confirmation_code is not null;
create index reservations_org_arrival_idx on public.reservations(organization_id, arrival_date, status);
create index reservations_org_created_idx on public.reservations(organization_id, created_at desc);
create index reservations_org_guest_idx on public.reservations(organization_id, guest_id) where guest_id is not null;

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone_number_id uuid,
  receptionist_instance_id uuid,
  provider text not null default 'retell' check (provider in ('retell','vapi','other')),
  provider_call_id text not null,
  direction text not null check (direction in ('inbound','outbound')),
  status text not null
    check (status in ('queued','ringing','in_progress','completed','missed','failed','transferred')),
  caller_e164 text check (caller_e164 is null or caller_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  called_e164 text check (called_e164 is null or called_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  guest_name text,
  started_at timestamptz not null,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  outcome text,
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, phone_number_id)
    references public.organization_phone_numbers(organization_id, id) on delete set null,
  foreign key (organization_id, receptionist_instance_id)
    references public.receptionist_instances(organization_id, id) on delete set null,
  unique (provider, provider_call_id),
  unique (organization_id, id),
  check (answered_at is null or answered_at >= started_at),
  check (ended_at is null or ended_at >= started_at)
);
create index calls_org_started_idx on public.calls(organization_id, started_at desc);
create index calls_org_status_idx on public.calls(organization_id, status, started_at desc);

create table public.call_capacity_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  call_id uuid not null,
  receptionist_instance_id uuid,
  status text not null default 'active' check (status in ('active','released','expired')),
  lease_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  foreign key (organization_id, call_id) references public.calls(organization_id, id) on delete cascade,
  foreign key (organization_id, receptionist_instance_id)
    references public.receptionist_instances(organization_id, id) on delete set null,
  unique (call_id),
  check ((status = 'active' and released_at is null) or status <> 'active')
);
create index call_capacity_active_org_idx
  on public.call_capacity_reservations(organization_id, lease_expires_at)
  where status = 'active';

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 2 and 100),
  entity_type text,
  entity_id uuid,
  summary text not null check (char_length(summary) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index activity_events_org_created_idx on public.activity_events(organization_id, created_at desc);

-- Updated-at trigger is intentionally SECURITY INVOKER and lives outside the exposed schema.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$function$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

do $block$
declare
  t text;
begin
  foreach t in array array[
    'subscription_plans','subscription_plan_entitlements','subscription_prices',
    'organization_subscriptions','subscription_provider_events',
    'organization_phone_numbers','phone_number_channels','receptionist_instances',
    'receptionist_number_routes','guests','rooms','reservations','calls',
    'call_capacity_reservations','activity_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$block$;

-- Public catalog is read-only. No plan is purchasable until pricing and limits are approved.
grant select on public.subscription_plans, public.subscription_plan_entitlements, public.subscription_prices to anon, authenticated;
create policy subscription_plans_public_read on public.subscription_plans
  for select to anon, authenticated using (is_listed);
create policy subscription_entitlements_public_read on public.subscription_plan_entitlements
  for select to anon, authenticated using (
    exists (select 1 from public.subscription_plans p where p.id = plan_id and p.is_listed)
  );
create policy subscription_prices_public_read on public.subscription_prices
  for select to anon, authenticated using (is_active and (effective_until is null or effective_until > now()));

-- Subscription and integration records are visible to tenant members, never writable from browser.
grant select on public.organization_subscriptions to authenticated;
create policy organization_subscriptions_member_read on public.organization_subscriptions
  for select to authenticated using ((select private.is_organization_member(organization_id)));

grant select on public.organization_phone_numbers to authenticated;
create policy organization_phone_numbers_member_read on public.organization_phone_numbers
  for select to authenticated using ((select private.is_organization_member(organization_id)));

grant select on public.phone_number_channels to authenticated;
create policy phone_number_channels_member_read on public.phone_number_channels
  for select to authenticated using ((select private.is_organization_member(organization_id)));

grant select on public.receptionist_instances to authenticated;
create policy receptionist_instances_member_read on public.receptionist_instances
  for select to authenticated using ((select private.is_organization_member(organization_id)));

grant select on public.receptionist_number_routes to authenticated;
create policy receptionist_number_routes_member_read on public.receptionist_number_routes
  for select to authenticated using ((select private.is_organization_member(organization_id)));

grant select on public.calls to authenticated;
create policy calls_member_read on public.calls
  for select to authenticated using ((select private.is_organization_member(organization_id)));

grant select, insert, update on public.guests to authenticated;
create policy guests_member_read on public.guests
  for select to authenticated using ((select private.is_organization_member(organization_id)));
create policy guests_ops_insert on public.guests
  for insert to authenticated
  with check ((select private.has_organization_role(organization_id, array['owner','manager','operations']::text[])));
create policy guests_ops_update on public.guests
  for update to authenticated
  using ((select private.has_organization_role(organization_id, array['owner','manager','operations']::text[])))
  with check ((select private.has_organization_role(organization_id, array['owner','manager','operations']::text[])));

grant select, insert, update on public.rooms to authenticated;
create policy rooms_member_read on public.rooms
  for select to authenticated using ((select private.is_organization_member(organization_id)));
create policy rooms_ops_insert on public.rooms
  for insert to authenticated
  with check ((select private.has_organization_role(organization_id, array['owner','manager','operations']::text[])));
create policy rooms_ops_update on public.rooms
  for update to authenticated
  using ((select private.has_organization_role(organization_id, array['owner','manager','operations']::text[])))
  with check ((select private.has_organization_role(organization_id, array['owner','manager','operations']::text[])));

grant select, insert, update on public.reservations to authenticated;
create policy reservations_member_read on public.reservations
  for select to authenticated using ((select private.is_organization_member(organization_id)));
create policy reservations_ops_insert on public.reservations
  for insert to authenticated
  with check ((select private.has_organization_role(organization_id, array['owner','manager','operations']::text[])));
create policy reservations_ops_update on public.reservations
  for update to authenticated
  using ((select private.has_organization_role(organization_id, array['owner','manager','operations']::text[])))
  with check ((select private.has_organization_role(organization_id, array['owner','manager','operations']::text[])));

grant select on public.activity_events to authenticated;
create policy activity_events_member_read on public.activity_events
  for select to authenticated using ((select private.is_organization_member(organization_id)));

-- Provider webhook payloads and concurrency leases are server-only.
revoke all on public.subscription_provider_events, public.call_capacity_reservations from anon, authenticated;
grant all on public.subscription_provider_events, public.call_capacity_reservations to service_role;
grant all on public.organization_subscriptions, public.organization_phone_numbers,
  public.phone_number_channels, public.receptionist_instances, public.receptionist_number_routes,
  public.calls, public.activity_events to service_role;
grant all on public.guests, public.rooms, public.reservations to service_role;

-- Trigger timestamps remain consistent regardless of which trusted writer updates a row.
do $block$
declare
  t text;
begin
  foreach t in array array[
    'subscription_plans','subscription_plan_entitlements','organization_subscriptions',
    'organization_phone_numbers','phone_number_channels','receptionist_instances',
    'receptionist_number_routes','guests','rooms','reservations','calls'
  ]
  loop
    execute format('create trigger %I before update on public.%I for each row execute function private.touch_updated_at()', t || '_touch_updated_at', t);
  end loop;
end
$block$;

-- Seed only the public plan catalogue, not users, organizations, or billing records.
insert into public.subscription_plans (code, name, description, display_order, is_listed, is_available_for_purchase)
values
  ('starter','Starter','The essentials for one business number and one AI receptionist.',1,true,false),
  ('growth','Growth','More connected numbers and AI receptionist capacity as your business grows.',2,true,false),
  ('premium','Premium','Expanded receptionist capacity for busy, multi-line operations.',3,true,false),
  ('enterprise','Enterprise','Custom capacity, onboarding, and support for larger operations.',4,true,false)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    display_order = excluded.display_order,
    is_listed = true;

insert into public.subscription_plan_entitlements
  (plan_id, phone_number_limit, receptionist_instance_limit, concurrent_call_limit, team_member_limit, custom_entitlements, configuration_status)
select p.id,
       case when p.code = 'starter' then 1 else null end,
       case when p.code = 'starter' then 1 else null end,
       null,
       null,
       p.code = 'enterprise',
       'pending'
from public.subscription_plans p
on conflict (plan_id) do update
set phone_number_limit = excluded.phone_number_limit,
    receptionist_instance_limit = excluded.receptionist_instance_limit,
    concurrent_call_limit = excluded.concurrent_call_limit,
    team_member_limit = excluded.team_member_limit,
    custom_entitlements = excluded.custom_entitlements,
    configuration_status = 'pending';

-- All newly created tables have RLS and explicit least-privilege grants.
