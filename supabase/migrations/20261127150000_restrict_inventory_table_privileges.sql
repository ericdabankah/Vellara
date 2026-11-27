-- Tighten excessive default SQL privileges across the current public schema.
-- RLS does not protect TRUNCATE, and tenant-owned operational tables are not public.
-- Keep only the grants required by the current authenticated read/write policies.
-- Public subscription catalogue tables retain SELECT for anon/authenticated only.
-- This forward migration is for isolated replay and review; do not apply to
-- production until the complete migration stack and privilege tests are approved.

-- Tenant-owned / operational tables: no anonymous or PUBLIC access.
revoke all privileges on table
  public.activity_events,
  public.calls,
  public.guests,
  public.organization_phone_numbers,
  public.organization_subscriptions,
  public.phone_number_channels,
  public.receptionist_instances,
  public.receptionist_number_routes,
  public.reservations,
  public.rooms
from public, anon;

-- Read-only tenant tables: authenticated users need SELECT only.
revoke insert, update, delete, truncate, maintain, references, trigger
  on table
    public.activity_events,
    public.calls,
    public.organization_phone_numbers,
    public.organization_subscriptions,
    public.phone_number_channels,
    public.receptionist_instances,
    public.receptionist_number_routes
from authenticated;

-- These three tables intentionally expose a public catalogue read surface.
-- Remove every other anonymous/public privilege, then restore SELECT only.
revoke all privileges on table
  public.subscription_plan_entitlements,
  public.subscription_plans,
  public.subscription_prices
from public, anon;

grant select on table
  public.subscription_plan_entitlements,
  public.subscription_plans,
  public.subscription_prices
to anon, authenticated;

revoke insert, update, delete, truncate, maintain, references, trigger
  on table
    public.subscription_plan_entitlements,
    public.subscription_plans,
    public.subscription_prices
from authenticated;

-- Authenticated users may create/update guests, rooms, and reservations only
-- through their existing RLS policies and explicitly granted update columns.
-- RLS cannot constrain DELETE/TRUNCATE/REFERENCES/TRIGGER privileges.
revoke delete, truncate, maintain, references, trigger
  on table public.guests, public.reservations, public.rooms
from authenticated;
