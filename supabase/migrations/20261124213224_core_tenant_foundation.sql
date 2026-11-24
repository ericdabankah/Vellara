-- VELLARA core tenant and identity foundation
-- Scope: profiles, organizations, memberships, business profile, tenant RLS.
-- No operational modules, demo data, or frontend assumptions are introduced.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.organization_status as enum ('active', 'suspended', 'archived');
create type public.organization_member_role as enum ('owner', 'manager', 'operations', 'verification');
create type public.organization_membership_status as enum ('active', 'invited', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone_e164 text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 120),
  constraint profiles_phone_e164_format check (phone_e164 is null or phone_e164 ~ '^\\+[1-9][0-9]{7,14}$')
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status public.organization_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_length check (char_length(btrim(name)) between 2 and 120)
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.organization_member_role not null,
  status public.organization_membership_status not null default 'active',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_memberships_user_status_idx
  on public.organization_memberships (user_id, status);
create index organization_memberships_org_role_status_idx
  on public.organization_memberships (organization_id, role, status);

create table public.business_profiles (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  business_type text not null,
  display_name text not null,
  legal_name text,
  description text,
  contact_email text,
  contact_phone_e164 text,
  website_url text,
  country_code char(2) not null default 'GH',
  timezone text not null default 'Africa/Accra',
  currency char(3) not null default 'GHS',
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_profiles_type_check
    check (business_type in ('hotel', 'real_estate', 'other')),
  constraint business_profiles_display_name_length
    check (char_length(btrim(display_name)) between 2 and 120),
  constraint business_profiles_country_code_format
    check (country_code ~ '^[A-Z]{2}$'),
  constraint business_profiles_currency_format
    check (currency ~ '^[A-Z]{3}$'),
  constraint business_profiles_contact_phone_format
    check (contact_phone_e164 is null or contact_phone_e164 ~ '^\\+[1-9][0-9]{7,14}$')
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row execute function private.set_updated_at();

create trigger business_profiles_set_updated_at
before update on public.business_profiles
for each row execute function private.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), '')
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function private.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function private.has_organization_role(
  p_organization_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role::text = any (p_roles)
  );
$$;

revoke all on function private.is_organization_member(uuid) from public, anon;
revoke all on function private.has_organization_role(uuid, text[]) from public, anon;
grant execute on function private.is_organization_member(uuid) to authenticated;
grant execute on function private.has_organization_role(uuid, text[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.business_profiles enable row level security;

create policy profiles_select_self
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_self
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy organizations_select_member
on public.organizations for select
to authenticated
using ((select private.is_organization_member(id)));

create policy organizations_update_owner_manager
on public.organizations for update
to authenticated
using ((select private.has_organization_role(id, array['owner', 'manager'])))
with check ((select private.has_organization_role(id, array['owner', 'manager'])));

create policy memberships_select_self_or_admin
on public.organization_memberships for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_organization_role(organization_id, array['owner', 'manager']))
);

create policy business_profiles_select_member
on public.business_profiles for select
to authenticated
using ((select private.is_organization_member(organization_id)));

create policy business_profiles_update_owner_manager
on public.business_profiles for update
to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'manager'])))
with check ((select private.has_organization_role(organization_id, array['owner', 'manager'])));

revoke all on public.profiles from anon, authenticated;
revoke all on public.organizations from anon, authenticated;
revoke all on public.organization_memberships from anon, authenticated;
revoke all on public.business_profiles from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, phone_e164, avatar_path) on public.profiles to authenticated;

grant select on public.organizations to authenticated;
grant update (name) on public.organizations to authenticated;

grant select on public.organization_memberships to authenticated;

grant select on public.business_profiles to authenticated;
grant update (
  display_name,
  legal_name,
  description,
  contact_email,
  contact_phone_e164,
  website_url,
  country_code,
  timezone,
  currency,
  address_line_1,
  address_line_2,
  city,
  region,
  postal_code
) on public.business_profiles to authenticated;

create or replace function public.create_organization(
  p_name text,
  p_business_type text,
  p_timezone text default 'Africa/Accra',
  p_currency text default 'GHS'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_business_type text := lower(btrim(coalesce(p_business_type, '')));
  v_timezone text := coalesce(nullif(btrim(p_timezone), ''), 'Africa/Accra');
  v_currency text := upper(coalesce(nullif(btrim(p_currency), ''), 'GHS'));
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if char_length(v_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Business name must be between 2 and 120 characters';
  end if;

  if v_business_type not in ('hotel', 'real_estate', 'other') then
    raise exception using errcode = '22023', message = 'Unsupported business type';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception using errcode = '22023', message = 'Currency must be a 3-letter ISO code';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    raise exception using errcode = '22023', message = 'Unknown timezone';
  end if;

  insert into public.organizations (name, created_by)
  values (v_name, v_user_id)
  returning id into v_organization_id;

  insert into public.business_profiles (
    organization_id,
    business_type,
    display_name,
    timezone,
    currency
  )
  values (
    v_organization_id,
    v_business_type,
    v_name,
    v_timezone,
    v_currency
  );

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status
  )
  values (
    v_organization_id,
    v_user_id,
    'owner',
    'active'
  );

  return v_organization_id;
end;
$$;

revoke all on function public.create_organization(text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text) to authenticated;
