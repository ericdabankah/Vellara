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

Introduce `room_types` as configurable accommodation categories within a property.

Proposed attributes:
- `id`, `organization_id`, `property_id`
- `name` (entered by the property; no hardcoded catalogue), optional `code`, and optional `description`
- `default_capacity` (validated positive guest count)
- `bed_configuration` (structured, validated, and configurable by the property)
- `amenities` (property-managed selections; no fixed VELLARA-imposed amenity catalogue)
- `default_nightly_rate_minor` (optional default rate stored in minor currency units)
- `currency` (resolved from the property's effective currency unless a separately approved pricing rule permits an override)
- lifecycle status and `created_at`, `updated_at`

**Approved configuration rule:** room types are property-specific and fully user-configurable. VELLARA must not hardcode, seed, or require a fixed catalogue of room-type names, bed configurations, or amenities. Authorized property staff create and manage the names and definitions that match their own operation. One property may define any set of categories while another defines a different set. The schema should provide flexible validated fields and property ownership, not a product-imposed list of names.

Authorized staff may rename or edit a type. If a type is already referenced by rooms or reservations, it must be deactivated/archived rather than hard-deleted, and existing records must retain their historical meaning.

**Approved room-type fields:** each type supports a property-entered name, optional description, default guest capacity, configurable bed configuration, property-managed amenities, and an optional default nightly rate. The default nightly rate is a starting value, not a guaranteed price for every date or reservation. Room-level overrides may be supported for legitimate room-specific differences, with clear precedence and audit history. Rates and currency must be stored and calculated consistently using integer minor units and the property's effective currency; do not silently mix currencies.

For a room assigned to a room type, default capacity, bed configuration, amenities, and rate can be inherited from the type. Where an authorized room-level override exists, the room's effective value takes precedence and the Owner Desk must make that override visible. A room must not silently copy inherited defaults into permanent values unless the user explicitly chooses to customize them.

A future reusable-template feature can be considered separately, but it is not part of the initial model.

### C. Rooms / bookable units

Keep the existing `rooms` table as the bookable-unit record to preserve frontend and reservation compatibility.

Proposed additive attributes:
- `property_id` (tenant-safe FK to `properties`)
- `room_type_id` (optional tenant-safe FK to `room_types`)
- `display_name` (optional; room number remains the operational identifier)
- `is_bookable` (explicitly distinguish sellable inventory from operational/maintenance records)

Existing fields remain authoritative where already used. The free-text `room_type` field should be retained during a compatibility period; a later migration can backfill and make the normalized relationship authoritative after the frontend and backend contracts are migrated.

A safe migration must consider existing rooms with no property. Do not add a non-null property FK until a deterministic backfill strategy is implemented and tested. Do not silently assign existing inventory to a made-up property.

**Approved room-transfer rule:** a room may be reassigned from one property to another only when it has no active or future reservations at the time of transfer. The transfer must be an atomic, authorized operation that records an audit event containing the room, source property, destination property, actor, timestamp, and reason where supplied. Preserve the previous property association in durable history; do not rewrite historical reservations or erase the room's prior property relationship. The backend/database must enforce the reservation eligibility check to prevent a UI-only or race-prone transfer. If the room has an active or future reservation, reject the transfer and explain why.

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
- An enquiry alone never blocks inventory. A pending booking may block a specific unit only when the system creates an explicit, time-limited hold after an authoritative availability check.
- Every inventory-blocking hold has an expiry timestamp. The configured business hold duration determines that timestamp; it must not be an indefinite pending state.
- Hold creation and availability allocation must be atomic/concurrency-safe. Expired holds cease blocking inventory even if a background cleanup job is delayed; availability checks must treat expiry as authoritative, with cleanup allowed to reconcile stored state.
- If required payment or confirmation is not completed before expiry, the hold expires and the unit becomes available again. Payment state remains separate from reservation/hold state; a payment attempt or customer claim does not extend or confirm a hold unless an approved business rule explicitly says so.
- The hold duration is configurable by the business, not a hardcoded global product constant. The exact configuration surface and any property-level override are implementation details to settle before migration.
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
- Selects one of that property's configured room types, or creates a new type if permitted. VELLARA supplies no fixed room-type, bed-configuration, or amenity catalogue.
- Reviews the type's inherited capacity, bed configuration, amenities, and default rate.
- Enters the room identifier and operational status; any room-specific overrides are explicit and permission-checked.
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

**Approved Phase 1 access rule:** property-level staff scope is required. Organization owners retain access across all properties. Managers and operations staff see and act only within their assigned property scope unless an owner explicitly grants broader access. Verification staff receive only the verification permissions they need, scoped to the relevant organization/property and transaction. Access must be enforced server-side through database policies/authorized backend operations, not merely by hiding UI navigation. Membership and property assignment changes, permission grants, and sensitive actions must be auditable. A user with no property assignment must not gain property access by default. The exact permission matrix and safe owner recovery path must be specified before migration.

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
- **Resolved:** a room may move between properties only when it has no active or future reservations. Transfers must be authorized, audited, and preserve the prior property association in history; historical reservations are never rewritten.
- **Resolved:** enquiries do not block inventory. Pending bookings may block a unit only through an explicit time-limited hold with an expiry timestamp. The business configures the hold duration; expiry releases inventory, and hold creation/availability checks must be concurrency-safe. Payment state remains separate from reservation state.
- Are room rates simple nightly prices initially, or do seasonal/date-based rate plans belong in Phase 1?

Remaining decisions must be resolved before writing the migration. Room-type scope, the pending-hold policy, and property-level staff access are resolved as recorded above.

## 10. Acceptance checklist

- [ ] Property model supports multiple properties per organization.
- [ ] Room inventory remains compatible with existing reservations.
- [ ] Cross-tenant and cross-property references are rejected.
- [ ] Availability uses reservation dates and conflict protection, not only room status.
- [ ] Enquiries never block inventory; pending holds have explicit expiry, business-configured duration, concurrency-safe creation, and reliable expiry semantics.
- [ ] Unassigned enquiries and walk-ins have explicit rules.
- [ ] Role permissions are enforced server-side.
- [ ] Property-level staff scope is enforced server-side; owners can manage all properties while other staff are restricted to assigned scope unless explicitly granted broader access.
- [ ] Property selection and metric scope are clear in the UI.
- [ ] Room transfers reject active/future reservations, write an audit event, and preserve prior property association history.
- [ ] Existing production data can be migrated without invented defaults.
- [ ] Migrations replay and database tests pass in an isolated environment before production rollout.

Until the isolated database path is restored, this proposal is design-only and database acceptance remains unverified.
