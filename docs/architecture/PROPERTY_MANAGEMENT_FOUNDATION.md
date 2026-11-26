# Property Management foundation

Status: proposed implementation, not applied to Supabase production.

## Scope

This slice introduces the first-class property layer for VELLARA Owner Desk and moves hospitality room inventory from organization scope to property scope.

## Data model

- `organization_modules`: independent hospitality and real-estate enablement. An organization may enable both.
- `properties`: a property belongs to one organization and one vertical. Hospitality and real-estate properties are distinct records.
- `property_staff_assignments`: explicit property access for non-owner staff. Owners inherit access to every property. Managers, operations and verification users require an active assignment for the relevant property.
- `room_types`: property-specific user-managed room type definitions. No fixed catalogue is seeded. Existing free-text room types are preserved only as a legacy data backfill.
- `rooms`: each room belongs to one property and one room type within that property.
- `reservations`: each reservation belongs to a property. A composite foreign key prevents a reservation from pointing to a room in another property.

## Inheritance

A property's `timezone_override` and `currency_override` are nullable and independent. Effective values are:

- timezone: property override, otherwise `business_profiles.timezone`
- currency: property override, otherwise `business_profiles.currency`

The organization profile remains the source of defaults. This migration does not duplicate those defaults onto each property.

## Lifecycle and safety

- Properties are archived or marked inactive, not hard-deleted through the browser.
- Room types can be deactivated and archived, not destructively deleted.
- Existing rooms/reservations receive a single legacy hospitality property only where records need a parent. No sample records are created.
- New room numbers are unique within a property, allowing the same room number in different properties.
- Room types are unique by name within a property.
- Room and reservation RLS policies are replaced with property-scoped policies.
- A property creator who is not an owner is assigned to the newly created property.
- The database does not trust frontend filtering for tenant or property isolation.

## Not included in this slice

- Real-estate listing, offer, viewing, sale and rental transaction tables.
- Room transfer workflow and immutable transfer audit.
- Reservation hold expiry/concurrency workflow.
- Property assignment management UI.
- Automated room status transitions based on check-in/out.
- Property media and mini-website publishing.

## Validation required before production

1. Replay all migrations from a clean isolated Supabase environment.
2. Test RLS as owner, assigned manager, assigned operations user, assigned verification user, unassigned member, and cross-tenant user.
3. Test property/module mismatch, room type from another property, room from another property, and duplicate room number within/across properties.
4. Test legacy backfill with multiple old room type values and reservations with/without room assignments.
5. Run Supabase security and performance advisors.
6. Only after successful isolated replay and explicit approval should the migration be applied to production.

## Known review point

The current organization-level business profile still contains a single legacy `business_type`. The new `organization_modules` table becomes the source of truth for enabled verticals. A later frontend settings change must stop treating the old field as a mutually exclusive module selector.
