# VELLARA Property Authorization Audit

**Status:** Draft review artifact. Static policy review plus read-only inspection of the connected Supabase project. Not a security certification and not a substitute for isolated database tests.

## 1. Scope and current deployment state

This review covers the proposed property-management migration and the inventory privilege-hardening migration in the dependent draft PR stack.

The live Supabase catalog was inspected read-only on 2026-11-27. At that time, the inspected property-domain objects `properties`, `room_types`, `property_staff_assignments`, and `organization_modules`, plus `private.has_property_role`, were absent. The live database still had the legacy organization-level policies on `rooms` and `reservations`. Therefore, the property authorization model below describes the proposed migration state, not active production behavior.

A separate live privilege issue was observed: both `anon` and `authenticated` had `TRUNCATE` on `rooms` and `reservations`. RLS does not protect `TRUNCATE`. The forward migration `20261127150000_restrict_inventory_table_privileges.sql` proposes to remove anonymous/public access and remove `DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER` from authenticated users. It has not been applied.

## 2. Proposed authorization model

The helper `private.has_property_role(org_id, property_id, roles)` requires an active organization membership. Organization owners bypass property assignments. Other roles must be included in the policy's allowed-role list and have a non-revoked assignment for that exact organization/property/user tuple.

| Role | Properties | Staff assignments | Room types | Rooms | Reservations |
|---|---|---|---|---|---|
| Owner | Read all; create; update | Read; assign active organization members; revoke/reactivate assignments | Read/create/update | Read/create/update | Read/create/update |
| Manager | Create when the module is enabled; read/update properties assigned to them | Read assignments for assigned properties; cannot assign or revoke | Read/create/update on assigned properties | Read/create/update on assigned properties | Read/create/update on assigned properties |
| Operations | Read assigned properties | No access | Read/create/update on assigned properties | Read/create/update on assigned properties | Read/create/update on assigned properties |
| Verification | Read assigned properties | No access | No access | No access | Read assigned reservations only |
| Other / unassigned member | No property-scoped access | No access | No access | No access | No access |

Notes:
- The owner bypass is organization-wide by design in the proposed helper. Confirm that this is the intended governance model.
- A manager-created property automatically receives an assignment for its creator through the property-creation trigger. The trigger rejects a mismatched authenticated creator.
- Only an organization owner can insert assignment rows or change `revoked_at`. Assignment history is retained; there is no delete policy.
- Property identity fields (`id`, `organization_id`, `created_by`, and `vertical`) are protected from update by a trigger and are not included in the authenticated update-column grant.
- Room/reservation UI filters are usability controls only. RLS, composite foreign keys, and database triggers remain authoritative.

## 3. SQL grants are separate from RLS

RLS does not replace SQL privileges. The proposed inventory privilege hardening keeps authenticated access needed by the Owner Desk but removes dangerous operations that RLS cannot constrain.

Expected privilege posture after the complete migration stack is replayed:
- `anon` and `PUBLIC`: no privileges on `rooms` or `reservations`.
- `authenticated`: SELECT and INSERT, plus only the explicitly granted UPDATE columns.
- `authenticated`: no DELETE, TRUNCATE, REFERENCES, or TRIGGER.
- `service_role`: existing service-role access remains unchanged.
- No broad default-privilege change is proposed by this table-specific migration.

Verify effective privileges with `has_table_privilege` in the isolated database, not only by reading migration text or `information_schema`.

## 4. Required isolated-database authorization tests

These tests must be run after replaying the complete migration chain, including the corrected legacy backfill. Use two organizations and multiple users. Do not seed or experiment in production.

| ID | Scenario | Expected result |
|---|---|---|
| AUTH-01 | Owner reads properties in own organization | All own-organization properties visible |
| AUTH-02 | Owner reads or writes inventory on any own property without an assignment row | Allowed |
| AUTH-03 | Manager reads assigned property | Allowed |
| AUTH-04 | Manager reads a property in same organization without an active assignment | No row visible |
| AUTH-05 | Manager creates property while matching module is enabled | Allowed; creator assignment created atomically |
| AUTH-06 | Manager creates property while matching module is disabled | Denied |
| AUTH-07 | Manager attempts to insert or revoke a staff assignment | Denied |
| AUTH-08 | Owner assigns an active organization member | Allowed |
| AUTH-09 | Owner attempts to assign a non-member or inactive organization member | Denied |
| AUTH-10 | Owner revokes an assignment | Allowed; assignment history retained |
| AUTH-11 | Previously assigned manager/operations/verification user accesses after revocation | Denied for all property-scoped rows |
| AUTH-12 | Operations reads/writes assigned room types, rooms, and reservations | Allowed |
| AUTH-13 | Operations accesses unassigned property inventory | Denied |
| AUTH-14 | Verification reads assigned reservations | Allowed |
| AUTH-15 | Verification inserts or updates reservations | Denied |
| AUTH-16 | Verification reads rooms or room types | Denied |
| AUTH-17 | Other organization member without assignment accesses property inventory | Denied |
| AUTH-18 | User from organization A requests organization B property/inventory IDs | Denied; no cross-tenant rows or writes |
| INV-01 | Insert room type/room/reservation against inactive or non-hospitality property | Rejected by database trigger |
| INV-02 | Insert room with inactive or archived room type | Rejected |
| INV-03 | Insert room whose room type belongs to another property | Rejected by trigger/composite FK |
| INV-04 | Insert reservation whose room belongs to another property | Rejected by composite FK |
| INV-05 | Insert unassigned enquiry with a valid property | Allowed if all other reservation constraints pass |
| INV-06 | Insert unassigned enquiry without property | Rejected by NOT NULL/FK |
| GRANT-01 | Anonymous role selects/inserts/updates/deletes/truncates rooms or reservations | Denied |
| GRANT-02 | Authenticated role attempts DELETE/TRUNCATE/REFERENCES/TRIGGER on rooms or reservations | Denied |
| GRANT-03 | Authenticated role performs permitted SELECT/INSERT and explicitly granted UPDATE columns | Allowed subject to RLS |
| GRANT-04 | Service role retains required backend access | Allowed as designed |
| FN-01 | Unauthenticated caller invokes `has_property_role` | Execute denied |
| FN-02 | Authenticated caller invokes helper with arbitrary organization/property IDs | Returns true only for owner bypass or a valid active assignment and allowed role |
| FN-03 | Trigger functions execute with empty search path and fully qualified object references | Verified by catalog inspection |

Also test concurrent reservation inserts and existing overlap constraints. Do not infer concurrency safety from the property RLS tests.

## 5. Decisions to confirm before release

1. **Verification scope:** the proposed policy permits verification users to read full reservation rows, which may include guest identifiers, dates, amounts, and special requests. Confirm whether that role needs all those fields or should use a narrower view/RPC.
2. **Operations scope:** operations users can create and update room types, including capacity, amenities, rates, activation, and archival state. Confirm that catalogue administration belongs to this role.
3. **Owner bypass:** confirm that every active organization owner should have access to every property, regardless of assignment.
4. **Assignment management:** managers can read assignment records for properties assigned to them but cannot invite, assign, or revoke staff. Confirm this is intentional.

## 6. Release blockers and constraints

- Do not apply migrations to production until an isolated replay succeeds and all required authorization tests pass.
- Ensure the corrected legacy backfill from PR #11 is included in the migration chain before replay. It must fail safely when historical records cannot be mapped uniquely; do not guess a property.
- Verify migration order and dependency branches before merging the stacked PRs.
- Keep production read-only until explicit approval.
- Do not put service-role credentials in the browser.
- RLS, SQL grants, composite foreign keys, trigger behavior, and application-level workspace/property selection must each be tested independently.
