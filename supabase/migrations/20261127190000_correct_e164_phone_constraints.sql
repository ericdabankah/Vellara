-- Correct the leading-plus E.164 checks with an unambiguous character class.
-- Historical migrations are already applied; this is a forward-only correction.
-- Existing rows are validated when the new constraints are added.

alter table public.profiles
  drop constraint if exists profiles_phone_e164_format,
  add constraint profiles_phone_e164_format
    check (
      phone_e164 is null
      or phone_e164 ~ '^[+][1-9][0-9]{7,14}$'
    );

alter table public.business_profiles
  drop constraint if exists business_profiles_contact_phone_format,
  add constraint business_profiles_contact_phone_format
    check (
      contact_phone_e164 is null
      or contact_phone_e164 ~ '^[+][1-9][0-9]{7,14}$'
    );
