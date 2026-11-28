# VELLARA Property Authorization Audit

**Status:** Draft review artifact. Static policy review plus read-only inspection of the connected Supabase project. Not a security certification and not a substitute for isolated database tests.

## 1. Scope and current deployment state

This review covers the proposed property-management migration and the inventory privilege-hardening migration in the dependent draft PR stack.

The live Supabase catalog was inspected read-only on 2026-11-27. At that time, the inspected property-domain objects `properties`, `room_types`, `property_staff_assignments`, and `organization_modules`, plus `private.has_property_role`, were absent. The live database still had the legacy organization-level policies on `rooms` and `reservations`. Therefore, the property authorization model below describes the proposed migration state, not active production behavior.

A broader live privilege scan found `anon` and `authenticated` have `DELETE`, `REFERENCES`, `TRIGGER`, and `TRUNCATE` grants across 13 public tables: activity events, calls, guests, phone-number records, organization subscriptions, channel records, receptionist instances/routes, reservations, rooms, and the three subscription catalogue tables. `has_table_privilege` also confirmed both roles have `MAINTAIN` and `TRUNCATE` on all 13 inspected tables. RLS does not protect `TRUNCATE` or `MAINTAIN`. The forward migration `20261127150000_restrict_inventory_table_privileges.sql` now removes anonymous/public access from tenant-owned tables, removes unnecessary authenticated write/administrative privileges, includes the new property-domain tables, and preserves SELECT-only public access to the subscription catalogue. It has not been applied.

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
- Tenant-owned operational tables: no privileges for `anon` or `PUBLIC`.
- Read-only tenant tables: `authenticated` retains SELECT only.
- Property-domain tables: `authenticated` retains SELECT/INSERT subject to RLS and only the approved column-level UPDATE grants. Migration `20261128100000_restrict_property_table_update_privileges.sql` revokes inherited table-level UPDATE on `organization_modules`, `properties`, `property_staff_assignments`, and `room_types` before restoring the column allowlists.
- Guests, rooms, and reservations: `authenticated` retains the existing SELECT/INSERT and explicitly granted UPDATE capabilities, subject to RLS; no DELETE, TRUNCATE, REFERENCES, or TRIGGER.
- Subscription catalogue tables: `anon` and `authenticated` retain SELECT only; no INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER.
- `service_role`: existing service-role access remains unchanged.
- No global default-privilege change is proposed; the migration is scoped to the inspected tables.

Verify effective privileges with `has_table_privilege` and `has_column_privilege` in the isolated database, not only by reading migration text or `information_schema`. The property UPDATE follow-up is required because a table-level UPDATE grant overrides the intended column allowlist.

### Default-privilege root cause

Read-only inspection of `pg_default_acl` found broad default table privileges for both `postgres` and `supabase_admin` in the `public` schema. Those defaults grant `anon` and `authenticated` table privileges including DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, and UPDATE on newly created tables. All 13 inspected tables are owned by `postgres`, so their repeated grant pattern is consistent with inheritance from the `postgres` default ACL. The exact historical reason those defaults were configured this way is not established.

The current remediation is intentionally table-scoped. A global default-privilege change could silently break public catalogue reads or authenticated access for future tables unless every migration is audited and explicit grants are added. Do not change global defaults as part of this PR. Before any new public table is added, its intended role grants must be explicit and checked against the inherited defaults. A separate default-privilege remediation should follow a complete migration inventory.

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
| GRANT-01 | Anonymous role accesses tenant-owned operational tables | Denied |
| GRANT-02 | Authenticated role attempts DELETE/TRUNCATE/MAINTAIN/REFERENCES/TRIGGER on tenant-owned tables | Denied |
| GRANT-03 | Authenticated role writes to read-only tenant tables | Denied at SQL privilege layer |
| GRANT-04 | Anonymous/authenticated role reads subscription catalogue | Allowed; SELECT only |
| GRANT-05 | Authenticated role performs permitted guest/room/reservation SELECT/INSERT and explicitly granted UPDATE columns | Allowed subject to RLS |
| GRANT-06 | Service role retains required backend access | Allowed as designed |
| GRANT-07 | Authenticated attempts table-level UPDATE on property-domain tables or updates a non-allowlisted column | Denied; approved columns remain updateable subject to RLS |
| FN-01 | Unauthenticated caller invokes `has_property_role` | Execute denied |
| FN-02 | Authenticated caller invokes helper with arbitrary organization/property IDs | Returns true only for owner bypass or a valid active assignment and allowed role |
| FN-03 | Trigger functions execute with empty search path and fully qualified object references | Verified by catalog inspection |

Also test concurrent reservation inserts and existing overlap constraints. Do not infer concurrency safety from the property RLS tests.

## 5. Decisions to confirm before release

1. **Verification scope:** the proposed policy permits verification users to read full reservation rows, which may include guest identifiers, dates, amounts, and special requests. Confirm whether that role needs all those fields or should use a narrower view/RPC.
2. **Operations scope:** operations users can create and update room types, including capacity, amenities, rates, activation, and archival state. Confirm that catalogue administration belongs to this role.
3. **Owner bypass:** confirm that every active organization owner should have access to every property, regardless of assignment.
4. **Assignment management:** managers can read assignment records for properties assigned to them but cannot invite, assign, or revoke staff. Confirm this is intentional.

## 6. Read-only prerequisite checks (2026-11-28)

The connected Supabase project was queried read-only while reviewing the proposed migration stack:

- Migration history contains 11 applied migrations; none of the proposed property migrations is recorded as applied.
- The prerequisite objects exist: `public.rooms`, `public.reservations`, `public.business_profiles`, `public.organization_memberships`, `private.touch_updated_at()`, `private.has_organization_role(uuid,text[])`, and `private.is_organization_member(uuid)`.
- `organization_memberships` has the required unique constraint on `(organization_id, user_id)`, so the proposed composite foreign key from property staff assignments has a valid referenced key.
- Authenticated users can read organization memberships under the existing self-or-admin policy; this supports the owner-only staff-assignment insert check without granting membership writes.
- The legacy `rooms` and `reservations` tables each currently contain zero rows. This reduces the amount of legacy data to backfill, but does not prove that the migration is safe for populated customer databases.
- The property tables remain absent from the connected database. No schema changes or data writes were performed.

These checks establish prerequisites only. They do not execute the proposed DDL, prove migration replay, or test behavior under authenticated JWT claims.

## 7. Release blockers and constraints

- Do not apply migrations to production until an isolated replay succeeds and all required authorization tests pass.
- The corrected legacy backfill from PR #11 has now been copied into the PR #12 and PR #14 branch heads so the dependent property-creation and inventory stack no longer carries the older mapping logic. The temporary legacy-property map is explicitly dropped after its final use rather than relying on `ON COMMIT DROP`, avoiding dependence on whether the migration runner wraps the whole file in one transaction. It still requires isolated replay, including reuse of existing room types and temporary-table transaction behavior.
- The source PR #11 remains open as the original correction review. Do not merge duplicate copies independently; review the migration as it appears in the PR #12/PR #14 stack.
- Verify migration order and dependency branches before merging the stacked PRs.
- Keep production read-only until explicit approval.
- Do not put service-role credentials in the browser.
- RLS, SQL grants, composite foreign keys, trigger behavior, and application-level workspace/property selection must each be tested independently.
