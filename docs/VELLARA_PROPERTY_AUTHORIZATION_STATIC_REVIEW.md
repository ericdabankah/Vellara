# VELLARA Property Authorization Static Review

**Status:** Documentation-only review of the proposed PR #14 migration stack. No SQL was executed and no production state was changed.
**Reviewed:** 2026-11-27
**Base:** PR #20 property staff authorization review.

## 1. Executive result

The property-level authorization direction is sound, but the current draft migration stack is **not ready to merge or apply**. Static review identified concrete authorization lifecycle gaps and unresolved resource-scope decisions. These findings must be resolved in the migration design and then verified by isolated replay and role-based tests.

The connected production database still does not contain the proposed property tables or helper. Nothing in this document describes live production authorization.

## 2. Findings requiring remediation

### P0 - Assignment revocation can be reversed

The proposed migration grants authenticated users UPDATE on `property_staff_assignments.revoked_at`. The owner-only UPDATE policy checks that the caller is an organization owner, but it does not constrain the transition. An owner can set a previously non-null `revoked_at` back to NULL, reactivating the same historical assignment row.

**Required correction**
- Make revocation one-way at the database boundary: allow NULL -> timestamp and reject timestamp -> NULL or any change to an already-set timestamp.
- Regrant access by inserting a new assignment row.
- Keep the partial unique index for one active assignment per organization/property/user.
- Test that revoked rows cannot be reactivated, overwritten, or deleted by application roles.
- Record grant and revoke events in the same transaction as the assignment mutation.

### P0 - Activity and guest data are not property-isolated

The property migration scopes properties, room types, rooms, and reservations, but the current data model leaves `guests` and `activity_events` organization-scoped. Calls and communication configuration are also organization-scoped.

This means a property assignment alone is not a complete data boundary:
- Guest records contain personal contact details and notes. A broad organization-member read policy would expose guests unrelated to the assigned property.
- Activity events have no `property_id`, so an assigned user cannot safely receive a property-only audit timeline from the current row shape.
- Calls have no authoritative property scope. A phone number or receptionist name must not be used as a guessed mapping.

**Required correction**
- Keep guests owner/manager-only until an explicit property-to-guest relationship is designed and tested.
- Keep calls owner/manager-only until trusted routing writes a verified property scope.
- Add nullable property scope to property-specific audit events, backed by a composite organization/property FK. Keep organization-wide events distinct.
- Define RLS for property-scoped events using active property assignment; do not grant property staff organization-wide event reads.
- Do not expose raw guest notes, phone metadata, billing, or provider configuration to operations/verification by default.

### P1 - Trigger checks do not define deactivation semantics

The proposed active-room-type trigger validates that a room references an active, non-archived room type when the room is inserted or its property/type reference changes. It does not run when the referenced room type is later deactivated or archived. Existing rooms can therefore continue to reference an inactive type.

Likewise, the active-property trigger checks property status on new or updated inventory/reservation rows, but does not define what happens when a property with existing inventory is deactivated.

**Required correction**
Choose and document the lifecycle semantics before adding triggers:
- If deactivation means "stop new inventory and reservations, preserve existing records", explicitly allow existing rooms to reference inactive room types and ensure all create flows filter inactive types.
- If deactivation means "no active rooms may use this type", reject deactivation while active rooms reference it, or perform a trusted transactional archival workflow.
- For property deactivation, preserve historical reservations and inventory but block new operational writes. Define whether room-status updates and reservation lifecycle transitions remain allowed for existing records.
- Test each chosen transition, including concurrent changes.

### P1 - Property creation and module enablement need an invariant review

The draft property insert policy checks the matching module is enabled, and the creator-assignment trigger creates an assignment for non-owner creators. The module table also has separate member-read and owner/manager write policies.

**Required correction**
- Verify that module state cannot be changed by operations/verification users and that the authenticated column grants match the policy.
- Verify module disablement does not silently strand active properties or break read access and historical operations.
- Verify property creation, module enablement, and creator assignment behave atomically under failure and concurrency.
- Verify owner-created properties work without a redundant owner assignment, while manager-created properties receive exactly one active assignment.

### P1 - Role policy and SQL privilege posture must be tested together

The migration uses RLS policies plus column/table grants. These are separate enforcement layers. The static policy text alone cannot establish effective access.

**Required correction**
- After isolated replay, inspect effective table and column privileges with `has_table_privilege` and `has_column_privilege`.
- Verify no application role has DELETE, TRUNCATE, MAINTAIN, REFERENCES, or TRIGGER on tenant tables unless a reviewed use case requires it.
- Verify the public subscription catalogue remains SELECT-only for anon/authenticated.
- Verify service-role access remains backend-only and is not copied into frontend environment variables.
- Verify function EXECUTE privileges, SECURITY DEFINER ownership, empty search_path, and fully qualified object references.

## 3. Decisions that must be explicit before implementation

| Decision | Safe initial default | Reason |
|---|---|---|
| Guest CRM access for property staff | Owner/manager only | Guest table has no property relationship and contains PII/notes. |
| Calls visibility | Owner/manager only | Current call rows do not identify a property authoritatively. |
| Activity visibility | Property assignment only for events with verified property scope; organization-wide events owner/manager | Existing activity rows have no property_id. |
| Verification reservation fields | Narrow allow-listed projection, not unrestricted full-row exposure | Reservation rows may include guest, amount, and special-request data. |
| Operations room-type editing | Confirm business need; otherwise split inventory operations from room-type administration | Room types include capacity, amenities, nightly rates, and activation controls. |
| Property deactivation | Block new bookings/inventory; preserve history | Avoid breaking historical records and operational completion. |
| Room-type deactivation | Stop new room creation; preserve existing room links unless explicit archival workflow | Avoid dangling operational references. |

## 4. Required isolated test additions

Add these cases to the existing PR #14 authorization test plan. They are test specifications only, not executed tests.

| ID | Scenario | Expected result |
|---|---|---|
| ASSIGN-01 | Owner revokes active assignment | One immutable revoked history row remains; access ends immediately. |
| ASSIGN-02 | Owner attempts to clear revoked_at | Rejected. |
| ASSIGN-03 | Owner attempts to change an existing revoked_at timestamp | Rejected. |
| ASSIGN-04 | Owner regrants a previously revoked user | New active row is inserted; old row remains unchanged. |
| ASSIGN-05 | Operations/manager attempts assignment insert or revoke | Denied. |
| ASSIGN-06 | Assignment mutation fails while audit write fails | Entire transaction rolls back. |
| SCOPE-01 | Operations user reads unrelated guest rows | No rows visible. |
| SCOPE-02 | Verification user reads guest notes/contact details without an approved relation | No rows visible. |
| SCOPE-03 | Property staff reads organization-wide call records | No rows visible. |
| SCOPE-04 | Property staff reads activity event with matching property_id | Allowed only if assigned and event type is in scope. |
| SCOPE-05 | Property staff reads event for another property | Denied. |
| SCOPE-06 | Property staff reads organization-wide billing/configuration event | Denied. |
| LIFE-01 | Room type is deactivated while rooms reference it | Result matches the explicitly selected lifecycle rule. |
| LIFE-02 | Property is deactivated while rooms and reservations exist | Historical rows remain; new operational writes are blocked; allowed lifecycle transitions are explicit. |
| LIFE-03 | Concurrent room creation and room-type deactivation | No invalid state can be committed. |
| LIFE-04 | Concurrent reservation creation and property deactivation | Result matches the documented lifecycle invariant. |
| MODULE-01 | Operations/verification attempts to enable or disable a module | Denied at both RLS and SQL privilege layers. |
| MODULE-02 | Manager creates a property while module is disabled | Denied. |
| MODULE-03 | Property creation fails after creator assignment trigger begins | Entire property creation transaction rolls back. |
| PRIV-01 | Authenticated user attempts to change protected identity/scope columns | Denied by column grants and database guard. |
| PRIV-02 | Application role attempts DELETE/TRUNCATE/MAINTAIN/REFERENCES/TRIGGER | Denied. |

Existing tests for cross-tenant IDs, revoked membership, suspended membership, composite foreign keys, reservation overlap, and concurrent reservation writes remain mandatory.

## 5. Implementation order

1. Resolve the guest, calls, and activity scope decisions.
2. Finalize assignment immutability and transactional audit behavior.
3. Finalize property and room-type deactivation semantics.
4. Review module enablement/disablement and property creation invariants.
5. Update migrations and generated database types in a forward-only branch.
6. Replay the complete migration chain in an isolated disposable database.
7. Run authorization, privilege, lifecycle, and concurrency tests using multiple organizations and users.
8. Only after successful verification, consider the Staff Access UI and production rollout plan.

## 6. Safety and verification status

- This review used repository migration text and prior read-only schema findings.
- No Supabase SQL was executed in this step.
- No production DDL, grants, policies, data, or permissions were changed.
- No backend Worker code or frontend application code was changed.
- No migration replay or authorization test is claimed.
- Do not merge the stacked PRs or apply migrations to production based on this static review.
- The user has chosen the no-cost development route; do not create a paid hosted Supabase branch without a fresh, exact cost disclosure and explicit approval.
