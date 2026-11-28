begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

-- Property-domain objects must be created by the complete migration stack.
select ok(to_regclass('public.organization_modules') is not null, 'organization_modules exists');
select ok(to_regclass('public.properties') is not null, 'properties exists');
select ok(to_regclass('public.property_staff_assignments') is not null, 'property_staff_assignments exists');
select ok(to_regclass('public.room_types') is not null, 'room_types exists');

-- Every exposed property-domain table must have RLS enabled.
select ok((select relrowsecurity from pg_class where oid = 'public.organization_modules'::regclass), 'organization_modules has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.properties'::regclass), 'properties has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.property_staff_assignments'::regclass), 'property_staff_assignments has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.room_types'::regclass), 'room_types has RLS enabled');

-- Legacy inventory must be fully assigned to a property and room type.
select ok((select attnotnull from pg_attribute where attrelid = 'public.rooms'::regclass and attname = 'property_id' and not attisdropped), 'rooms.property_id is NOT NULL');
select ok((select attnotnull from pg_attribute where attrelid = 'public.rooms'::regclass and attname = 'room_type_id' and not attisdropped), 'rooms.room_type_id is NOT NULL');
select ok((select attnotnull from pg_attribute where attrelid = 'public.reservations'::regclass and attname = 'property_id' and not attisdropped), 'reservations.property_id is NOT NULL');

-- The index expressions must match the normalized collision preflight.
select ok(pg_get_indexdef('public.rooms_property_room_number_unique'::regclass) ilike '%lower(btrim(room_number))%', 'room-number uniqueness normalizes case and surrounding whitespace');
select ok(pg_get_indexdef('public.room_types_property_name_unique'::regclass) ilike '%lower(btrim(name))%', 'room-type uniqueness normalizes case and surrounding whitespace');

-- Public roles must not access tenant property records or administrative operations.
select ok(not has_table_privilege('anon', 'public.properties', 'SELECT'), 'anon cannot select properties directly');
select ok(not has_table_privilege('anon', 'public.room_types', 'SELECT'), 'anon cannot select room types directly');
select ok(not has_table_privilege('authenticated', 'public.properties', 'DELETE'), 'authenticated cannot delete properties');
select ok(not has_table_privilege('authenticated', 'public.properties', 'TRUNCATE'), 'authenticated cannot truncate properties');
select ok(not has_table_privilege('authenticated', 'public.room_types', 'MAINTAIN'), 'authenticated cannot maintain room types');

-- Only approved property columns may be updated by authenticated clients.
select ok(has_column_privilege('authenticated', 'public.properties', 'name', 'UPDATE'), 'authenticated may update approved property name');
select ok(not has_column_privilege('authenticated', 'public.properties', 'organization_id', 'UPDATE'), 'authenticated cannot reassign property organization');
select ok(has_column_privilege('authenticated', 'public.property_staff_assignments', 'revoked_at', 'UPDATE'), 'authenticated has the explicitly granted assignment revocation column');
select ok(not has_column_privilege('authenticated', 'public.property_staff_assignments', 'user_id', 'UPDATE'), 'authenticated cannot reassign an assigned user');

-- RPC/helper execute grants must match the intended trust boundary.
select ok(not has_function_privilege('anon', 'public.create_property(uuid,text,text,text,text,text,text,text,text)', 'EXECUTE'), 'anon cannot execute create_property');
select ok(has_function_privilege('authenticated', 'public.create_property(uuid,text,text,text,text,text,text,text,text)', 'EXECUTE'), 'authenticated can execute create_property');
select ok(not has_function_privilege('anon', 'private.has_property_role(uuid,uuid,text[])', 'EXECUTE'), 'anon cannot execute property-role helper');
select ok(has_function_privilege('authenticated', 'private.has_property_role(uuid,uuid,text[])', 'EXECUTE'), 'authenticated can execute property-role helper');

-- Trigger guards must exist on property creation and active inventory.
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.properties'::regclass and tgname = 'properties_assign_creator' and not tgisinternal), 'property creator assignment trigger exists');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.rooms'::regclass and tgname = 'rooms_require_active_room_type' and not tgisinternal), 'room active-room-type guard exists');

select * from finish();
rollback;
