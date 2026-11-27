# VELLARA Staff Access and Audit Foundation

**Status:** architecture and frontend hardening proposal only. This document reflects a read-only inspection of the connected production Supabase schema on 2026-11-27. No production changes were made.

## 1. Verified live database facts

The live public schema currently contains `organization_memberships`, `profiles`, and `activity_events`, but does not contain a `property_staff_assignments` table.

The live `organization_memberships` contract is:
- `organization_id`, `user_id`, `role`, `status`, `invited_by`, `created_at`, `updated_at`.
- Roles: `owner`, `manager`, `operations`, `verification`.
- Statuses: `active`, `invited`, `suspended`.
- Unique membership per organization/user pair.

Current RLS policies observed:
- Membership SELECT: a user can read their own membership, or an organization owner/manager can read memberships in that organization.
- No INSERT, UPDATE, or DELETE policy was present for `organization_memberships`.
- Profile SELECT/UPDATE is self-only. A manager cannot currently read another member's profile through the live `profiles` table.
- Activity SELECT is available to organization members through `private.is_organization_member`.
- No INSERT/UPDATE/DELETE RLS policy was present for `activity_events`.

The live `private` helper functions inspected were `has_organization_role` and `is_organization_member`. The connected production schema did not return a `has_property_role` helper. Do not assume property-level assignment enforcement is live merely because a proposed migration or frontend branch describes it.

The live database grants broad table privileges to `anon` and `authenticated` on `activity_events`, including destructive privileges. RLS currently has no write policies for that table, but RLS does not constrain TRUNCATE or MAINTAIN. The separate privilege-hardening proposal must be reconciled and tested before production use.

## 2. Consequence for the current product

The Owner Desk can currently read organization membership roles and statuses for an owner/manager, but it cannot safely:
- Invite a member.
- Change a member's role.
- Suspend or revoke a member.
- Assign a member to an individual property.
- Reliably show other members' profile names or contact details under the current self-only profile policy.
- Write authoritative audit events from the browser.

Do not build fake buttons that appear to perform these operations. Do not loosen profile RLS simply to make a team list look complete. The current Activity page is a read-only view of events written by a trusted path; it is not evidence that browser-originated actions are audited.

## 3. Target authorization model

Keep organization roles as the coarse-grained boundary:
- **owner:** organization-wide administration, staff lifecycle, billing and security settings.
- **manager:** operational administration within explicitly delegated organization/property scope. Whether managers can invite staff or change roles must be an explicit policy decision, not assumed.
- **operations:** day-to-day hospitality operations for assigned properties only.
- **verification:** read-only verification tasks, with only the minimum guest/reservation/property data required.

Add property assignments as a separate relation only after the team approves the exact model. A candidate relation should identify organization, property, user, assignment role/scope, assigning actor, creation time, and revocation time; it must enforce that the property and membership belong to the same organization. The database, not a client-side filter, must enforce active assignments on every property-scoped read and write.

Avoid storing authorization in user-editable Auth user metadata. Keep role and assignment truth in database tables, and make RLS policies consult current database state so membership revocation takes effect without waiting for JWT claims to refresh.

## 4. Target staff lifecycle

Implement staff actions through narrowly scoped, atomic database functions or trusted backend endpoints:
1. Invite an existing or new authenticated identity with a verified invitation flow.
2. Create an invited membership with an allow-listed role.
3. Accept the invitation only for the intended authenticated identity.
4. Activate, suspend, change role, or revoke membership with actor authorization.
5. Prevent removing or demoting the last active owner.
6. Prevent self-escalation and cross-organization membership changes.
7. Require an owner-authorized property assignment and ensure assignment is revoked when membership is suspended/revoked.
8. Write the corresponding audit event in the same transaction as the protected state change.

Do not rely on a browser-supplied actor ID, role, organization ID, or audit metadata as proof of authority. Derive the actor from `auth.uid()` or verified backend credentials.

## 5. Target audit model

Audit events should be append-only to application callers. A trusted database function or backend service should write:
- organization and optional property scope;
- actor user ID (nullable only for system-originated events);
- event/action key;
- entity type and entity ID;
- timestamp generated by the database;
- prior and resulting state for state transitions;
- reason or structured metadata with strict size and field allow-lists;
- request/correlation ID where available.

Do not allow clients to choose arbitrary actor IDs or overwrite/delete prior events. Keep event creation in the same transaction as the action being audited. Define retention, export, and access rules before adding sensitive before/after values.

## 6. Frontend hardening delivered in this branch

AuthGate workspace loading now uses a monotonically increasing request version. It ignores stale membership, organization, or business-profile responses after a newer auth/workspace request has superseded them. Auth state events invalidate in-flight workspace loads, clear prior workspace state on sign-in/sign-out/user update, and resolve initial auth loading if an auth event arrives before `getSession()` completes.

This is a race-condition guard, not an authorization control. Supabase RLS remains the security boundary.

## 7. Verification and release gates

Before staff management is enabled:
- Create an isolated development database and replay the complete migration history.
- Reconcile migration history with the live schema; do not assume proposed PR migrations are applied.
- Add and test membership lifecycle functions/policies for every role and cross-tenant case.
- Add and test property assignment enforcement for every property-scoped table and RPC.
- Restrict table grants separately from RLS, including `activity_events`; inspect default privileges and table ownership.
- Verify append-only audit writes and atomic rollback behavior.
- Test last-owner protection, invitation identity binding, suspended/revoked access, cross-organization IDs, and concurrent role changes.
- Add automated database authorization tests and frontend tests.
- Only then expose staff-management actions in the Owner Desk.

**Production remains read-only during this work.** No migration in this proposal has been applied, and no staff invite/role-management UI should be represented as operational until the database and trusted backend contracts exist.
