# VELLARA production database

## Project and migration state

- Supabase project: `VELLARA` (`iztktfglrvdpnwtvefdw`)
- Region: `eu-west-1`
- PostgreSQL: 17.12
- Project status at implementation: `ACTIVE_HEALTHY`
- Production database was extended in place, per the owner's instruction to use production directly. No separate staging project or branch was created.

Applied migration history:

| Version | Migration |
|---|---|
| 20261124213224 | `core_tenant_foundation` |
| 20261124213310 | `tighten_phone_checks_and_event_trigger_acl` |
| 20261124214801 | `repair_e164_phone_constraints` |
| 20261124215050 | `harden_org_bootstrap_and_fk_indexes` |
| 20261125174014 | `owner_desk_saas_domain_foundation` |
| 20261125174120 | `enforce_capacity_and_fk_integrity` |
| 20261125174141 | `database_security_and_fk_index_hardening` |
| 20261125174412 | `reservation_room_conflict_protection` |

## Tenant foundation retained

The original tenant tables remain:

- `profiles`
- `organizations`
- `organization_memberships`
- `business_profiles`

The authenticated `public.create_organization` RPC remains the single workspace bootstrap entry point. It calls the existing private tenant bootstrap function and atomically creates the organization, business profile, and owner membership.

## New production tables

### Subscription and billing

- `subscription_plans`: Starter, Growth, Premium, Enterprise catalogue.
- `subscription_plan_entitlements`: phone, receptionist, concurrent-call, team-member limits and configuration state.
- `subscription_prices`: currency, monthly/yearly amount in minor units, provider, and effective dates.
- `organization_subscriptions`: tenant subscription lifecycle, billing references, periods, and entitlement snapshot.
- `subscription_provider_events`: server-only webhook event inbox with unique provider event IDs and processing status.

### Numbers and AI receptionist configuration

- `organization_phone_numbers`: one unique E.164 identity per connected phone number.
- `phone_number_channels`: voice and WhatsApp channel state attached to that identity.
- `receptionist_instances`: separately configured receptionist runtimes.
- `receptionist_number_routes`: tenant-safe mapping of a number/channel to one or more receptionist instances.

Voice and WhatsApp on the same E.164 number are channel records attached to one phone-number row. They do not consume two number slots.

### Owner Desk operating data

- `calls`: normalized call records and operational summaries.
- `call_capacity_reservations`: expiring server-managed concurrency leases.
- `guests`: tenant-scoped guest contact records.
- `rooms`: room inventory, capacity, status, and optional nightly rate.
- `reservations`: guest stays, room assignment, date range, status, and amount.
- `activity_events`: tenant-scoped operational activity feed.

## Security model

- RLS is enabled on every new public table.
- Public plan catalogue and entitlement definitions are read-only.
- Tenant records are visible only through the existing private membership predicates.
- Guest, room, and reservation writes are limited to owner, manager, and operations membership roles.
- Calls, phone records, channels, receptionist definitions, routes, subscriptions, and activity are read-only to browser users.
- Billing webhook payloads and call-capacity reservations have no browser table grants and explicit deny policies.
- Server-only RPCs are granted to `service_role` only and use `SECURITY INVOKER`, not `SECURITY DEFINER`.
- The frontend uses a Supabase publishable key. A service-role or secret key must never be exposed through Vite environment variables.

## Capacity enforcement functions

| Function | Purpose |
|---|---|
| `register_verified_phone_number` | Adds a number only after backend verification and checks the subscription's number limit atomically. |
| `create_receptionist_instance` | Checks the active subscription's receptionist-instance limit before provisioning. |
| `reserve_call_capacity` | Uses an organization advisory transaction lock to enforce simultaneous-call capacity and creates a renewable lease. |
| `release_call_capacity` | Releases the active lease when a call finishes. |

The backend must create the call record before reserving call capacity, renew leases while calls remain active, and release them on terminal call events.

## Reservation integrity

A before-insert/update trigger:

- Locks the room transactionally to avoid two simultaneous bookings winning the same room.
- Checks that the room belongs to the organization.
- Checks guest count against room capacity.
- Rejects pending, confirmed, or checked-in reservations with overlapping date ranges.
- Allows non-blocking inquiry, canceled, and no-show records.

Composite foreign keys ensure guest, room, number, receptionist, and call references cannot cross organization boundaries.

## Current plan configuration

| Plan | Phone numbers | Receptionists | Concurrent calls | State |
|---|---:|---:|---:|---|
| Starter | 1 | 1 | 1 | Entitlements configured |
| Growth | Pending | Pending | Pending | Not purchasable |
| Premium | Pending | Pending | Pending | Not purchasable |
| Enterprise | Negotiated | Negotiated | Negotiated | Not purchasable |

All plans currently have `is_available_for_purchase = false`. The price table is empty. No payment provider has been selected and no subscription records exist. This is intentional: checkout cannot be activated until the owner approves pricing, higher-tier limits, and billing behaviour.

## Verification performed

- Confirmed all 18 public application tables have RLS enabled.
- Confirmed plan catalogue contains exactly the four approved plan names.
- Confirmed security advisor returns no lints.
- Confirmed health advisor returns no lints.
- Performance advisor returns no unindexed foreign-key findings; unused-index notices are expected before application traffic.
- Ran transaction-scoped SQL checks for number-slot limit, receptionist-instance limit, simultaneous-call limit, lease release, and overlapping room reservations. All checks passed and the transaction was rolled back. No test organization, user, guest, call, or reservation rows were left behind.
- Existing auth-user and tenant tables remain empty. No owner accounts were created and no confirmation emails were sent.

## Still required before production go-live

1. Capture the applied production SQL into the repository's canonical migration files using the Supabase CLI workflow.
2. Set and verify the deployed Owner Desk redirect URL and production Supabase environment variables.
3. Complete real signup, email confirmation, sign-in, and password recovery tests.
4. Complete two-owner cross-tenant RLS tests using real signup flows.
5. Backend integration for payment webhooks, phone verification, receptionist provisioning, Retell/voice events, call control, and dashboard activity.
6. Finalize Growth/Premium limits, prices, provider, trial, taxes, grace period, cancellation, and Enterprise sales workflow.
