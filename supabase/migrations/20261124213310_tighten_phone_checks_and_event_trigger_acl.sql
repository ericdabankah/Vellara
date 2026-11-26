alter table public.profiles
  drop constraint profiles_phone_e164_format,
  add constraint profiles_phone_e164_format
    check (phone_e164 is null or phone_e164 ~ '^\\+[1-9][0-9]{7,14}$');

alter table public.business_profiles
  drop constraint business_profiles_contact_phone_format,
  add constraint business_profiles_contact_phone_format
    check (contact_phone_e164 is null or contact_phone_e164 ~ '^\\+[1-9][0-9]{7,14}$');

-- Keep the existing DDL event trigger that automatically enables RLS,
-- but prevent direct RPC invocation by API roles.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
