-- Close the table-level UPDATE privilege inherited from the project's
-- public-schema default ACL. RLS controls rows, but it does not narrow which
-- columns an authenticated user may update.
--
-- The property foundation already declares explicit column-level UPDATE
-- grants. Revoke the broader table-level privilege so those column grants
-- become the effective boundary. Column-level grants from the preceding
-- migration are preserved by this table-level REVOKE; they are repeated here
-- to make the intended access contract explicit and reviewable.

revoke update on table
  public.organization_modules,
  public.properties,
  public.property_staff_assignments,
  public.room_types
from authenticated;

grant update (is_enabled, disabled_at)
  on table public.organization_modules to authenticated;

grant update (
  name,
  slug,
  description,
  status,
  address_line_1,
  address_line_2,
  city,
  region,
  postal_code,
  country_code,
  timezone_override,
  currency_override
) on table public.properties to authenticated;

grant update (revoked_at)
  on table public.property_staff_assignments to authenticated;

grant update (
  name,
  description,
  default_capacity,
  bed_configuration,
  amenities,
  default_nightly_rate_minor,
  is_active,
  archived_at
) on table public.room_types to authenticated;
