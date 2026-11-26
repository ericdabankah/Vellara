# VELLARA Phase 1 Domain Design: Accommodation Operations

**Status:** Design proposal, not an approved or executed schema change  
**Date:** 2026-11-26  
**Scope:** Owner Desk and Supabase domain design for hotels, serviced apartments, short-stay apartments, and B&B operators.

## 1. Design objective

Give a business operator one reliable place to manage multiple properties, their bookable units, guests, reservations, and daily room operations.

The existing database already has tenant organizations, business profiles, guests, rooms, reservations, and activity events. Phase 1 should extend this foundation rather than replace it or create a parallel booking system.

## 2. Existing database facts

The current production schema has these relevant tables:

- `organizations`: tenant boundary.
- `organization_memberships`: user membership and current broad roles.
- `business_profiles`: one business profile per organization.
- `guests`: accommodation guest records.
- `rooms`: current room/unit records, currently scoped directly to an organization.
- `reservations`: guest and room references, stay dates, guest counts, status, and amount snapshot fields.
- `activity_events`: workspace activity feed.

The current `rooms` table has room number, room type text, floor label, capacity, operational status, nightly rate, currency, and notes. It does not have a property/building relationship or a normalized room-type record.

The current `reservations` table references `rooms` and `guests` using tenant-aware composite foreign keys. It already has a departure-after-arrival check and separate reservation/room conflict protection in the recovered migration history. Those safeguards must be preserved.

## 3. Proposed domain model

### A. Properties

Introduce a tenant-owned `properties` entity as the parent of bookable accommodation units.

Proposed attributes:
- `id`
- `organization_id`
- `name`
- `property_code` (optional, unique within the organization when supplied)
- `property_type` (hotel, serviced_apartment, short_stay, bed_and_breakfast, other)
- `description`
- `address_line_1`, `address_line_2`, `city`, `region`, `country_code`, `postal_code`
- `timezone` (nullable override), `currency` (nullable override)
- `status` (active, inactive, archived)
- `created_at`, `updated_at`

A property belongs to exactly one organization. Property reads and writes must check active organization membership and role. Composite uniqueness on `(organization_id, id)` should support tenant-safe child references. **Approved configuration rule:** each property inherits the organization's default currency and timezone unless it explicitly overrides either value. A null property-level value means inherit; it must not be treated as an independent fallback or silently copied as a permanent default. The Owner Desk should show the effective value and make overrides explicit. Currency and timezone resolution must be server-side as well as reflected in the UI.

### B. Room types

Introduce `room_types` as reusable accommodation categories within a property.

Proposed attributes:
- `id`, `organization_id`, `property_id`
- `name`, `code`, `description`
- `default_capacity`
- `bed_configuration` (structured but validated)
- `base_rate_minor`, `currency`
- `amenities` (controlled list or normalized relation after requirements are confirmed)
- `created_at`, `updated_at`

Room types should not be global across tenants. Initial implementation can scope each type to a property to avoid accidental cross-property assumptions. A later shared-template model can be considered if real operators need it.

### C. Rooms / bookable units

Keep the existing `rooms` table as the bookable-unit record to preserve frontend and reservation compatibility.

Proposed additive attributes:
- `property_id` (tenant-safe FK to `properties`)
- `room_type_id` (optional tenant-safe FK to `room_types`)
- `display_name` (optional; room number remains the operational identifier)
- `is_bookable` (explicitly distinguish sellable inventory from operational/maintenance records)

Existing fields remain authoritative where already used. The free-text `room_type` field should be retained during a compatibility period; a later migration can backfill and make the normalized relationship authoritative after the frontend and backend contracts are migrated.

A safe migration must consider existing rooms with no property. Do not add a non-null property FK until a deterministic backfill strategy is implemented and tested. Do not silently assign existing inventory to a made-up property.

### D. Reservations

Preserve the existing `reservations` table and its current tenant-safe references.

Phase 1 should add or design:
- Reservation status history rather than relying only on the current mutable status.
- Explicit check-in and check-out timestamps and actor IDs.
- Cancellation/no-show reason fields where operationally useful.
- Property relationship only if needed for performant reporting; otherwise derive property through the assigned room to avoid redundant inconsistent values.
- A defined unassigned reservation policy for enquiries and walk-ins.

A reservation may begin as an enquiry without a room assignment. A confirmed room reservation must reference a valid bookable unit and must pass authoritative availability/conflict checks.

### E. Guest records

Keep `guests` as the accommodation-facing guest profile in Phase 1. Do not prematurely merge it into a universal customer/contact model. Phase 2 will design canonical cross-channel customer identities and channel identities, then define a safe link between a customer and one or more accommodation guest profiles.

## 4. Reservation and availability invariants

- Every tenant-owned record must be tied to one organization.
- A child row must not reference a property, room type, room, or guest belonging to another organization.
- Departure date must be later than arrival date.
- Confirmed/checked-in reservations must not overlap for the same bookable unit, according to the existing conflict-protection rules.
- Pending and inquiry holds must have explicitly defined expiry/availability semantics before they can block inventory.
- Room operational status (available, occupied, maintenance, out of service) is not a substitute for date-based reservation availability.
- A room being marked available must not override a conflicting confirmed reservation.
- A reservation status change must not be treated as payment confirmation.
- Walk-ins are registered by a staff member in Owner Desk. No self-service kiosk or autonomous check-in in Phase 1.

## 5. Owner Desk information architecture

Phase 1 navigation should evolve from a single generic Rooms list to:

1. **Overview:** real occupancy and arrivals/departures derived from authoritative records.
2. **Properties:** property list, property profile, operational status, and property-level summary.
3. **Room inventory:** property filter, room/unit list, room type, capacity, operational status, and nightly rate.
4. **Guests:** searchable guest directory and guest history.
5. **Reservations:** arrivals, departures, enquiries, confirmed stays, cancellations, and unassigned reservations.
6. **Activity:** audit-backed operational timeline.
7. **Settings:** business profile and timezone/currency settings.

The property selector must be explicit when a tenant has more than one property. Do not silently mix room counts, occupancy, or reservation metrics across properties without making the selected scope visible.

## 6. Key user journeys

### Create a property
- Staff with the required permission opens Properties.
- Enters property name, type, and address; timezone and currency default to the organization settings, with optional explicit overrides.
- Reviews and confirms.
- UI reports success only after the database confirms the insert.
- Property appears in the property switcher/list.

### Add a room/unit
- Staff selects a property.
- Enters room identifier, room type, capacity, operational status, and rate.
- UI validates required fields and numeric values.
- Save writes to the selected property and organization.
- Duplicate room identifiers are surfaced clearly.

### Register a walk-in
- Staff searches for an existing guest or creates a guest profile.
- Staff selects property and available unit.
- Staff enters arrival/departure and guest counts.
- Availability is checked by the authoritative backend/database.
- Staff reviews and confirms the reservation.
- Payment remains a separate workflow and is not inferred from this action.

### Check-in / check-out
- Staff opens the reservation.
- UI shows current reservation state, guest, assigned unit, dates, and any payment state that is actually recorded.
- Authorized staff confirms the transition.
- Server-side state transition and audit record are authoritative.
- UI does not infer physical access or smart-lock behaviour.

## 7. Role and access model

The existing membership roles are broad: owner, manager, operations, and verification. Phase 1 can map them to an initial permission matrix, but frontend hiding is not authorization.

Proposed initial intent:
- **Owner:** full tenant configuration and operational access.
- **Manager:** property and operational management; sensitive commercial permissions remain explicit.
- **Operations:** guest, reservation, and room operations within granted scope.
- **Verification:** receipt/transaction verification when that domain is implemented; no general property or pricing administration by default.

Property-level staff scope is not yet represented in the current schema. Decide whether Phase 1 requires per-property membership before adding staff assignment features. Do not assume organization-wide membership automatically means every staff member should access every property.

## 8. Migration strategy proposal

No SQL is executed by this design document.

A future migration sequence should be incremental:

1. Create `properties` with tenant ownership, constraints, indexes, RLS, and explicit grants.
2. Create `room_types` with tenant/property-safe foreign keys and access policies.
3. Add nullable `property_id` and optional `room_type_id` to `rooms`, with tenant-safe composite foreign keys.
4. Define and test a deterministic backfill for any existing rooms before enforcing required property ownership.
5. Update generated database types and frontend data access.
6. Add reservation status history and lifecycle fields only after transition rules and Worker ownership are agreed.
7. Add role/property-scope enforcement and tests before exposing staff assignment controls.

Each migration must be additive, preserve existing reservation protections, and include tenant isolation and least-privilege review. Never edit an applied migration.

## 9. Open decisions before schema implementation

- **Resolved:** organization-level default currency and timezone, with nullable per-property overrides. A property inherits either default independently unless it explicitly overrides that setting.
- Can a room/unit be moved between properties, and if so, what happens to future reservations?
- Are room types property-specific or shared across all properties under one organization?
- Do pending reservations block inventory, and for how long?
- Does a property need property-level staff access in the first operational release?
- Are room rates simple nightly prices initially, or do seasonal/date-based rate plans belong in Phase 1?

Remaining decisions must be resolved before writing the migration.

## 10. Acceptance checklist

- [ ] Property model supports multiple properties per organization.
- [ ] Room inventory remains compatible with existing reservations.
- [ ] Cross-tenant and cross-property references are rejected.
- [ ] Availability uses reservation dates and conflict protection, not only room status.
- [ ] Unassigned enquiries and walk-ins have explicit rules.
- [ ] Role permissions are enforced server-side.
- [ ] Property selection and metric scope are clear in the UI.
- [ ] Existing production data can be migrated without invented defaults.
- [ ] Migrations replay and database tests pass in an isolated environment before production rollout.

Until the isolated database path is restored, this proposal is design-only and database acceptance remains unverified.
