-- Move the privileged tenant bootstrap implementation out of the exposed API schema.
-- Keep the public PostgREST RPC as a SECURITY INVOKER wrapper.
alter function public.create_organization(text, text, text, text)
  set schema private;

create or replace function public.create_organization(
  p_name text,
  p_business_type text,
  p_timezone text default 'Africa/Accra',
  p_currency text default 'GHS'
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_organization(p_name, p_business_type, p_timezone, p_currency);
$$;

revoke all on function public.create_organization(text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text) to authenticated;
revoke all on function private.create_organization(text, text, text, text) from public, anon;
grant execute on function private.create_organization(text, text, text, text) to authenticated;

create index if not exists organizations_created_by_idx
  on public.organizations (created_by)
  where created_by is not null;

create index if not exists organization_memberships_invited_by_idx
  on public.organization_memberships (invited_by)
  where invited_by is not null;
