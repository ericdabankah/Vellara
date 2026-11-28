# VELLARA Physical Database Reconciliation V1

**Status:** Engineering review artifact. Read-only live-schema inspection and static review of draft migrations. Not executable SQL and not authorization to change the live database.

**Reviewed:** 2026-11-28  
**Live project:** VELLARA, Supabase ref iztktfglrvdpnwtvefdw  
**Repository review branch:** staging

## 1. Executive conclusion

The existing database is a useful tenant, communications, subscription and hospitality foundation. It should be extended, not replaced.

The live database has 19 public application tables and 11 recorded migrations. The property-management work is substantially drafted in GitHub, but none of its property migrations is recorded in the live migration history. The live database remains on the legacy organization-scoped room/reservation model.

The next safe engineering step is to reconcile the competing migration branches into one canonical, replayable migration chain, then test it in an isolated Supabase project. Do not apply the draft migrations to the live project.

### Read-only verification performed

- Queried the live public table inventory, columns, constraints, indexes, RLS policies, function metadata, grants and effective table privileges.
- Confirmed all 19 public application tables have RLS enabled.
- Confirmed the live migration history contains 11 migrations.
- Confirmed properties, organization_modules, property_staff_assignments, room_types, property_assets, and an operational payment/receipt ledger are absent.
- Confirmed no Supabase Storage buckets exist.
- Confirmed the existing rooms and reservations tables are empty at inspection time. This reduces the current backfill volume but does not prove migration safety for a future populated tenant database.
- Reviewed the draft property foundation, atomic property creation, active inventory guard and privilege-hardening SQL from the relevant PR branches.
- No SQL writes, migrations, Storage changes, PR merges or production deployments were performed.

## 2. Live schema inventory and disposition

| Existing table | Current purpose / key shape | V1 disposition |
|---|---|---|
| profiles | User profile linked to Auth user UUID | Keep. Do not use profile metadata as an authorization source. |
| organizations | Tenant workspace, name/status/creator | Keep. Add a stable public organization slug or a dedicated public-route mapping before implementing the agreed path URL. |
| organization_memberships | Organization/user pair, enum role and status | Keep. Preserve its unique organization_id + user_id key because property assignments depend on it. |
| business_profiles | One organization-level business profile, legal/contact/location/default timezone and currency, legacy business_type | Keep as organization profile. Stop treating business_type as the single active product vertical; modules and property verticals become authoritative. |
| guests | Organization-scoped accommodation contact with name, phone, email, notes, tags and source | Keep organization-scoped for V1 hospitality. Do not prematurely replace with a universal customer table. |
| rooms | Organization-scoped unit; room number, free-text room type, capacity, status, nightly amount/currency | Keep and extend with property and normalized room-type relationships. Preserve the free-text field during compatibility/backfill; later deprecate only after clients migrate. |
| reservations | Organization, optional guest and room, confirmation/status/source, arrival/departure, guest counts, amount/currency and special requests | Keep as the reservation aggregate. Add property scope, line-item/allocation support and lifecycle history without creating a second booking authority. |
| activity_events | Organization activity/audit feed | Keep. Treat high-value business events as append-only through trusted backend paths; tighten grants. |
| calls | Voice call records | Keep for Retell voice. Add channel-neutral conversations/messages for WhatsApp and future channels. |
| call_capacity_reservations | Backend concurrency lease records | Keep backend-only. Preserve existing lease/uniqueness behavior. |
| receptionist_instances | Organization receptionist configuration | Keep and evolve with explicit configuration and action permissions. |
| organization_phone_numbers | Organization phone number records | Keep. Preserve plan-capacity enforcement. |
| phone_number_channels | Channels associated with phone numbers | Keep. |
| receptionist_number_routes | Number/channel to receptionist routing | Keep. |
| subscription_plans | Plan catalogue | Keep. Existing catalogue has four plans. |
| subscription_plan_entitlements | Plan limits/features | Keep. Starter has configured entitlements; other plans need completion/review. |
| subscription_prices | Provider/currency/interval prices | Keep. No price rows currently exist. |
| organization_subscriptions | Tenant subscription snapshot and capacity values | Keep. Keep subscription billing separate from customer booking payments. |
| subscription_provider_events | Subscription provider webhook events | Keep for subscription billing only. Do not reuse as the customer-payment event ledger. |

## 3. Draft property foundation: what already exists in code

The property migration stack proposes the following objects and changes:

| Proposed object/change | Draft implementation | Live status |
|---|---|---|
| organization_modules | Per-organization hospitality / real_estate enablement | Not present |
| properties | Shared vertical-aware property identity, organization-scoped slug, address, status, timezone/currency overrides | Not present |
| property_staff_assignments | Property-scoped assignments tied to active organization membership | Not present |
| room_types | Property-managed name, capacity, bed configuration, amenities and default nightly amount | Not present |
| rooms.property_id | Adds property ownership | Not present |
| rooms.room_type_id | Normalized room-type relationship | Not present |
| reservations.property_id | Adds required property ownership, including unassigned enquiries | Not present |
| private.has_property_role | Property-level role helper with owner bypass and active assignment checks | Not present |
| public.create_property | Atomic module enablement + property creation under caller's RLS permissions | Not present |
| Active hospitality/room-type triggers | Reject inventory/reservations for inactive or non-hospitality properties and inactive room types | Not present |
| Inventory grant hardening | Removes anonymous/public access and unnecessary authenticated administrative privileges | Not present |

The draft property backfill is designed to:
- Reject blank legacy room-type names rather than invent a category.
- Detect room-number collisions after case/whitespace normalization.
- Refuse ambiguous organizations with multiple hospitality properties.
- Reuse an existing hospitality property when there is exactly one.
- Create a clearly labelled legacy property when none exists.
- Create/reuse normalized room types and map existing rooms.
- Assign unassigned legacy reservations to the organization's single mapped hospitality property.
- Add tenant-safe composite foreign keys and property-scoped indexes.

The live rooms and reservations tables currently contain zero rows, but the migration must still pass populated-fixture tests. A zero-row production snapshot is not a substitute for backfill testing.

## 4. Physical model corrections required before the property stack is release-ready

### 4.1 Public URL cannot yet be resolved from the proposed columns

The agreed public route is:

/p/{organization-slug}/{property-slug}

The live organizations table has no slug column, and the proposed properties migration only creates a slug unique within an organization. The route therefore lacks a canonical organization-slug source.

**Required design:** add a stable, globally unique organization public slug, or create a dedicated public-route mapping table with equivalent uniqueness and lifecycle rules. The resolver must validate both route components and return only public fields. A route slug is an identifier, never an authorization credential.

### 4.2 Property operational status is not publication state

The proposed property table has active, inactive and archived operational statuses. The public mini-site requires an independent publication decision.

**Required design:** introduce an explicit publication state and publication timestamp, or an equally clear publish/unpublish model. An active property must not automatically become publicly visible. Public resolution must exclude draft, unpublished, inactive and archived content.

### 4.3 Room-type booking is not fully represented yet

The property migration normalizes room types and links physical rooms to them. It does not, by itself, create a complete room-type booking/allocation model.

The existing reservation has one nullable room_id. That is insufficient to represent a customer booking one or more units from a room category before a physical room is assigned.

**Required design:** define reservation line items for room type, quantity, date range and immutable price/terms snapshot. Define physical room allocations separately so an allocation can be made later. Add explicit time-limited holds and availability-block records if unpaid/pending reservations can temporarily consume inventory. Availability checks and holds must be concurrency-safe and backend-authoritative.

Do not solve this by making room_id mandatory at booking time. That would contradict the adopted room-type-first allocation decision.

### 4.4 Room and room-type pricing precedence needs one canonical rule

The existing rooms table has nightly_rate_minor and a currency default of GHS. The proposed room_types table has default_nightly_rate_minor but no currency column, while properties may override organization currency.

**Required design:** specify whether a room's nullable rate is an override or a copied value, define rate precedence, and ensure every quote resolves one effective currency. A room's default GHS currency must not silently conflict with a property/org currency override. Quote and reservation snapshots must retain the actual currency and amount used at booking time.

### 4.5 Real-estate operations are not implemented by the shared property table

A real_estate property vertical is supported in the draft foundation, but no listing, enquiry or viewing-appointment tables are included in that foundation.

**Required design:** add a separate real-estate listing domain, enquiry records and viewing appointments. Keep sale/rent price basis explicit. Do not reuse hotel reservation, nightly rate, guest capacity or check-in/out logic for long-term real estate.

### 4.6 Media and customer transaction records are absent

There is no property_assets table, Storage bucket, operational payment ledger, refund record or receipt record.

**Required design:** private property media with server-issued upload intent, backend verification and explicit publication; plus separate customer payment attempts, verified payments, refunds, receipts and idempotent provider events. Subscription provider events remain a separate billing domain.

### 4.7 Communications model is voice-heavy

The existing communications schema records calls and routing but does not provide channel-neutral conversation/message history for Meta WhatsApp Cloud API.

**Required design:** add conversations, messages, provider event inbox/idempotency and handoff/action audit. Retell and Meta remain transports; OpenAI remains intelligence; VELLARA backend/database remain authoritative for business decisions.

## 5. Authorization and grant review

### Current live posture

- RLS is enabled on all 19 public application tables.
- Existing organization policies generally scope rows to organization membership and role.
- Guest, room and reservation policies permit selected owner/manager/operations actions.
- The security advisor returned no current lint findings. This does not replace policy/grant testing.
- Effective privilege inspection found excessive anon and authenticated table privileges on operational tables, including TRUNCATE and MAINTAIN. RLS does not protect against these table-level operations.
- organization_subscriptions and multiple phone/receptionist/communications tables also have broad inherited privileges. The problem is not limited to the new property tables.
- All inspected public application tables have RLS enabled but are not configured with FORCE ROW LEVEL SECURITY. Review ownership/bypass assumptions separately; do not assume RLS protects privileged owners or service-role execution.

### Draft remediation to preserve and verify

The draft hardening migration removes anonymous/public privileges from tenant-owned tables, removes destructive/admin privileges from authenticated users, and preserves a read-only public subscription catalogue. A follow-up migration revokes table-level UPDATE on property tables and restores only approved column-level UPDATE grants.

Do not apply these drafts without isolated replay. Verify effective privileges using has_table_privilege and has_column_privilege, then test actual requests under anon/authenticated JWT contexts. Review function EXECUTE grants separately, especially any SECURITY DEFINER function. Keep privileged functions in the private schema where possible, pin search paths, validate auth.uid(), and grant only the intended callers.

**Important:** the current property authorization proposal still has product-policy questions:
1. Does an organization owner intentionally bypass property assignments for every property?
2. Should verification staff see every field in a reservation row, including special requests and guest details?
3. Should operations staff be able to change room-type capacity, amenities, default rates and archival state?
4. Should managers be able to create properties and enable modules but not assign/revoke staff?

These must be settled before RLS tests are considered accepted.

## 6. GitHub migration/PR reconciliation

The repository has multiple feature lines, but the current commit graph clarifies the database lineage:

| PR | Base → head | Main content | Reconciliation note |
|---|---|---|---|
| #12 | feat/property-details-room-types → feat/atomic-property-creation | Updates property foundation migration; adds atomic create_property RPC | First property-foundation increment |
| #14 | feat/atomic-property-creation → feat/property-aware-rooms-reservations-rebased | Active inventory guards, inventory grant hardening, property-aware frontend | Descendant of #12 |
| #31 | feat/operational-room-management → fix/property-foundation-release-gates | Further fixes the property foundation migration; adds property column-update grant correction | Current canonical database candidate; its head includes the #12/#14 database lineage through its ancestry |
| #29 | feat/operational-room-management → fix/property-schema-readiness | Frontend schema readiness and typed database contracts | Separate frontend sibling of #31; overlaps frontend files |
| #32 | fix/property-foundation-release-gates → feat/property-assets-media-contract | Media architecture specification | Stacked on #31 |
| #33 | fix/property-schema-readiness → feat/owner-desk-property-media-ui | Local-preview media UI | Stacked on #29; no upload persistence |

Commit comparisons confirm that `feat/operational-room-management` descends from both `feat/atomic-property-creation` and `feat/property-aware-rooms-reservations-rebased`. PR #31's head is itself ahead of the PR #14 head. Therefore, PR #31 is not a competing sibling implementation of the database foundation: it is the latest database release candidate on top of the earlier property and inventory work.

**Do not merge PR #12 or PR #14 independently on top of PR #31.** Their changes are already in the candidate's ancestry. Review and replay the complete chain from the PR #31 head. Its property-foundation migration adds normalized room-number collision preflight and explicit temporary-table cleanup; its follow-up migration removes inherited table-level UPDATE on property-domain tables while preserving the approved column grants.

PR #29 and #31 share the `feat/operational-room-management` base but remain separate siblings for frontend/database-type review. PR #32 and #33 depend on their respective parent branches. Do not merge those frontend branches blindly because they overlap `frontend/src/App.tsx` and related files. Align their API and generated database contracts after the database candidate is verified.

The closed, unmerged PR #11 contains an earlier backfill correction. Do not merge it independently; verify that its required correction is present in the current candidate.

## 7. Recommended canonical migration sequence

This is a proposed sequence, not an instruction to execute against production.

### Gate 0: Recover and replay the current baseline
1. Verify the 11 recovered migration files still match the live migration history.
2. Replay all 11 migrations against a clean isolated database.
3. Compare schema, constraints, indexes, triggers, functions, policies and grants against the live database.
4. Record any drift before adding new migrations.

### Gate 1: Canonical property foundation
1. Reconcile one final version of 20261126120000_property_management_foundation.sql.
2. Preserve organization modules, properties, property staff assignments, room types, tenant-safe FKs, and deterministic legacy backfill.
3. Add/verify the atomic create_property RPC in the same canonical stack.
4. Apply active-hospitality and active-room-type triggers.
5. Reconcile inventory privilege hardening and the property column-level UPDATE correction.
6. Regenerate frontend database types from the exact final schema.

### Gate 2: Complete the V1 property/public identity contract
1. Organization public slug or dedicated public route mapping.
2. Explicit property publication lifecycle, independent of operational status.
3. Public property resolver that exposes published fields only.
4. Separate real-estate listings, enquiries and viewing appointments.
5. Property assets metadata, private Storage bucket, upload verification and publication.

### Gate 3: Complete hospitality booking allocation
1. Reservation line items and quantity.
2. Room-type availability calculation.
3. Time-limited holds and availability blocks where required.
4. Deferred physical room allocation.
5. Reservation lifecycle event history and check-in/out operational timestamps.
6. Concurrency and overlap tests, preserving current reservation conflict protection.

### Gate 4: Customer transaction ledger
1. Quotes and quote items with immutable amount/currency/terms snapshots.
2. Payment attempts and provider references/idempotency.
3. Verified payment ledger and reconciliation.
4. Refunds and immutable receipts.
5. Provider webhook event inbox and duplicate/replay handling.
6. Keep subscription billing completely separate.

### Gate 5: Cross-channel receptionist foundation
1. Conversations and messages.
2. Meta webhook inbox/idempotency and delivery state.
3. Link customer conversations to enquiries, guests, reservations and receipts.
4. Explicit AI action proposal/execution audit and human handoff.
5. Ensure all business actions pass through trusted VELLARA authorization and domain services.

## 8. Minimum isolated test plan

### Migration and backfill
- Clean replay of all 11 existing migrations plus the canonical new stack.
- Legacy organization with no properties and existing rooms/reservations.
- Organization with exactly one hospitality property.
- Organization with multiple hospitality properties: migration must stop rather than guess.
- Blank room type and normalized room-number collision: actionable preflight failure.
- Existing room types: migration reuses them rather than duplicates them.
- Reservation with a room and reservation without a room.
- Temporary legacy mapping table is available throughout backfill and absent after completion.
- Repeat replay behavior is understood and migration runner transaction assumptions are verified.

### Tenant and role authorization
- Two organizations and multiple users.
- Owner, manager, operations, verification, unassigned member, suspended member and revoked property assignment.
- Cross-organization IDs for every property/inventory/booking table.
- Owner bypass and property assignment boundaries.
- Direct table writes versus approved RPC/backend writes.
- Anonymous access to all tenant-owned data denied.
- Public resolver returns only published customer-visible fields.
- Approved column updates work; protected identity/tenant/vertical columns cannot be changed.
- Effective grants deny DELETE/TRUNCATE/MAINTAIN/REFERENCES/TRIGGER to browser roles where not explicitly required.
- SECURITY DEFINER function access and search_path behavior.

### Booking and money
- Concurrent requests for the last available room-type inventory.
- Expired hold no longer blocks availability even if cleanup has not run.
- Two room allocations cannot overlap for the same unit.
- Quote amount/currency snapshot does not change when defaults later change.
- Duplicate provider webhook cannot double-record a payment or issue multiple receipts.
- Browser redirect or AI statement cannot mark payment successful.
- Refund and receipt state transitions are authorized and audited.

### Storage and public pages
- Unauthorized tenant cannot upload/read another tenant's asset.
- MIME/size/object-path validation happens server-side.
- Unverified media cannot be published.
- Unpublished assets and properties never appear in the public resolver.
- Signed URLs are short-lived and are not persisted as canonical asset identity.

## 9. Ownership boundaries

| Area | Owner |
|---|---|
| PostgreSQL migrations, RLS, grants, constraints, backfill, migration replay | Database developer, with review |
| /v1 APIs, authorization, availability, quote, booking, payment verification, webhooks, Storage upload lifecycle | Backend developer |
| Owner Desk UI, public mini-site UI, typed API integration, loading/error/permission states | Frontend |
| Retell and Meta provider configuration and transport integration | Backend/provider integration |
| OpenAI prompts/tool definitions and safe action proposal flow | AI/backend integration |
| Business rules and final permission decisions | Product + engineering review |

The frontend must not invent API routes or write privileged operational records directly to Supabase. Continue the established /v1 API convention unless the backend owner formally approves a change.

## 10. Release gates and immediate next action

**Do not merge, replay against production, or deploy this migration stack yet.**

The canonical database candidate is now identified: PR #31's head. The next action is to inspect whether a local Supabase CLI/Docker test environment is available and use it for a clean replay. A paid hosted Supabase branch is not required for the design work and will not be created. If local isolated replay is unavailable, continue with static SQL review and schema/API contracts, but keep the database release blocked until an approved isolated test environment exists.

After the migration replay, backfill fixtures, RLS/grant tests and advisor review pass, align the separate frontend PR line with the verified schema/API contracts. The current simulated staging preview remains useful for visual review, but it is not a database integration test environment.
