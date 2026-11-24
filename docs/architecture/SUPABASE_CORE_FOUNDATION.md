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
- a single authenticated organization-creation RPC that atomically creates the organization, business profile, and initial owner membership;
- row-level security for all exposed application tables.

It intentionally does not create reservations, inventory, conversations, calls, payments, staff PINs, QR tokens, or AI tables. Those modules require approved domain contracts first.

## Security decisions
- Authorization is derived from `organization_memberships`, never from user-editable Auth metadata.
- All four public application tables have RLS enabled.
- Clients cannot directly create or alter memberships. Membership provisioning is reserved for trusted database functions/backend workflows.
- Tenant reads require active membership. Organization and business-profile writes require owner or manager membership.
- A user can update only their own limited profile fields.
- The profile trigger reads Auth metadata only as a display-name convenience. It does not grant roles or permissions.
- The privileged organization bootstrap RPC requires an authenticated user, validates its inputs, and is executable only by the `authenticated` role.
- Internal authorization helpers live in the non-exposed `private` schema and pin an empty search path.

## Initial business types
The first release recognizes `hotel`, `real_estate`, and `other`. Expand only through a reviewed migration and matching product contract.

## Frontend integration contract
After sign-up/sign-in, the frontend should:
1. obtain the authenticated session from Supabase Auth;
2. query `organization_memberships` for the current user's active memberships;
3. load the matching `organizations` and `business_profiles` rows;
4. call `create_organization` only when the user is creating a new business;
5. never send or trust a role value from the browser;
6. handle zero memberships, multiple memberships, expired sessions, and RLS-denied access explicitly.

The frontend must use only the Supabase publishable key. Never ship a secret or service-role key to the browser.

## Important limitations
This is the first database foundation, not the complete production authorization model. Staff PIN authentication, invitation acceptance, membership changes, platform administration, audit logging, storage policies, and operational module tables are not included yet.
