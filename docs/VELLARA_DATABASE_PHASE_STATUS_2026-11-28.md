# VELLARA Database Phase Status and Next Work

**Audit date:** 2026-11-28  
**Target project:** VELLARA Supabase project `iztktfglrvdpnwtvefdw`  
**Status:** Read-only production audit; implementation branch only. No live schema or data changes.

## 1. Current live database baseline

The connected production database has 19 public tables and 11 recorded migrations. The existing live foundation covers:

- Profiles, organizations and organization memberships.
- Business profiles and tenant-level roles.
- Receptionist instances, phone numbers, channel routing and voice call records.
- Call capacity reservations and activity events.
- Guests, legacy rooms and legacy reservations.
- Subscription plans, entitlements, prices and organization subscription records.

The live database does **not** yet contain the property-domain tables, room-type inventory model, real-estate workflows, property media, customer booking-payment ledger or channel-neutral WhatsApp conversations/messages.

No property migration in the candidate stack is recorded in the live migration history.

## 2. Property foundation candidate

The canonical candidate is PR #31, branch `fix/property-foundation-release-gates`, based on `feat/operational-room-management`. It descends from the atomic property-creation and property-aware inventory work. Do not merge PR #12 or #14 separately on top of it.

Candidate migration sequence:

1. `20261126120000_property_management_foundation.sql`
   - `organization_modules`, `properties`, `property_staff_assignments`, `room_types`.
   - Backfills legacy rooms and reservations to a hospitality property.
   - Adds property-aware foreign keys, policies, indexes and explicit grants.
2. `20261127130000_atomic_property_creation.sql`
   - Adds authenticated SECURITY INVOKER `public.create_property`.
   - Enables a vertical module and creates the property in one transaction.
3. `20261127140000_enforce_active_property_inventory.sql`
   - Restricts inventory/reservation writes to active hospitality properties and active room types.
4. `20261127150000_restrict_inventory_table_privileges.sql`
   - Removes excessive anonymous/PUBLIC and authenticated administrative privileges from the inspected operational tables.
5. `20261128100000_restrict_property_table_update_privileges.sql`
   - Removes inherited table-level UPDATE on property-domain tables and restores only the approved column-level allowlists.

### Property foundation status

**Drafted, not live, not release-verified.**

Static review and read-only prerequisite checks exist. The chain has not been replayed against an isolated database. Authorization, grant and concurrency tests have not passed in an isolated environment. PR #31 remains draft.

## 3. Product rule recorded for hospitality inventory

V1 pending-reservation rule:

- `inquiry` does not consume inventory.
- `pending` does not consume inventory by status alone.
- A pending reservation consumes inventory only while linked to a valid, active, unexpired inventory hold.
- `confirmed` and `checked_in` reservations consume inventory.
- `canceled`, `checked_out` and `no_show` reservations do not consume future inventory.
- Hold expiry must be checked at availability/hold-creation time. A cleanup job may update stored status, but correctness must not depend on that job running.

Legacy pending reservations are preserved. They are not automatically converted into holds.

Still to confirm with backend/payment integration before SQL:
- Hold duration and extension rules. Fifteen minutes with at most one controlled extension is a proposal, not a finalized value.
- Whether V1 permits room-level price overrides.
- Whether property currency override remains in V1 or inherits organization currency only.

## 4. Remaining database phases

| Phase | Scope | State |
|---|---|---|
| Core tenant and receptionist foundation | Existing tenant, channels, calls, guests, basic rooms/reservations, subscription foundation | Live |
| Property foundation | Modules, properties, property assignments, room types, property-aware rooms/reservations | Draft migration chain |
| Hospitality booking | Reservation items, immutable price snapshots, inventory holds/items, physical room allocations, availability blocks, atomic hold and conversion operations | Design only |
| Public property identity | Globally unique organization slug, publication state, safe public resolver/alias policy | Design only |
| Real estate | Listings, enquiries and viewing appointments | Not implemented |
| Property media | Private bucket, asset metadata, upload intent, verification and publication | Contract/design only |
| Booking money | Payment attempts, verified payments, refunds, receipts and provider-event idempotency | Not implemented |
| WhatsApp conversations | Conversations, messages, webhook inbox, delivery state, handoff and AI action audit | Not implemented |
| Release security/testing | Fresh replay, JWT/RLS tests, effective grant tests, backfill fixtures, concurrency tests and advisors | Blocked on isolated test environment |

## 5. Immediate implementation sequence

### Gate 1: Finish property foundation release verification

- Reconcile the exact five-migration chain and dependencies.
- Replay the full chain against a fresh isolated Supabase database.
- Include populated legacy fixtures, not only an empty database.
- Verify room-type reuse, room-number normalization, property backfill and unassigned reservations.
- Test owner, manager, operations and verification role behavior with authenticated JWT claims.
- Verify `has_table_privilege` and `has_column_privilege`, including that TRUNCATE/MAINTAIN and non-allowlisted UPDATE are denied.
- Test the SECURITY DEFINER helper owner, fixed search path, private schema exposure and effective EXECUTE grants.
- Run Supabase security and performance advisors.

### Gate 2: Implement hospitality booking

- Reservation line items by room type and quantity.
- Time-limited inventory holds and hold items.
- Physical room allocations kept separate from the booking unit.
- Availability blocks for maintenance/out-of-service intervals.
- Atomic, idempotent hold creation and hold conversion.
- Server-calculated immutable currency and pricing snapshots.
- Concurrency tests proving two requests cannot claim the final unit.

### Gate 3: Implement public property identity and real estate

- Organization public slug and property publication state.
- Public resolver exposes only active, explicitly published properties.
- Separate real-estate listing, enquiry and viewing appointment models.
- No reuse of hotel room inventory for real-estate listings.

## 6. Environment and release restrictions

The current execution environment has no Supabase CLI, Docker or local PostgreSQL client. An attempt to invoke the CLI through `npx` timed out. The user previously declined a hosted Supabase development branch because of potential charges.

Therefore:

- Do not apply these migrations to the live Supabase project.
- Do not create a paid Supabase branch or project without explicit approval after showing the exact cost.
- Do not claim the candidate migration chain is tested or production-ready.
- Continue static review and prepare implementation artifacts only where they can be properly verified.
- Before executable migration generation, restore an approved isolated test environment and use the Supabase CLI migration workflow.

## 7. Release decision

**Property foundation: not complete.** It is the next release candidate, but it remains blocked by isolated replay and authorization/grant tests.

**Real estate: not implemented.** Only the shared property vertical foundation is drafted. Listings, enquiries and viewings are still future schema work.

No production database changes, migrations, Storage buckets, PR merges or deployments were performed for this status update.
