# Supabase Core Foundation

## Project
- Supabase project: VELLARA
- Project ref: `iztktfglrvdpnwtvefdw`
- Region: `eu-west-1`
- PostgreSQL: 17
- This project is dedicated to VELLARA. Do not use the Serva or SLEIT projects.

## Initial scope
This migration establishes identity and tenant isolation only:
- one profile per Supabase Auth user;
- organizations as the tenant boundary;
- organization memberships with owner, manager, operations, and verification roles;
- one business profile per organization;
- an authenticated organization-creation RPC that atomically creates the organization, business profile, and initial owner membership;
- row-level security for all exposed application tables.

It intentionally does not create reservations, inventory, conversations, calls, payments, staff PINs, QR tokens, or AI tables. Those modules require approved domain contracts first.

## Security decisions
- Authorization is derived from `organization_memberships`, never from user-editable Auth metadata.
- All four public application tables have RLS enabled.
- Clients cannot directly create or alter memberships. Membership provisioning is reserved for trusted database functions/backend workflows.
- Tenant reads require active membership. Organization and business-profile writes require owner or manager membership.
- A user can update only their own limited profile fields.
- The profile trigger reads Auth metadata only as a display-name convenience. It does not grant roles or permissions.
- The PostgREST-facing `public.create_organization` function is SECURITY INVOKER. It delegates to the restricted SECURITY DEFINER implementation in the non-exposed `private` schema.
- Privileged functions use a fixed empty search path, schema-qualified objects, explicit caller checks, and restricted EXECUTE grants.
- Phone fields use E.164 validation; the live constraint repair is recorded as an additive migration.
- Direct membership INSERT, UPDATE and DELETE privileges are not granted to authenticated clients.

## Applied migration history
The repository migration filenames must match the migration versions recorded in the VELLARA project:
- `20261124213224_core_tenant_foundation.sql`
- `20261124213310_tighten_phone_checks_and_event_trigger_acl.sql`
- `20261124214801_repair_e164_phone_constraints.sql`
- `20261124215050_harden_org_bootstrap_and_fk_indexes.sql`

Do not edit applied migrations. Correct mistakes with new additive migrations.

## Initial business types
The first release recognizes `hotel`, `real_estate`, and `other`. Expand only through a reviewed migration and matching product contract.

## Backend integration contract
The frontend authenticates with Supabase Auth, then sends the access token to the Cloudflare Worker API. The API verifies the token with Supabase Auth and forwards the caller's bearer token to PostgREST so database RLS remains active.

Initial API routes:
- `GET /health`: public liveness only.
- `GET /v1/me`: verified identity and own profile.
- `GET /v1/organizations`: active organization memberships visible to the caller.
- `POST /v1/organizations`: atomic organization bootstrap through the database RPC.

The frontend must not send or trust user IDs, organization roles, membership status, or payment/inventory state. Never ship a secret or service-role key to the browser or Worker request path.

## Verification performed
- Four public application tables exist and have RLS enabled.
- Valid Ghanaian E.164 example `+233501234567` passes the phone check.
- Missing leading plus and leading-zero country prefix examples are rejected.
- `anon` has no SELECT privilege on profiles.
- `authenticated` has no direct INSERT, UPDATE or DELETE privilege on organization memberships.
- The public organization RPC is SECURITY INVOKER; its private implementation is SECURITY DEFINER. The public function is not executable by anon.
- Supabase security advisor currently reports no security lints.
- Performance advisor reports only unused-index notices on a new, empty database; these are expected until real workloads exercise the indexes.

## Important limitations
This is the first database foundation, not the complete production authorization model. Automated end-to-end Auth tests, cross-tenant tests using separate real test users, invitation acceptance, membership changes, platform administration, audit logging, storage policies, and operational module tables are not included yet.
