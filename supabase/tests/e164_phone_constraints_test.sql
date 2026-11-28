-- Minimal isolated PostgreSQL test for the forward E.164 constraint migration.
create table public.profiles (phone_e164 text);
create table public.business_profiles (contact_phone_e164 text);

\i supabase/migrations/20261127190000_correct_e164_phone_constraints.sql

do $$
begin
  if not ('+233501234567' ~ '^[+][1-9][0-9]{7,14}$') then
    raise exception 'Valid Ghana E.164 number was rejected by the expression';
  end if;
  if ('233501234567' ~ '^[+][1-9][0-9]{7,14}$') then
    raise exception 'Number without leading plus was accepted';
  end if;
  if ('\233501234567' ~ '^[+][1-9][0-9]{7,14}$') then
    raise exception 'Number with leading backslash was accepted';
  end if;
  if ('+0233501234567' ~ '^[+][1-9][0-9]{7,14}$') then
    raise exception 'Country code beginning with zero was accepted';
  end if;
  if not ('+12345678' ~ '^[+][1-9][0-9]{7,14}$') then
    raise exception 'Minimum-length E.164 number was rejected';
  end if;
  if ('+1234567' ~ '^[+][1-9][0-9]{7,14}$') then
    raise exception 'Too-short number was accepted';
  end if;
  if ('+23350123456789012' ~ '^[+][1-9][0-9]{7,14}$') then
    raise exception 'Too-long number was accepted';
  end if;
end;
$$;

insert into public.profiles (phone_e164) values ('+233501234567');
insert into public.business_profiles (contact_phone_e164) values ('+233501234567');

do $$
begin
  begin
    insert into public.profiles (phone_e164) values ('233501234567');
    raise exception 'profiles accepted a number without the leading plus';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.business_profiles (contact_phone_e164) values ('\233501234567');
    raise exception 'business_profiles accepted a number with a leading backslash';
  exception when check_violation then
    null;
  end;
end;
$$;
