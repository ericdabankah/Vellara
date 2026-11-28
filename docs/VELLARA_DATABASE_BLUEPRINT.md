# VELLARA Database Blueprint

Status: **Architecture proposal, not an applied migration**  
Environment audited: live Supabase project `VELLARA`  
Last inspected: 2026-11-28

## 1. Non-negotiable architecture

> Retell and Meta handle communication, OpenAI handles intelligence, and VELLARA controls business decisions and data.

- Retell is the voice transport/provider.
- Meta WhatsApp Cloud API is the WhatsApp transport/provider.
- OpenAI supplies model intelligence. Model output is never authorization.
- VELLARA's trusted backend and PostgreSQL are authoritative for tenant identity, staff permissions, property publication, availability, quotes, bookings, payment state, receipts, subscription entitlements and audit history.
- The browser is an untrusted client. It must not decide organization identity, staff role, final price, availability, payment success or publication state.
- The backend validates every business action and records it transactionally.

## 2. Live database baseline

The live project currently has 19 public tables and 11 recorded migrations. Existing tables include:

- Identity/tenancy: `profiles`, `organizations`, `organization_memberships`, `business_profiles`.
- Receptionist/channels: `receptionist_instances`, `organization_phone_numbers`, `phone_number_channels`, `receptionist_number_routes`.
- Hospitality/operations: `rooms`, `guests`, `reservations`.
- Communications: `calls`, `call_capacity_reservations`, `activity_events`.
- Subscription catalogue/billing: `subscription_plans`, `subscription_plan_entitlements`, `subscription_prices`, `organization_subscriptions`, `subscription_provider_events`.

Live schema gaps confirmed:
- No `properties`, `room_types`, `organization_modules`, `property_staff_assignments` or `property_assets` tables.
- No Storage buckets currently exist.
- No platform developer access relation exists.
- No customer booking payment/receipt ledger is present in the public schema.
- Starter entitlements are configured; Growth, Premium and Enterprise entitlements remain pending. No subscription price rows exist. All plans are currently unavailable for purchase.
- Operational tables are empty at audit time.

The existing database is a foundation to extend, not a finished product schema and not something to discard wholesale.

## 3. Tenant and identity model

### Reuse and harden
- `profiles`: user-facing profile linked to `auth.users.id`. Keep identity/authentication in Supabase Auth.
- `organizations`: tenant/business account.
- `organization_memberships`: organization membership and organization-scoped role.
- `business_profiles`: organization-level legal/contact/default locale data. Do not use it as a substitute for individual property records.

### Add
- `organization_modules`: enabled product modules for an organization, e.g. hospitality and real_estate. A module is not a user role.
- `platform_developer_access`: platform-level grants keyed to Auth user UUID, with active/suspended/revoked state, explicit scopes, grant actor, timestamps and revocation audit. Never grant based on email match, user metadata, client input or a frontend flag.
- Optional later: `organization_invitations` if invitation lifecycle cannot be adequately represented by existing membership fields.

### Rules
- A user may belong to multiple organizations.
- An organization may manage multiple properties.
- Organization roles remain owner, manager, operations and verification (subject to final policy matrix).
- Platform developer privileges are separate from organization roles.
- Resolve active organization and accessible modules from trusted membership/module state, not from a browser-supplied organization ID alone.
- Every tenant-owned record must carry `organization_id` directly or be provably scoped through a parent. Prefer composite foreign keys such as `(organization_id, property_id)` to prevent cross-tenant references.

## 4. Property foundation (shared across verticals)

Add `properties` as the canonical physical/commercial property record:
- `id`, `organization_id`
- `vertical`: `hospitality` or `real_estate`
- `name`, `slug`, `description`
- address/location fields, timezone and currency where property-specific
- `status`: draft, active, inactive/archived (final enum to be agreed)
- public publication state and publication timestamps
- creator/updater and timestamps

Required safeguards:
- Composite unique key `(organization_id, id)`.
- A property slug is unique within its organization; public route resolution must use an unambiguous organization + property identity, never a bare property slug.
- Public visibility is explicit. Draft, inactive, archived or unpublished records must not leak through public resolvers.
- Public identity is not authorization.
- Do not infer vertical from building appearance. Classify by operating model.

Add `property_staff_assignments` for staff access to a particular property when organization membership alone is too broad. Assignment must not elevate organization role.

## 5. Hospitality domain (hospitality properties only)

Keep the current `rooms`, `guests`, and `reservations` as migration candidates, but refactor their ownership to property scope. Do not simply add nullable property IDs and leave ambiguous organization-level inventory.

Add:
- `room_types`: property, name/code, description, max adults/children/occupancy, amenities, default/base rate metadata, status.
- `rooms`: individual physical sellable units linked to a property and room type; room number unique per property.
- `rate_plans` or `room_rates`: explicit currency, amount, rate basis (per night), effective dates, occupancy/season rules and cancellation terms.
- `availability_blocks`: maintenance/owner blocks and other unavailable periods, distinct from bookings.
- `reservations`: property, room or room-type allocation (choose allocation strategy), guest, check-in/out, party composition, status, quote snapshot and confirmation reference.
- `reservation_items` if a booking can contain multiple rooms or priced extras.
- `guests`: retain organization-level customer identity with optional property interaction history, avoiding duplicate guest records across properties owned by the same organization where appropriate.

Rules:
- Check-out is exclusive for overlap calculations.
- Availability and booking confirmation must be serialized/transactional to prevent double booking.
- A room's current status alone is not a date-range availability calculation.
- Never treat a default room-type rate as a final quote.
- Quote snapshots preserve the price and terms shown when a booking was made.
- Guest capacity must be validated server-side.
- The storefront and AI receptionist must use the same availability and quote service.

## 6. Real-estate domain (separate from hospitality)

Add:
- `real_estate_listings`: property, listing intent (sale or rent), listing type, title/description, price amount/currency and price basis, location, bedrooms, bathrooms, area/unit, status, published timestamps.
- `listing_features` or normalized amenity/features table where filtering requires it.
- `property_enquiries`: listing, contact details, source/channel, message, consent and lifecycle status.
- `viewing_appointments`: listing, prospect, proposed/confirmed slot, assigned staff and status.
- Later, add offer/lease/sale workflows only when transaction scope is specified.

Rules:
- Do not use hotel check-in/check-out, nightly room rates or guest capacity for long-term rental/sale.
- Distinguish monthly rent, annual rent and sale price explicitly.
- Availability of a listing and availability of a viewing slot are different concepts.
- A property may have one or more listing records over time; preserve listing history rather than overwriting commercial history.

## 7. Property assets and public mini-sites

Add `property_assets`:
- id, organization_id, property_id, storage_path
- original filename, MIME type, byte size, width, height
- category: exterior, interior, amenity, view, floor_plan, other
- alt text, caption, display order, cover flag
- upload status, publication state, uploaded_by, timestamps, archived_at

Storage:
- Private bucket, proposed name `property-media`.
- Object path: `<organization_uuid>/<property_uuid>/<asset_uuid>/<randomized_filename>`.
- JPEG, PNG, WebP, AVIF only; reject SVG. Proposed max size 20 MiB, subject to product decision.
- Backend creates short-lived upload intent; browser uploads directly to private bucket with overwrite disabled; backend verifies object, size, MIME and dimensions before marking ready.
- Public mini-site only receives ready, published, non-archived assets for an active published property. Use short-lived signed read URLs or a controlled image delivery layer.
- Never persist signed URLs as canonical data.
- Storage RLS is independent of table RLS.

Public mini-site is a commerce/discovery surface, not just a gallery:
- Hospitality filters: dates, guests/capacity, room type, amenities, price range and availability.
- Real-estate filters: sale/rent, price range with explicit basis, property type, location, bedrooms/bathrooms and listing status.
- Public resolver returns only published customer-visible fields.
- Booking/enquiry handoff returns to trusted VELLARA backend. Browser cannot self-confirm booking or payment.

## 8. Customer transaction and payment domain

Add:
- `quotes`: tenant, property, customer, line items, currency, subtotal, taxes/fees, total, expiry, status and immutable pricing snapshot.
- `bookings` or retain/refine `reservations` as the hospitality booking aggregate; avoid parallel booking authorities.
- `payment_attempts`: booking/quote reference, provider, provider reference, requested amount/currency, idempotency key, status and timestamps.
- `payments`: verified financial transaction ledger, provider reference, amount/currency, verification source, status and reconciliation fields.
- `refunds`: payment, provider reference, amount, reason, status and timestamps.
- `receipts`: immutable receipt number and snapshot of the settled transaction, issued only after verified payment.
- `transaction_events`: append-only lifecycle events for audit/reconciliation.

Rules:
- Subscription billing and tenant customer payments are separate bounded domains.
- Paystack/webhook or other provider callback must be verified server-side, signature checked and idempotent.
- A browser redirect or success screen is not proof of payment.
- Never store card PAN/CVV or payment secrets.
- Never mark a payment successful based only on an AI statement or frontend callback.
- Money uses integer minor units or a rigorously defined decimal representation; currency is mandatory.
- Booking and payment state transitions are server-controlled and auditable.

## 9. Communication and receptionist domain

Reuse and evolve:
- `receptionist_instances`: organization-scoped AI receptionist configuration and provider mapping.
- `organization_phone_numbers`, `phone_number_channels`, `receptionist_number_routes`: channel/number provisioning and routing.
- `calls`: Retell call record, provider call ID, direction, lifecycle, timestamps, outcome and summary.
- `call_capacity_reservations`: concurrency leases, backend-only.
- Add `conversations` and `messages` for channel-neutral conversation history; each message has channel/provider identifiers, direction, status, timestamps and safe metadata.
- Add `channel_webhook_events` or provider event inbox for signature-verified, deduplicated webhook processing.
- Add `ai_action_proposals` / `action_executions` if audit requires separating model suggestions from authorized business actions.

Rules:
- Retell and Meta are communication providers, not business-data authorities.
- OpenAI output is untrusted input. Validate tool/action schema and tenant scope server-side.
- Store provider secrets in server-side secret management, never in public tables or frontend bundles.
- Redact/minimize sensitive transcript and message content; define retention and deletion policy before production rollout.

## 10. Subscription and platform billing

Retain current catalogue tables, but complete and test:
- plan catalogue and versioned entitlements
- prices by currency, billing interval and provider product/price reference
- organization subscription lifecycle and immutable entitlement snapshot
- webhook event deduplication and reconciliation
- explicit grace, trial, past-due, suspended and cancelled behavior

Plan entitlements should be data-driven and validated server-side. Do not hardcode phone/receptionist/concurrency limits in the frontend. Do not enable purchase until each plan's price and entitlement configuration is complete and reviewed.

## 11. Authorization and database security

- RLS on every tenant-owned table, with tenant predicates tied to authenticated membership and property assignment.
- Use explicit least-privilege table and column grants. Current audit found broad table-level privileges granted to anon/authenticated on multiple tables; RLS currently blocks operations without matching policies, but grants should be tightened as defense in depth.
- Public anonymous access only through explicitly designed published-content read policies or backend resolver endpoints.
- No public access to guests, reservations, calls, messages, payments, staff records or provider events.
- Backend service credentials must never reach the browser.
- SECURITY DEFINER functions require fixed search_path, strict authorization checks, narrow grants and review.
- Audit high-risk actions: staff grants/revocations, property publication, quote creation, booking transitions, payment/refund, plan changes, provider configuration and developer access.
- Platform developer scopes are separate from organization roles and must be enforced server-side.
- Test cross-tenant reads/writes, role matrix, revoked users, inactive memberships, forged organization IDs, public resolver leaks and webhook replay.

## 12. Frontend/backend contract boundary

The Owner Desk frontend must consume approved typed API contracts. It must not invent routes or directly write privileged operational data to Supabase.

Backend owns:
- tenant/session resolution
- property and staff authorization
- media upload intent/finalization/publication
- availability and quote calculation
- booking and payment state transitions
- Retell/Meta provider operations and webhook processing
- subscription enforcement and platform access

Frontend owns:
- presentation, navigation, local form state and client-side validation hints
- explicit user intent and confirmation UX
- loading, empty, error, permission and success states based on server responses

Continue the existing API convention unless backend owners formally approve a change: `/v1`, direct JSON success objects, errors shaped as `{ error: { code, message, request_id } }`. Caller identity comes from verified auth and trusted database state, never a client-supplied role or tenant claim.

## 13. Migration and delivery sequence

1. Freeze new frontend data assumptions until this blueprint and backend contracts are reviewed.
2. Reconcile existing open migration PRs and their dependencies. In particular, property foundation work must be reconciled with the live schema before any migration is applied.
3. Produce a canonical schema ERD and a table-by-table migration plan.
4. Fix baseline grants/policies and test current role behavior before adding new domains.
5. Add property foundation and organization modules.
6. Add property assets and private Storage policies.
7. Refactor hospitality inventory/reservations to property scope and add real-estate listings separately.
8. Add quote, booking, payment and receipt lifecycle.
9. Add channel-neutral conversation/message records and complete provider webhook idempotency.
10. Finalize subscriptions/entitlements and platform developer access.
11. Run migration replay, rollback/recovery, RLS matrix, concurrency, webhook replay and end-to-end tests in a separate staging Supabase project.
12. Only after review and staging acceptance, schedule production migrations.

**No production migration or data write is authorized by this document.**

## 14. Decisions required before schema migrations

1. Public URL strategy: path-based `/p/{organization-slug}/{property-slug}` versus subdomain/host mapping. Path-based routing is the simpler first-launch default.
2. Hospitality allocation: reserve a specific room immediately, or reserve room type and assign a room later. Recommendation: support room-type availability with controlled assignment, while preserving specific-room bookings where operations require them.
3. Booking lifecycle: define pending hold duration, confirmation rules, cancellation/refund policy and whether manual/offline payment is supported.
4. Guest/customer identity: organization-wide contact record with property-level interactions is the recommended default.
5. Currency/money representation and Ghana tax/fee rules must be explicitly agreed; never infer tax treatment.
6. Whether launch supports only hotels/short-stay hospitality and real-estate enquiries, or also end-to-end rental/sale closing. Recommendation: start with bookings for hospitality and enquiries/viewings for real estate.
7. Message/transcript retention and customer consent requirements.
8. Final owner/manager/operations/verification permission matrix and property-level staff assignment behavior.

## 15. Audit caveats

- Supabase advisor results were clean at the time of inspection, but advisor output is not a substitute for adversarial RLS tests.
- RLS is enabled on all 19 public tables. Policies are not uniformly write-enabled; most writes are intentionally absent from browser policies.
- Existing table-level grants are broader than the desired least-privilege baseline. RLS currently supplies an additional filter, but grants should be tightened.
- The live database was inspected read-only. This document is a design proposal and has not changed the live schema.
