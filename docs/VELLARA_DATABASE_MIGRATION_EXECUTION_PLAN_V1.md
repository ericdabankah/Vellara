# VELLARA Database Migration Execution Plan v1

**Status:** Design and release-planning artifact only. No SQL has been applied to the connected Supabase project. No migration files have been generated or executed by this document.

**Scope:** Reconcile the existing property/inventory PR stack into one database release candidate, then sequence the remaining V1 schema work for hospitality, real estate, media, payments and WhatsApp.

## 1. Canonical property-foundation lineage

The current Git history confirms that the property work is not two independent database implementations:

1. `feat/property-details-room-types` is the shared starting point.
2. PR #12 adds atomic property creation and the first property-foundation version.
3. PR #14 adds property-aware room/reservation frontend contracts, active-property/room-type guards and inventory privilege hardening.
4. `feat/operational-room-management` is a descendant of both the atomic-property-creation and property-aware inventory heads.
5. PR #31 (`fix/property-foundation-release-gates`) is based on `feat/operational-room-management` and adds the latest property-foundation backfill safeguards plus the property-domain UPDATE privilege correction.

Commit comparisons confirm:
- `feat/atomic-property-creation` is an ancestor of `feat/operational-room-management`.
- `feat/property-aware-rooms-reservations-rebased` is also an ancestor of `feat/operational-room-management`.
- PR #31's head is ahead of the PR #14 head, not a competing replacement that should be merged independently.

**Decision:** Treat PR #31's head as the canonical property/inventory database release candidate. Do not merge PR #12 or PR #14 separately on top of it. Their database work is already in its ancestry. Review and test the complete chain as one unit.

### Why PR #31 is the stronger candidate

Compared with the earlier property-foundation version, PR #31:
- Preflights legacy room numbers for collisions after lower/trim normalization before adding the normalized unique index.
- Explicitly drops the legacy mapping temp table after backfill rather than relying on `ON COMMIT DROP` and an assumed migration transaction.
- Cleans up a same-session leftover temp table before recreating it.
- Adds a follow-up migration that revokes inherited table-level UPDATE on the four property-domain tables, then restores only approved column-level UPDATE grants.
- Extends the authorization audit with effective table/column privilege checks.

These are improvements to release safety, not proof that the migrations have passed an isolated replay.

## 2. PR boundaries that must remain separate

| Work | Current position | Handling |
|---|---|---|
| PR #31 property foundation release gates | Draft; database candidate | Keep as the database review line. Do not merge before isolated replay and authorization tests. |
| PR #29 property schema readiness | Draft; frontend/type-contract work | Review separately. It shares frontend files with other branches. |
| PR #32 property media contract | Draft; documentation, stacked on #31 | Keep as the media contract dependency. |
| PR #33 Owner Desk media UI | Draft; local-preview UI, stacked on #29 | Keep separate from database release. It does not upload or publish assets. |
| PR #34 platform developer access | Draft; documentation, stacked on another access branch | Separate platform authorization work. |

Do not merge sibling frontend branches by title or apparent feature completeness. Compare their current file diffs and CI results first, especially `frontend/src/App.tsx` and generated database types.

## 3. Existing property/inventory migration chain

The candidate chain contains these migration responsibilities:

1. `20261126120000_property_management_foundation.sql`
   - Adds organization modules, properties, property staff assignments and room types.
   - Backfills legacy rooms and reservations to a hospitality property.
   - Adds property relationships, composite integrity constraints, RLS and explicit grants.
2. `20261127130000_atomic_property_creation.sql`
   - Adds the authenticated, SECURITY INVOKER `create_property` RPC.
   - Enables the selected module and creates the property in one transaction.
3. `20261127140000_enforce_active_property_inventory.sql`
   - Restricts new inventory and reservation writes to active hospitality properties.
   - Requires room records to use active room types belonging to the same property.
4. `20261127150000_restrict_inventory_table_privileges.sql`
   - Removes unnecessary anonymous/PUBLIC and authenticated administrative privileges from the inspected inventory and operational tables.
   - Preserves SELECT-only public catalogue access.
5. `20261128100000_restrict_property_table_update_privileges.sql`
   - Removes inherited table-level UPDATE from the property-domain tables and restores the approved column allowlists.

The complete chain must be replayed in order against a fresh isolated database. Testing only the last migration or only the foundation file is insufficient.

## 4. Remaining schema work, in dependency order

The property foundation is not the complete VELLARA V1 database. The following work remains.

### Phase A: Public property identity and publication

Add:
- A globally unique organization public slug (or a dedicated public-route mapping table).
- A publication state independent of the existing operational property status.
- A publication timestamp and audit fields.

Rules:
- The agreed public route remains `/p/{organization-slug}/{property-slug}`.
- Property slugs may remain unique within an organization because the organization slug disambiguates the route.
- A property is publicly resolvable only when it is explicitly published and operationally active.
- Draft, unpublished, inactive and archived properties must not appear in public results.
- Public identity is a lookup key, never an authorization credential.
- Public resolution must be performed through a narrowly scoped backend resolver or safe read model, not by granting anonymous access to tenant tables.

Backfill rule: generate stable, collision-safe organization slugs and report collisions for manual resolution. Do not silently overwrite an existing organization identifier or public URL.

### Phase B: Hospitality room-type booking and allocation

Add:
- Reservation line items that reference a room type, date range and quantity.
- Immutable per-line price, currency and terms snapshots.
- Separate physical room allocations linking line items to actual rooms.
- Time-limited inventory holds and availability blocks where the booking/payment lifecycle requires them.

Rules:
- A customer books a room type and quantity first. A physical room can be assigned later.
- Keep the legacy `reservations.room_id` column during compatibility rollout; do not make it the required booking primitive.
- Existing reservations with a room assignment can be backfilled from the room's property and room type.
- Existing reservations without a room assignment must be preserved and reported for reconciliation. Do not invent a room type or fabricate line-item data.
- Availability checks and hold creation must be atomic and concurrency-safe. A transaction must serialize competing holds for the same property/room type/date window, then recheck available quantity before creating the hold.
- Expired holds must stop consuming availability through an authoritative server-side rule.

### Phase C: Canonical currency and pricing

Use integer minor units for every amount and an explicit ISO currency code for every quote, reservation price snapshot, payment and refund.

Proposed resolution rules to validate before SQL:
- Effective property currency: property override, otherwise organization business-profile currency, otherwise the documented V1 fallback of GHS.
- Room-type default rate is the standard rate for that property.
- A non-null room-level rate is an explicit override of the room-type rate.
- Every quote resolves one effective currency and stores it with the exact amount and pricing terms used.
- If a legacy room has a non-null rate whose currency conflicts with the property's resolved currency, stop the backfill and produce an actionable report. Never reinterpret a numeric amount in another currency.
- A property or organization currency change must not rewrite historic quotes, reservations or payment records.

The existing default GHS on `rooms.currency` must not silently override a property-level currency decision. The migration design must explicitly handle legacy rows and future inserts.

### Phase D: Real-estate workflows

Add separate real-estate structures for:
- Published real-estate listings.
- Property enquiries.
- Viewing appointments.

Do not reuse hotel room inventory, nightly availability, room holds or reservation logic for long-term rentals and sales. The V1 real-estate workflow stops at listing discovery, enquiry and viewing appointment.

### Phase E: Property media

Implement the PR #32 contract:
- Private Storage bucket.
- Property-scoped asset metadata.
- Backend-issued upload intent and object path.
- Server-side validation of file type, size, dimensions, object ownership and property scope.
- Explicit finalization and publication.
- Short-lived signed reads for public mini-sites after publication.

Browser file validation and local object URL previews are usability features only. They do not establish upload, ownership or publication.

### Phase F: Booking payments, refunds and receipts

Create a booking-money ledger separate from VELLARA's own SaaS subscription billing:
- Payment attempts.
- Verified payments.
- Refunds.
- Receipts.
- Provider event inbox/idempotency and reconciliation metadata.

A browser callback or WhatsApp message is not proof of payment. The backend must verify provider transaction facts against the server-created payment attempt, amount, currency, tenant, booking and idempotency key before marking a booking paid.

### Phase G: WhatsApp and channel-neutral communications

Add:
- Conversations and messages independent of voice calls.
- Meta webhook inbox with signature verification and event idempotency.
- Message delivery/processing states.
- Human handoff records.
- AI action execution/audit records.

Retell and Meta handle communications; OpenAI supplies intelligence; VELLARA remains authoritative for tenant scope, permissions, availability, bookings, payment state and business decisions. AI output must not directly authorize a booking, payment or tenant-data mutation.

## 5. Security requirements for every phase

- Enable RLS on every table in an exposed schema.
- Define policies from the actual owner/manager/operations/verification/property assignment model, not a generic authenticated-user policy.
- Keep explicit SQL grants separate from RLS. RLS does not constrain TRUNCATE, MAINTAIN or excessive table-level UPDATE.
- Check effective privileges using `has_table_privilege` and `has_column_privilege`, not only by reading GRANT statements.
- UPDATE policies must include both `USING` and `WITH CHECK`, and the role must have the required SELECT policy.
- Avoid SECURITY DEFINER unless there is a documented privilege boundary requiring it. Any such function must have a fixed search path, minimal grants, strict caller validation and explicit EXECUTE revocations.
- The current property candidate includes `private.has_property_role` as a SECURITY DEFINER helper executable by authenticated users, and `private.assign_property_creator` as a trigger-only SECURITY DEFINER helper with EXECUTE revoked from browser roles. During isolated replay, verify the `private` schema is not exposed through the Data API, inspect function owners and effective EXECUTE grants, and test both helpers under real authenticated JWT contexts. The public `create_property` RPC is SECURITY INVOKER and should remain callable only by authenticated users.
- Public-facing reads must not expose guest details, staff assignments, private asset metadata, payment records or unpublished property data.
- Never expose service-role or secret API keys in frontend code.
- Keep tenant scope and authorization checks in VELLARA's backend/database boundary.

## 6. Required isolated test gates

### Migration and legacy-data fixtures
- Empty legacy inventory.
- One organization with several room types and rooms.
- Reservations with a room assignment.
- Reservations without a room assignment.
- Existing matching room types.
- Blank legacy room type.
- Duplicate room numbers after lower/trim normalization.
- Organization with multiple existing hospitality properties.
- Legacy room rate whose currency conflicts with the resolved property currency.

Expected outcome: valid cases backfill deterministically; ambiguous or unsafe cases fail before destructive or guessed assignments, with actionable diagnostics.

### Authorization and grants
- Owner sees all organization properties.
- Manager sees only assigned properties, except the explicitly authorized create-property flow.
- Operations and verification roles receive only their approved property-scoped access.
- Unassigned and cross-tenant members see no protected rows.
- Manager cannot create or revoke staff assignments.
- Authenticated users cannot use table-level UPDATE to bypass column allowlists.
- Anonymous users cannot access tenant-owned tables.
- Public catalogue remains SELECT-only.
- Service-role access is tested separately from browser roles.

### Booking and money
- Two simultaneous holds cannot oversell the same room-type inventory.
- Expired holds no longer consume availability.
- Physical room allocation cannot overlap an existing allocation.
- Quote and reservation snapshots remain unchanged after rate edits.
- Currency mismatch is rejected.
- Duplicate provider events and payment callbacks are idempotent.
- Amount, currency, reference, tenant or booking mismatch cannot mark a booking paid.

### Publication and media
- Unpublished or inactive properties cannot be resolved publicly.
- Published content exposes only approved fields.
- Private assets cannot be read without the correct signed-read flow.
- A file uploaded for one property cannot be finalized or published under another property.
- Deleting/unpublishing an asset invalidates its public delivery path according to the media lifecycle.

## 7. Migration generation and release procedure

The current execution environment has not established an available local Supabase CLI or isolated database. Therefore, do not hand-invent migration filenames or apply reference SQL directly to the hosted project.

When a local test environment is available:

1. Check the installed Supabase CLI version and discover the current migration commands with `supabase --help`.
2. Create each new migration using `supabase migration new <descriptive-name>`.
3. Apply the complete chain to a fresh local/isolated database.
4. Run migration fixtures, pgTAP authorization tests, concurrency tests and effective privilege assertions.
5. Run Supabase security and performance advisors; review every finding.
6. Generate and inspect the final migration diff and verify migration history.
7. Obtain backend/API and database/security review before any hosted rollout.
8. Apply to production only after explicit release approval and a tested rollback/recovery plan.

## 8. Current release decision

**Database status: NOT READY FOR PRODUCTION.**

The property/inventory migration lineage has a clear canonical candidate in PR #31, but it has not passed isolated replay. The public identity, publication, room-type reservation line items, allocations, currency reconciliation, real-estate workflows, media, booking-money ledger and WhatsApp communication schema are still required before the full VELLARA V1 data model is complete.

No production migration, database write, Storage bucket creation, PR merge or production deployment is authorized by this plan.
