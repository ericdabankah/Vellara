# VELLARA Supabase Schema Gap Analysis

**Date:** 2026-11-25  
**Environment reviewed:** Existing VELLARA Supabase production project  
**Scope:** Read-only inventory; no schema changes made in this review.

## 1. Current database inventory

The public schema currently contains 19 application tables. All 19 were reported with RLS enabled.

| Table | Current responsibility |
|---|---|
| profiles | User profile linked to Supabase Auth |
| organizations | Tenant/business workspace |
| organization_memberships | Tenant membership and basic role |
| business_profiles | Business identity and configuration |
| subscription_plans | Plan catalogue |
| subscription_plan_entitlements | Plan capacity entitlements |
| subscription_prices | Price catalogue |
| organization_subscriptions | Tenant subscription snapshot |
| subscription_provider_events | Billing provider event records |
| organization_phone_numbers | Connected business phone numbers |
| phone_number_channels | Channels associated with a number |
| receptionist_instances | Tenant receptionist instances |
| receptionist_number_routes | Channel-to-receptionist routing |
| calls | Voice call records |
| call_capacity_reservations | Concurrent-call capacity leases |
| guests | Accommodation guest records |
| rooms | Room inventory |
| reservations | Accommodation reservations |
| activity_events | Tenant activity audit feed |

Observed application data is empty for tenant, guest, room, reservation, call, and subscription records. The plan catalogue and plan entitlement catalogue contain four rows each. No production user accounts or test business records were created as part of this audit.

## 2. Existing foundation that should be preserved

- Tenant identity and organization membership model.
- RLS-enabled organization-scoped data foundation.
- Subscription catalogue, entitlement snapshots, and subscription records.
- Phone-number, channel, receptionist-instance, and routing model.
- Voice call records and concurrency lease model.
- Guest, room, and reservation foundation.
- Activity event history.
- Existing reservation overlap protection and capacity integrity controls described in the current project migrations.

These are useful foundations. They are not a complete implementation of the agreed VELLARA product.

## 3. Phase 1 domain gaps

The following product domains are not represented by dedicated tables in the current 19-table inventory and require detailed design before migrations are written.

### A. Unified communications and customer identity
- Canonical customer/contact identity that can link multiple phone numbers, WhatsApp identities, email addresses, and website identities.
- Conversations, channel participants, inbound/outbound messages, attachments, delivery states, provider message IDs, and idempotency keys.
- Conversation assignment, AI/staff control state, handover events, and staff response attribution.
- Linkage between conversations, leads, guests, reservations, and receipts.

### B. AI configuration and business knowledge
- Tenant-specific AI receptionist configuration and instructions.
- Knowledge sources/documents, ingestion state, versioning, and retrieval metadata.
- Explicit tool/action permissions and approval requirements.
- AI action requests/results and auditable action history.

### C. Accommodation operations
- A property/building entity above rooms or units, including multiple properties per tenant.
- More flexible accommodation units and room types for serviced apartments and B2B apartment operators.
- Amenities, listing media, pricing rules, availability calendars, temporary holds, and hold expiry.
- Reservation lifecycle events, amendments, cancellation reasons, check-in/out timestamps, and operational notes.
- Human-guided walk-in registration flow using Owner Desk, without autonomous walk-in kiosks in Phase 1.

### D. Payments, receipts, and QR verification
- Payment intents/attempts separate from reservations.
- Authoritative provider transactions, webhook idempotency, reconciliation, refunds, reversals, and chargeback states.
- Receipt records and immutable receipt line/details snapshots.
- Unique QR verification token or opaque identifier, revocation/rotation state, and scan audit records.
- Receipt delivery attempts and channel outcomes.

### E. Business mini-website and cross-channel handoff
- Tenant website configuration, theme/branding, published state, and domain mapping.
- Public listing projection backed by the same inventory and availability source of truth.
- Secure, scoped, expiring conversation-to-website handoff sessions.
- Website enquiry and checkout session tracking.

### F. Automations and notifications
- Tenant-configured automation rules and schedules.
- Follow-up jobs, retry state, delivery attempts, opt-outs, and cancellation conditions.
- Stop conditions for successful payment, cancellation, opt-out, and staff takeover.

### G. Staff operations and permissions
- Staff invitations/assignments and finer-grained permissions beyond the current basic membership roles.
- Explicit permission model for receipt verification, guest registration, reservation changes, payment review, refunds, pricing changes, and settings.
- Human task assignment and task completion audit where needed.

## 4. Existing model questions to resolve before migration design

1. Whether guests should become a general customer entity with a guest profile/role, or whether a canonical customer table should own contact identities while accommodation-specific guest data remains separate.
2. Whether rooms should be generalized into bookable units linked to properties, while preserving existing room and reservation compatibility.
3. Whether reservation and payment lifecycle states need separate event histories rather than relying only on mutable current-state columns.
4. Whether receipt QR verification should resolve a receipt token through a server-only function/API rather than expose a token lookup table through the browser Data API.
5. How multi-property tenants, property-level staff access, and shared staff across locations should be represented.
6. Which events and data are owned by the backend Worker versus written directly by authorized Owner Desk clients.

## 5. Security and integrity requirements

- RLS on every exposed tenant-owned table, with tenant membership and role checks rather than authentication-only policies.
- Tenant-safe composite foreign keys where child records reference tenant-owned parents.
- Server-side authorization for provider webhooks, payment state changes, QR token resolution, AI tools, and privileged actions.
- Never expose service-role credentials, provider secrets, private webhook payloads, or internal payment references to the browser.
- QR values must be opaque and unguessable. QR scans must be authenticated, authorized, rate-limited, and audited.
- Payment events must be idempotent and validated against provider signatures and transaction details.
- Use immutable or append-only records for critical payment, receipt, access, and audit events where appropriate.
- Do not trust client-supplied organization IDs or user-editable metadata as authorization.

## 6. Migration recovery and reproducibility

The Supabase project records 11 applied migrations. Their original SQL was recovered directly from the `statements` arrays in `supabase_migrations.schema_migrations` and restored to `supabase/migrations/` on the feature branch, retaining each original timestamp and migration name.

All 11 repository files were fetched back from GitHub and compared with their corresponding Supabase migration-history statements. Every file matched exactly after normalizing only the final newline. No migration was replayed and no production schema change was made during recovery.

The recovered files establish the canonical ordered migration history in Git. A clean local database reset/replay has not yet been run, so clean-environment reproducibility remains to be verified before production schema expansion. Do not run `supabase db push` against production until the local replay, migration status, and live-schema comparison are complete.

### Migration verification status

- Original migration records found: 11 of 11.
- SQL statements recovered: 11 of 11.
- Repository file comparisons: 11 exact matches.
- Production migrations replayed during recovery: none.
- Clean local reset/replay: pending.
- Production schema drift check after local replay: pending.

### Additional access-control observation

All 19 public application tables have RLS enabled. The read-only privilege audit also found broad table-level grants on several tables for `anon` and/or `authenticated`, even where RLS policies currently restrict effective row access. RLS is not a substitute for least-privilege SQL grants. Review and tighten those grants in a separately tested security migration before launch; do not make blanket revocations without checking the frontend's required column-level access and service-role workflows.

## 7. Recommended next sequence

1. Run the recovered migration set against a clean local Supabase database and resolve any replay errors without changing production.
2. Compare the resulting local schema, functions, triggers, policies, grants, and constraints against the live project; document any drift.
3. Complete the least-privilege grants review and test browser access under anon/authenticated roles.
4. Finalize the domain model for customer identity, conversations/messages, properties/units, reservations, payments, receipts/QR verification, website handoff, automations, and staff permissions.
5. Agree backend ownership and API/event contracts before changing database structures that the Worker will consume.
6. Implement missing schema in small migrations with RLS, constraints, indexes, and explicit tests.
7. Regenerate frontend database types from the verified schema.

## 8. Scope exclusions

This audit does not authorize or implement autonomous walk-in kiosks, self-service physical check-in/out, smart locks, digital keys, or custom VELLARA hardware. Phase 1 walk-ins remain human-assisted through the Owner Desk.