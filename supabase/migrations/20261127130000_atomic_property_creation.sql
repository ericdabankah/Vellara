-- Atomic property onboarding.
-- This RPC runs as the authenticated caller so the existing RLS policies
-- remain in force. Module enablement and property creation share one transaction.

create or replace function public.create_property(
  p_organization_id uuid,
  p_vertical text,
  p_name text,
  p_slug text,
  p_description text default '',
  p_city text default null,
  p_region text default null,
  p_timezone_override text default null,
  p_currency_override text default null
)
returns public.properties
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  created_property public.properties;
  normalized_name text := btrim(p_name);
  normalized_slug text := lower(btrim(p_slug));
  normalized_timezone text := nullif(btrim(p_timezone_override), '');
  normalized_currency text := nullif(upper(btrim(p_currency_override)), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to create a property'
      using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'An organization is required'
      using errcode = '22023';
  end if;

  if p_vertical not in ('hospitality', 'real_estate') then
    raise exception 'Unsupported property vertical'
      using errcode = '22023';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 2 and 120 then
    raise exception 'Property name must contain between 2 and 120 characters'
      using errcode = '22023';
  end if;

  if normalized_slug is null or normalized_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Property slug must contain lowercase letters, numbers, and single hyphen separators'
      using errcode = '22023';
  end if;

  if normalized_currency is not null and normalized_currency !~ '^[A-Z]{3}$' then
    raise exception 'Currency override must be a three-letter ISO-style code'
      using errcode = '22023';
  end if;

  if normalized_timezone is not null and not exists (
    select 1
    from pg_catalog.pg_timezone_names timezone_name
    where timezone_name.name = normalized_timezone
  ) then
    raise exception 'Timezone override must be a supported IANA timezone'
      using errcode = '22023';
  end if;

  if not (select private.has_organization_role(
    p_organization_id,
    array['owner', 'manager']::text[]
  )) then
    raise exception 'Your workspace role cannot create properties'
      using errcode = '42501';
  end if;

  -- Both writes execute in this RPC transaction. If property insertion fails,
  -- module enablement is rolled back with it.
  insert into public.organization_modules (
    organization_id, module_key, is_enabled, enabled_at, disabled_at
  )
  values (
    p_organization_id, p_vertical, true, now(), null
  )
  on conflict (organization_id, module_key) do update
    set is_enabled = true,
        enabled_at = case
          when public.organization_modules.is_enabled then public.organization_modules.enabled_at
          else now()
        end,
        disabled_at = null,
        updated_at = now();

  insert into public.properties (
    organization_id, vertical, name, slug, description,
    city, region, timezone_override, currency_override, created_by
  )
  values (
    p_organization_id,
    p_vertical,
    normalized_name,
    normalized_slug,
    coalesce(btrim(p_description), ''),
    nullif(btrim(p_city), ''),
    nullif(btrim(p_region), ''),
    normalized_timezone,
    normalized_currency,
    (select auth.uid())
  )
  returning * into created_property;

  return created_property;
end;
$function$;

revoke all on function public.create_property(
  uuid, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.create_property(
  uuid, text, text, text, text, text, text, text, text
) to authenticated;

comment on function public.create_property(
  uuid, text, text, text, text, text, text, text, text
) is 'Atomically enables a workspace module and creates one property under the authenticated caller’s existing RLS permissions.';
