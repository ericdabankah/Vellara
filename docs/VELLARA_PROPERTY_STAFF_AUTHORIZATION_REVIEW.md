# VELLARA Property Staff Authorization Review

**Purpose:** define the next database authorization increment before implementing staff-management UI or applying migrations.

**Inspection date:** 2026-11-27  
**Production impact:** none. All connected Supabase queries used for this review were read-only. The property-management migrations reviewed below exist in an open draft PR stack and are not present in the connected production schema.

## 1. Important environment distinction

The connected production database currently has no `properties`, `room_types`, or `property_staff_assignments` table. It also has no `private.has_property_role` function. The production tables still use organization-scoped `rooms` and `reservations`.

The property-management migration in the PR #14 branch proposes these objects, including a property assignment table and a `has_property_role` helper. That proposed model must not be described as live or tested against production.

The current draft dependency chain must be replayed in a disposable/isolated database before its migrations are eligible for application. The user has declined paid Supabase development branches, and Docker is unavailable in the current workflow. Therefore this document is a design/review artifact, not permission to run DDL against production.

## 2. Proposed membership + property assignment model

The PR #14 design uses two authorization dimensions:

1. `organization_memberships.role` is the organization-level role: `owner`, `manager`, `operations`, or `verification`.
2. `property_staff_assignments` grants an active non-owner member access to an individual property.

This is a sound separation. Do **not** duplicate the same organization role in the assignment row. The assignment should scope a user's existing organization role to a property, not create a second competing role system.

The proposed assignment relation includes:
- organization_id
- property_id
- user_id
- granted_by
- created_at
- revoked_at

Its composite foreign keys correctly bind the property and membership to the same organization. Its partial unique index prevents duplicate active assignments while preserving prior revoked rows.

### Required refinements before implementation

1. **Make revocation irreversible in-place.** The current proposed owner UPDATE policy and column grant allow changing `revoked_at`. Without a trigger/check, an owner could set it back to NULL and reactivate the same historical row. Prefer immutable assignment history: once revoked, never clear `revoked_at`; regrant by inserting a new row. Add a database guard for this.
2. **Audit every assignment mutation.** Grant/revoke and role/membership lifecycle changes must write an audit event in the same transaction. Do not rely on a separate browser insert.
3. **Prevent assignment to non-active members.** The current insert policy checks for an active organization membership. Preserve this condition in the trusted write path and re-check under transaction/locking where needed.
4. **Protect owner invariants.** Owners have organization-wide access and bypass property assignments in the proposed helper. Do not allow ordinary membership operations to demote, suspend, or remove the last active owner.
5. **Keep assignment management owner-only initially.** The proposed policy does this. Do not silently extend assignment administration to managers until delegated administration is explicitly approved.
6. **Avoid client-controlled actor identity.** Derive `granted_by` and audit actor from `auth.uid()`, never from a frontend payload.
7. **Keep role changes separate from property assignment.** A role change must be authorized and audited independently. Existing assignments may remain, but the effective permissions must immediately reflect the new organization role.

## 3. Proposed role matrix

This is the recommended initial policy baseline for approval and implementation. It is deliberately least-privilege.

| Capability | Owner | Manager | Operations | Verification |
|---|---:|---:|---:|---:|
| Read organization settings | Yes | Yes | Limited | No |
| Manage billing, subscription, phone numbers, receptionist configuration | Yes | No initially | No | No |
| Read all properties in organization | Yes | No | No | No |
| Read assigned properties | Yes | Yes | Yes | Yes |
| Create properties | Yes | Yes | No | No |
| Update assigned property details | Yes | Yes | No | No |
| Manage property staff assignments | Yes | No initially | No | No |
| Read assigned room inventory and room types | Yes | Yes | Yes | No |
| Create/update assigned room inventory | Yes | Yes | Yes | No |
| Read assigned reservations | Yes | Yes | Yes | Yes |
| Create/update assigned reservations | Yes | Yes | Yes | No |
| Manage organization memberships and invitations | Yes | No initially | No | No |
| Read audit events within authorized scope | Yes | Yes, assigned scope | Assigned scope | Assigned scope only if event type is relevant |

The matrix does not grant verification staff access to room inventory. They may inspect assigned reservations and property identity details required for verification, but should not see operational room data unless a later requirement justifies it.

## 4. Resource-scope gaps in the current PR #14 property migration

The proposed PR #14 migration property-scopes `properties`, `room_types`, `rooms`, and `reservations`. That is not yet complete property isolation.

The following existing tables remain organization-scoped in the current schema and/or proposed migration:

| Resource | Current data shape | Risk / decision required |
|---|---|---|
| `guests` | organization_id only; includes name, phone, email, notes, tags | An assigned operator can currently see all organization guests. Decide whether guest CRM is intentionally shared across properties or needs property links. |
| `calls` | organization_id, phone_number_id, receptionist_instance_id; no property_id | Assigned staff may see call logs for unrelated properties/numbers. Decide whether numbers/receptionists map to one property or remain organization-wide. |
| `activity_events` | organization_id, actor_user_id, event/entity fields; no property_id | Current event feed is organization-wide. Property-specific audit access cannot be enforced reliably without a property scope or a safe entity-to-property resolution strategy. |
| `organization_phone_numbers` | organization_id only | Keep owner-only management; decide whether read access is owner/manager only. |
| `phone_number_channels` | organization_id and phone_number_id | Keep configuration data restricted to owner/manager. |
| `receptionist_instances` | organization_id only | Keep configuration read/manage restricted to owner/manager. |
| `receptionist_number_routes` | organization_id and number/receptionist IDs | Keep routing configuration restricted to owner/manager. |
| `organization_subscriptions` | organization_id and billing/provider fields | Billing/provider metadata should not be visible to operations or verification. |

### Recommended approach

- Keep organization billing, phone-number inventory, channel configuration, receptionist configuration, and route management organization-level, but owner-only for writes and owner/manager for reads.
- Add explicit property ownership/mapping to phone numbers and receptionist instances only if a single number/receptionist must be dedicated to a property. Do not infer property ownership from free-form names.
- Treat guest records as a shared organization-level identity directory only for owners/managers. For property staff, add an explicit property-to-guest association (or equivalent authoritative relation) before granting access. A reservation join alone is insufficient for guests who have enquiries, walk-ins, or cross-property stays.
- Add `property_id` to call records only when the routing path can authoritatively resolve it. Otherwise calls remain owner/manager-only organization data.
- Add `property_id` to activity events for property-scoped actions. Organization-wide events remain visible only to roles authorized for organization-wide audit.
- Keep billing/subscription provider references out of operations and verification views.

Do not solve these gaps by adding broad `is_organization_member()` read policies to the new property tables. A property assignment must be checked on every property-scoped row.

## 5. Invitation model is a separate missing capability

The current membership row requires a real `auth.users.id`, and the unique key is `(organization_id, user_id)`. An `invited` status alone does not provide a secure pre-registration invitation workflow because there is no invited email address, token hash, expiry, acceptance timestamp, or identity binding.

Recommended flow:
1. Owner submits a normalized email and allow-listed role.
2. Trusted server/backend creates a pending invitation with a cryptographically random token; store only a token hash, never the raw token.
3. Invitation expires and can be revoked; duplicate active invitations are prevented.
4. Acceptance requires an authenticated, verified email matching the invitation.
5. A trusted transaction creates or activates the membership and records inviter, acceptor, timestamps, and audit event.
6. Replays, expired tokens, mismatched identities, and invitations for an existing active member are rejected.

Supabase Auth Admin APIs require a trusted server context. Never call admin invite/create-user methods from the browser and never ship a service-role key to the frontend. The frontend should call an approved backend endpoint/RPC contract only after it exists.

## 6. Audit-event requirements

The current `activity_events` table already has `actor_user_id`, `event_type`, `entity_type`, `entity_id`, `summary`, `metadata`, and `created_at`, but no property_id. Current RLS grants organization members SELECT only; there is no client INSERT policy.

Before staff operations go live:
- add a nullable property scope for property-specific events, with an organization/property composite FK;
- preserve organization-wide events as a separate event scope;
- write events only from trusted database functions or the backend in the same transaction as the protected mutation;
- derive actor from authenticated context;
- deny UPDATE and DELETE to application roles and guard append-only behavior at the database boundary;
- keep metadata allow-listed, bounded, and free of secrets/payment credentials;
- make event visibility follow the event's organization/property scope and the viewer's role;
- test that revocation removes access to historical property-scoped events where policy requires active assignment.

## 7. Database implementation order

1. Finish and review the existing property foundation dependency stack. Do not merge/apply it until full migration replay and authorization tests pass.
2. Refine the property assignment lifecycle (irreversible revocation, safe regrant, actor audit).
3. Implement staff invitation and membership lifecycle in a trusted server-side path.
4. Implement last-active-owner protection and role allow-listing.
5. Reconcile every organization-wide resource in section 4 with the approved role/scope model.
6. Add property-scoped audit events and append-only enforcement.
7. Add database authorization tests for each role, assigned/unassigned property, suspended membership, revoked assignment, cross-organization IDs, and concurrent membership changes.
8. Only then build the Owner Desk Staff Access UI.

## 8. Verification status

- Production Supabase: inspected read-only; no writes performed.
- Property foundation migration: draft in PR #14 stack, not applied to production.
- Property assignment policies/helper: proposed, not live.
- Isolated migration replay: not performed.
- RLS/privilege tests: not performed.
- Staff management UI: intentionally not implemented yet.

This is the security boundary: a frontend workspace selector or hidden navigation item is not authorization. The database/trusted backend must enforce the approved scope on every operation.
