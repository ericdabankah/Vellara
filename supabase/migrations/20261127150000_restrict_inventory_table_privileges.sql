-- Restrict SQL privileges on tenant-owned inventory tables.
-- RLS does not protect TRUNCATE, and these operational tables are not public.
-- Keep authenticated SELECT/INSERT and the column-scoped UPDATE grants from
-- the property foundation migration. Do not grant destructive table privileges.
-- This is a forward migration for isolated replay and review; do not apply to
-- production until the full migration stack has been tested and approved.

revoke all privileges on table public.rooms, public.reservations
  from public, anon;

revoke delete, truncate, references, trigger
  on table public.rooms, public.reservations
  from authenticated;
