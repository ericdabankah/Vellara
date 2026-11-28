# VELLARA Property Identity and Hospitality Booking Model v1

**Status:** Proposed physical-model design for review. This is not executable SQL and has not been applied to Supabase.

**Scope:** Public property URLs and publication, hospitality room-type booking, inventory holds, and later physical-room assignment. Real-estate listing/enquiry/viewing workflows remain separate.

## 1. Live schema facts used

Read-only inspection of the connected VELLARA project on 2026-11-28 confirmed:

- `organizations` has `id`, `name`, `status`, creator and timestamps, but no public slug.
- `business_profiles` is organization-scoped and already stores `country_code`, `timezone` and `currency`. Its current defaults are `GH`, `Africa/Accra` and `GHS`.
- `rooms` is organization-scoped. It has room number, legacy text room type, capacity (1–30), status, optional nightly rate in minor units, and non-null currency defaulting to GHS.
- `reservations` is organization-scoped and has an optional guest, optional physical `room_id`, arrival/departure dates, adults/children, optional total amount, currency, and status.
- Existing reservation statuses are `inquiry`, `pending`, `confirmed`, `checked_in`, `checked_out`, `canceled`, and `no_show`. Existing room statuses are `available`, `occupied`, `maintenance`, and `out_of_service`.
- The existing reservation constraint already requires departure date to be later than arrival date.
- Existing reservation money is not sufficient as a line-item price snapshot. The room-level currency default also cannot be used as the property's effective currency without an explicit rule.

No production data was modified.

## 2. Public property identity

### 2.1 Route

Keep the agreed route:

`/p/{organization-slug}/{property-slug}`

The organization slug is globally unique. The property slug is unique within its organization. Together, they identify one property without exposing an internal UUID.

### 2.2 Organization public slug

Add `organizations.public_slug` (name may be finalized against the repository naming convention):
- Lowercase ASCII URL-safe slug.
- Globally unique, non-null after backfill.
- Immutable after the organization has a published property, unless changed through a controlled redirect/alias process.
- Never use organization display name as a live lookup fallback after launch.

Backfill:
1. Generate a normalized candidate from organization name.
2. Resolve collisions deterministically using a stable suffix derived from the organization ID.
3. Produce a collision report before finalizing.
4. Do not silently change an already published route.

For future renames, prefer a separate route-alias table (old slug → organization/property target, active/redirect state) rather than silently breaking links. A route alias must never grant access to private tenant data.

### 2.3 Property publication state

The operational property status and public publication state are separate concepts.

Proposed fields on `properties`:
- `publication_status`: `draft`, `published`, `unpublished`.
- `published_at`: nullable timestamp.
- `unpublished_at`: nullable timestamp.
- `publication_updated_by`: nullable user reference where supported by the current staff/creator model.

Public resolution rule:
- Resolve only if the organization is active, property is operationally active, publication status is `published`, and the property's vertical is enabled for the organization.
- Never expose draft, unpublished, inactive or archived properties through the public resolver.
- Public resolver returns a curated DTO, not a raw `properties` row.
- Public UUID/slug resolution is not authorization. Owner Desk access still requires authenticated membership and property-level permission.

The publish operation should validate minimum content requirements (display name, description, location/contact policy, at least one approved public image where media is enabled, and at least one sellable room type for hospitality). The exact mandatory fields can be relaxed by vertical, but the public page must not render an incomplete or private record accidentally.

## 3. Hospitality booking model

### 3.1 Booking unit versus physical room

A guest books a room type and quantity for a date range. The system may assign a physical room later.

Example:
- Property has 8 Deluxe rooms.
- Guest books 2 Deluxe rooms for 12–15 December.
- The reservation consumes 2 units of Deluxe inventory for each night.
- The hotel can assign rooms 204 and 205 later, or change the assignment without changing the guest's booked room type or price.

Do not require `reservations.room_id` to create a new booking. Keep that legacy column during rollout for compatibility, then deprecate it only after every read/write path is migrated.

### 3.2 Reservation line items

Add `reservation_items` with at least:
- `id`
- `organization_id`
- `property_id`
- `reservation_id`
- `room_type_id`
- `quantity` (positive integer, bounded by a documented operational maximum)
- `arrival_date`
- `departure_date` (exclusive checkout date; must be later than arrival)
- `unit_nightly_rate_minor`
- `currency` (three-letter ISO 4217 code)
- `night_count`
- `line_subtotal_minor`
- `tax_total_minor` (zero where not applicable, but explicit)
- `line_total_minor`
- `rate_snapshot` JSONB containing the applied rate/plan and included terms, not mutable source data
- `created_at`, `updated_at`

Integrity:
- Composite foreign keys must prove that reservation, property and room type belong to the same organization and that the room type belongs to that property.
- Check quantity > 0, valid date interval, non-negative money values, valid currency and arithmetic consistency.
- Prevent clients from writing authoritative price fields directly. Quote and reservation creation must be performed by trusted backend operations that calculate and persist snapshots.
- Reservation totals must reconcile exactly to the sum of line totals plus explicitly modelled reservation-level charges/discounts. Do not let a frontend-supplied total become authoritative.

A reservation may have multiple line items, for example two room types in one stay. Each line item can have a different rate snapshot.

### 3.3 Physical room allocation

Add `reservation_room_allocations` (or the repository's equivalent name):
- `id`
- `organization_id`
- `property_id`
- `reservation_item_id`
- `room_id`
- `arrival_date`
- `departure_date`
- `allocation_status`: `assigned`, `released`, `completed`
- `assigned_at`, `assigned_by`, timestamps

Rules:
- Allocated room must belong to the same organization and property as the reservation item.
- Room type must match the line item's booked room type unless an explicitly approved upgrade/substitution operation records the reason and price treatment.
- Sum of active allocations for a line item must never exceed its booked quantity.
- One physical room cannot have overlapping active allocations.
- Room maintenance/out-of-service periods must block assignment and be represented in an availability-block model, not only by changing a global room status.
- Reassignment must release the old allocation and create the new allocation atomically with an audit event.

For physical overlap enforcement, evaluate a Postgres exclusion constraint over `room_id` and a half-open date range `[arrival_date, departure_date)` using `daterange` and `btree_gist`, or a transactionally locked allocation function if extension/constraint deployment is unsuitable. Do not rely on a frontend check.

## 4. Holds and concurrency-safe room-type inventory

### 4.1 Separate temporary holds from reservations

Add `inventory_holds` and `inventory_hold_items` (or one normalized hold header + line-item structure).

Hold header:
- `id`
- `organization_id`
- `property_id`
- `guest_id` nullable until guest details are collected
- `status`: `active`, `converted`, `expired`, `released`
- `expires_at`
- `idempotency_key`
- `created_at`, `updated_at`

Hold item:
- `id`
- `hold_id`
- `organization_id`
- `property_id`
- `room_type_id`
- `quantity`
- `arrival_date`
- `departure_date`

A hold is temporary inventory protection, not a confirmed reservation and not proof of payment. Expiry must be enforced by backend/database logic at the moment availability is evaluated. A scheduled cleanup may mark old holds expired, but correctness must not depend on the cleanup job running on time.

### 4.2 Atomic availability operation

The backend's hold-creation operation must be one database transaction:
1. Validate authenticated/public booking context, property publication and vertical.
2. Validate room type is active, sellable and belongs to the selected property.
3. Acquire transaction-scoped locks for every requested room type in deterministic sorted order. This prevents two concurrent requests from both observing the same last room.
4. Recompute available quantity for every night in the requested half-open date interval.
5. Count active, unexpired holds and inventory-consuming reservation items.
6. Reject if any night would exceed sellable inventory.
7. Insert the hold and hold items with a unique idempotency key.
8. Commit once every requested item passes.

Availability is calculated per room type and per night, not just by checking the number of free physical room rows at the time of page load.

**Concurrency rule:** Two simultaneous requests for the final available unit must not both succeed. The authoritative hold operation must serialize competing requests for the same property/room type and recheck availability after acquiring the lock.

### 4.3 What consumes inventory

Recommended V1 rule:
- Active, unexpired holds consume inventory.
- Confirmed reservations consume inventory.
- Checked-in reservations consume inventory.
- Canceled, checked-out and no-show reservations do not consume future inventory.
- Inquiries do not consume inventory.
- Pending reservations must not automatically consume inventory unless the backend creates/links a valid active hold with a defined expiry. This avoids indefinite unpaid pending bookings blocking stock.

**Open compatibility check:** Existing code may currently treat `pending` differently. Before adopting this rule in SQL, inspect the backend booking/payment flow and settle the exact pending-to-hold conversion. Do not silently reinterpret legacy statuses.

### 4.4 Hold conversion

Converting a hold into a reservation must be atomic and idempotent:
- Verify the hold is active and unexpired.
- Verify the payment/confirmation policy for the booking channel.
- Create reservation and line items from the hold, with server-calculated immutable price snapshots.
- Mark the hold converted and link it to the reservation.
- Prevent a second conversion from creating another reservation.
- If payment is asynchronous, use an explicit payment-pending state/attempt linked to the hold, with a fixed expiry policy. Do not treat a client callback as proof of payment.

## 5. Currency and price precedence

Use integer minor units and ISO currency codes on every quote, reservation line, payment and refund.

Recommended V1 precedence:
1. Effective property currency override, if one is configured.
2. Otherwise `business_profiles.currency` for the organization.
3. No implicit currency conversion.

Rate precedence:
1. Explicit room-level override only if V1 product rules still permit per-room pricing.
2. Otherwise room-type default rate.
3. The selected rate is copied into the quote/reservation snapshot.

A currency change affects future quotes only. It never rewrites existing reservations, payments or receipts.

**Legacy GHS risk:** Existing `rooms.currency` is non-null and defaults to GHS. A room with a non-null legacy rate and currency different from the resolved property currency must be reported and block automatic migration. A room with no rate must not force the property's currency to GHS merely because its legacy currency default exists.

For V1 simplicity, consider removing per-room price override from the new booking path and pricing at room-type level. Keep the legacy column during compatibility rollout until all consumers are migrated.

## 6. Legacy reservation migration

Existing reservations may have a nullable `room_id`.

- If `room_id` exists and maps unambiguously to a property and room type, create one reservation item preserving dates, guest count and the best verified historic price/currency snapshot.
- If `room_id` is null, do not invent a room type or quantity. Preserve the reservation and report it as requiring manual reconciliation.
- If legacy `total_amount_minor` is populated but no reliable rate breakdown exists, preserve it at reservation level and mark the itemization as legacy/unitemized. Do not fabricate nightly rates or taxes.
- If status is `pending`, preserve status and do not silently convert it to a hold. Resolve its operational meaning from backend behaviour before applying the new inventory rules.
- Backfill must be repeatable/idempotent and report migrated, skipped, ambiguous and failed rows.

The current live reservations and rooms were empty at inspection, but tests must still include populated fixtures.

## 7. RLS, grants and API boundary

- Enable RLS on all new public-schema tables.
- Tenant members access rows through organization membership plus property assignment/role rules.
- Public users must not directly select reservations, guests, holds, allocations or internal room inventory.
- Public availability and property content are returned through narrowly scoped backend endpoints or safe public read models.
- No public direct insert into reservation, reservation-item, hold or payment tables.
- Backend creates holds/reservations through a trusted, idempotent operation and validates the property and room type.
- Grant only required columns and operations. Do not rely on RLS to constrain TRUNCATE, MAINTAIN or excessive table-level UPDATE.
- All updates that change tenant/property scope must have both `USING` and `WITH CHECK` policies where direct updates are allowed.
- Prefer SECURITY INVOKER. Any necessary SECURITY DEFINER helper must live in a non-exposed schema, have a fixed search path, strict caller validation, minimal execute grants and explicit tests under real JWT contexts.

## 8. Required tests before release

### Public identity and publication
- Organization slug uniqueness and deterministic collision handling.
- Property slug uniqueness within organization.
- Published route resolves exactly one property.
- Draft/unpublished/inactive/archived properties never resolve publicly.
- Organization inactive blocks all its property routes.
- Slug changes preserve old routes only through explicit aliases.

### Booking and concurrency
- Two simultaneous requests for the final room-type unit: exactly one hold succeeds.
- Multi-room-type hold is all-or-nothing.
- Expired hold does not block availability even before cleanup.
- Duplicate idempotency key returns the original hold/result.
- Repeated hold conversion cannot create duplicate reservations.
- Pending reservations without a valid hold do not silently consume stock.
- Checkout date is exclusive: a guest checking out on 15 December does not overlap a new guest checking in on 15 December.
- Physical room assignment cannot overlap another active allocation.
- Allocation quantity cannot exceed line-item quantity.
- Room maintenance/out-of-service blocks physical assignment.

### Money and migration
- Quote/reservation snapshots do not change when rates are edited.
- Currency mismatch blocks legacy rate backfill.
- Null-room legacy reservations are preserved and reported, not guessed.
- Legacy total with no breakdown is not fabricated into line items.
- Reservation total reconciles with item totals and explicit charges/discounts.

### Authorization
- Public role cannot read guest, reservation, hold or allocation tables.
- Cross-tenant user cannot access another organization's records.
- Property-unassigned member cannot manage allocations unless role policy allows it.
- Owner/manager/operations permissions match the agreed matrix.
- Browser cannot write price, payment or confirmation facts directly.

## 9. Decisions required before executable migrations

These are the remaining product/backend decisions that cannot safely be guessed:

1. **Pending reservation semantics:** Is `pending` currently a short-lived inventory hold or merely an unconfirmed record? The database should implement a single explicit rule.
2. **Hold duration and extension:** Recommended starting point is 15 minutes for a checkout/payment hold, with at most one controlled extension. Confirm against the payment provider's expected checkout lifecycle.
3. **Room-level price overrides:** Keep or remove from the V1 new-booking path? Room-type-level pricing is simpler and less error-prone.
4. **Property currency override:** Allow it in V1, or inherit organization currency only? Recommended: inherit organization currency in V1, adding property override only when a real tenant requirement is confirmed.
5. **Public organization slug rename:** Are old URLs required to redirect permanently? Recommended: yes, via explicit alias records, never by reassigning an old slug to another organization.

No migration file has been generated because the approved workflow requires the Supabase CLI to create timestamped migration files, and the CLI/local database environment is not available in this session. This document is the schema contract to review before executable SQL is authored.

## 10. Release status

**Not production-ready.** This model requires backend/API contract review, local migration generation, fresh-database replay, populated legacy fixtures, concurrent hold tests, RLS/grant tests and Supabase advisor review. No live schema, data, Storage bucket, PR merge or deployment was changed by this document.
