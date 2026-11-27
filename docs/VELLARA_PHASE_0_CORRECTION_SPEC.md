# VELLARA Phase 0 Correction Specification

**Status:** Engineering correction specification; not an implementation approval  
**Scope:** PR #6 → PR #7 → PR #8, with emphasis on the property foundation  
**Production safety:** Production Supabase remains read-only. No migration in this document is approved for production execution.  
**Validation mode:** Static repository review and read-only production metadata inspection only. Isolated database replay, RLS execution tests, and migration integration remain unverified.

## 1. Purpose and release rule

This document converts the Phase 0 audit findings into a traceable correction plan. It is the working acceptance contract for correcting the current Owner Desk and property-management foundation.

A successful TypeScript build is necessary but not sufficient. A change is not database-verified until the full migration history and proposed migration have been replayed and tested in an isolated PostgreSQL/Supabase-compatible environment.

Do not:
- edit any migration already applied to production;
- execute proposed DDL, seed records, or test writes against production;
- expose a Supabase service-role or secret key in browser code;
- infer property assignment, tenant ownership, room type, or currency from ambiguous legacy data;
- merge or deploy without explicit owner approval.

## 2. Current PR stack

| PR | Branch | Current purpose | Required action |
|---|---|---|---|
| #6 | `feat/owner-desk-frontend-foundation` | Owner Desk and tenant foundation | Retain; complete auth/workspace and reliability review |
| #7 | `feat/property-management-foundation` | Properties, room types, staff assignments, migration | Keep draft; correct migration and domain integration |
| #8 | `feat/property-details-room-types` | Property details and room-type UI | Keep draft; restore property creation and integrate operational flows |

Dependency order remains #6 → #7 → #8. Do not merge these PRs to make the dashboard appear complete.

## 3. Verified findings and required corrections

### P0.1 — Make legacy property backfill deterministic

**Affected file:** `supabase/migrations/20261126120000_property_management_foundation.sql`

The current draft creates a `legacy-property` only when an organization has no hospitality property. Later backfill statements locate rooms and reservations only by the `legacy-property` slug.

This is unsafe for organizations that already have one or more hospitality properties and also have legacy rooms or reservations. Those rows can remain unassigned and then fail when `property_id` or `room_type_id` is made NOT NULL.

The slug is also not a reliable identity key:
- an existing property may already use `legacy-property`;
- the slug may belong to a different vertical;
- `ON CONFLICT DO NOTHING` can skip insertion while later statements still select by slug;
- blank or whitespace-only legacy room types are excluded from room-type creation, leaving no `room_type_id`.

**Required correction**
1. Build an explicit migration mapping per organization and legacy row set.
2. If exactly one existing hospitality property is a safe and unambiguous target, document and use that mapping.
3. If multiple properties could be the target, stop with a clear preflight exception and require an explicit mapping. Never guess.
4. Use generated property IDs or a dedicated mapping table/CTE for the backfill. Do not use a mutable human-readable slug as the join key.
5. Handle null/blank legacy room-type values without inventing a category. Either preserve a deliberately approved legacy placeholder type or stop for explicit remediation; document the chosen rule.
6. Backfill reservations with no room assignment to a deterministic property only when an unambiguous mapping exists. Enquiries/unassigned reservations must remain supported.
7. Add preflight assertions before every NOT NULL change. Report unresolved counts and abort before constraints are tightened.
8. Preserve existing room/reservation rows and all existing overlap/capacity protections.

**Acceptance**
- Migration replay passes with zero legacy rows.
- Replay passes with legacy rooms and reservations and no existing property.
- Replay passes with one existing hospitality property.
- Replay safely aborts with multiple possible hospitality properties.
- Replay safely aborts or follows the explicitly documented rule for blank room types.
- Slug collision with an existing property, including a different vertical, cannot misassign inventory.
- No room or reservation receives an invented property association.

### P0.2 — Make property onboarding atomic

**Affected files:** property creation flow in `frontend/src/App.tsx`, property-management migration/RPC layer, and property portfolio UI.

The current PR #8 already exposes an Add Property action in the Owner Desk page heading and includes a property-creation modal in `frontend/src/App.tsx`. The empty portfolio therefore has a creation path; the earlier statement that no Add Property action exists was incorrect. The actual functional defect is that creation enables the organization module and inserts the property as separate writes. A failure between them can leave an enabled module with no property. The empty-state panel may also benefit from its own contextual CTA, but that is a usability enhancement rather than a missing core flow.

**Required correction**
1. Preserve the existing Add Property action, ensure it is permission-aware, and optionally add a contextual CTA inside the empty state.
2. Implement one transaction-backed database operation that validates the caller and organization role, enables the selected module, creates the property, and ensures the creator's property assignment where applicable.
3. Return the created property row from the operation.
4. Enforce allowed vertical/module combinations server-side.
5. Normalize currency codes before persistence and validate timezone identifiers against supported IANA timezones.
6. Do not claim success until the transaction succeeds; surface actionable errors.
7. Make retries safe against duplicate module/property creation.

**Acceptance**
- Property creation either commits every required change or commits none.
- A failed property insert cannot leave a newly enabled module behind.
- Repeated submission cannot create accidental duplicate properties.
- A manager/owner without required authorization is rejected server-side.
- The existing Add Property action remains available when the caller is authorized; an empty-state CTA is optional UX polish.
- Creator assignment is correct for owners and non-owner creators.

### P0.3 — Integrate Rooms and Reservations with property scope

**Affected files:** existing Rooms and Reservations screens/forms, `frontend/src/components/PropertyWorkspace.tsx`, migration constraints and RLS policies.

The migration makes `rooms.property_id`, `rooms.room_type_id`, and `reservations.property_id` mandatory. Existing operational forms still follow the old organization-level model and do not consistently provide these fields.

**Required correction**
1. Make property selection explicit before viewing or creating rooms.
2. Filter room lists and room-type choices by the selected property.
3. Create rooms with organization, property, and room type from the selected property.
4. Use the property's effective currency for new room rates, not a stale organization-only default.
5. Require an explicit property for unassigned enquiries/walk-ins; do not infer it from an absent room.
6. When a reservation has a room, derive or validate its property from that room in database-side logic.
7. Ensure a reservation's property and room always match.
8. Keep unassigned enquiries possible while still associating them with a property.
9. Preserve current reservation conflict protection, date checks, capacity checks, and tenant-aware foreign keys.
10. Show selected property scope in room/reservation headings, filters, counts, and empty states.

**Acceptance**
- Room creation succeeds only with a room type belonging to the selected property.
- A room type from another property or organization is rejected by the database.
- Reservation creation works for both assigned rooms and explicitly property-scoped enquiries.
- A reservation cannot reference a room from a different property.
- Existing reservation overlap and room capacity protections remain active.
- Switching property refreshes all dependent data and clears stale selected room/type/reservation state.

### P0.4 — Preserve property-level staff authorization

**Affected file:** property migration and all related RLS policies.

**Correction to the audit note:** the current migration draft does contain a property-scope helper, `private.has_property_role`, and uses it in the property, room-type, room, reservation, and staff-assignment policies. The design is not purely organization-role based. That implementation is a good starting point, but it still needs explicit role and property-scope verification before approval.

**Required correction and verification**
1. Keep owner access across all properties within the organization.
2. Require an active property assignment for manager, operations, and verification users wherever the approved permission matrix grants access.
3. Confirm that a user with no property assignment cannot read or mutate property-scoped data.
4. Confirm that revoking an assignment immediately removes access.
5. Confirm staff assignments cannot be granted across organizations or to inactive/non-member users.
6. Define whether managers may create properties and whether creator assignment grants the intended scope.
7. Ensure verification role is read-only and limited to the approved transaction/verification surface; it must not gain general room-type or pricing administration by implication.
8. Test every RLS policy under actual authenticated JWT claims, not only by inspecting SQL predicates.

**Acceptance matrix**

| Actor | Property read | Room/guest/reservation operations | Property configuration | Cross-property |
|---|---|---|---|---|
| Owner | All organization properties | According to owner permissions | Yes | Yes, within own organization |
| Assigned manager | Assigned properties | Per approved manager matrix | Per approved manager matrix | No by default |
| Assigned operations | Assigned properties | Operational actions only | No pricing/configuration by default | No |
| Verification | Only approved verification surface | Read/verify only | No | No |
| Unassigned staff | No property data | None | None | No |
| Other organization user | None | None | None | None |

The exact manager/verification permissions must be aligned with the product role matrix before policy approval.

### P0.5 — Close anonymous/default privilege gaps on new objects

**Affected file:** property migration and database security documentation.

Read-only inspection of the live database found anonymous table grants on multiple tenant tables, but the inspected tenant tables have RLS enabled and no anonymous policies. The subscription catalogue has intentional anonymous SELECT policies. This is not evidence of a confirmed anonymous data leak.

The live database also has broad default privileges for future public tables, functions, and sequences under the `postgres` and `supabase_admin` owners. The property migration grants authenticated access to new public tables but does not explicitly revoke inherited anonymous privileges.

**Required correction**
1. Add explicit `REVOKE ALL ... FROM anon` statements for each new tenant-owned public table and any new callable function/sequence where anonymous access is not required.
2. Grant only the required authenticated table and column privileges.
3. Keep intentional public catalogue SELECT access intact.
4. Review default privileges separately for each object owner and object type. Do not apply a blanket revoke without confirming ownership and intended Supabase behaviour.
5. Review function EXECUTE privileges separately from table grants.
6. Keep RLS enabled and ensure every policy's role list and predicate match the role matrix.
7. Document that RLS and SQL grants are separate controls.

**Acceptance**
- Anonymous role has no table privileges on new tenant-owned property tables.
- Anonymous role cannot execute property mutation or privileged helper functions.
- Authenticated roles receive only the operations needed by the frontend.
- Public catalogue reads continue to work.
- Security tests verify both grants and RLS outcomes.

### P1.1 — Fix currency and rate semantics

**Affected files:** property migration, room-type form, room form, pricing display.

The room-type table stores `default_nightly_rate_minor` without a currency column. The UI displays it using the property's current effective currency and assumes two decimal places. Changing a property's currency can therefore relabel an existing amount without converting it. The room creation flow also needs to use the selected property's effective currency rather than only the organization profile currency.

**Required correction**
1. Every persisted monetary amount must have an unambiguous currency association.
2. Store currency with the rate or enforce a documented immutable pricing-currency rule.
3. Use currency-aware minor-unit precision. Do not assume every currency uses two decimal places.
4. Currency changes must not silently reinterpret existing room or room-type prices.
5. If conversion is supported, require an explicit exchange-rate source, conversion timestamp, rounding rule, and audit record. Otherwise block currency changes while affected prices exist or require explicit repricing.
6. Normalize currency codes to uppercase and validate against the supported currency set.

**Acceptance**
- A stored rate always renders in the currency in which it was recorded.
- Changing property currency cannot silently change the meaning of existing prices.
- New room rates use the selected property's effective currency.
- Zero-, two-, and three-decimal currency behaviour is covered by tests if those currencies are supported.

### P1.2 — Enforce property and room-type lifecycle rules in the database

The current `private.enforce_hospitality_property` trigger checks vertical but does not reject inactive or archived properties. Room-type foreign keys prove existence but do not prove the type is active.

**Required correction**
- Reject new rooms, room types, and reservations against inactive/archived properties.
- Reject new room assignments to archived room types.
- Preserve historical room/reservation references.
- Define explicit authorized reactivation.
- Prevent hard deletion where history exists.

**Acceptance**
- Direct API/database writes cannot bypass lifecycle restrictions.
- Existing historical records remain readable.
- Reactivation is auditable and role-checked.

### P1.3 — Validate structured room-type data

Current database validation checks that `bed_configuration` is a JSON object, but that alone does not validate keys, numeric values, or sensible counts.

**Required correction**
- Define an extensible bed-configuration shape without imposing a fixed room-type catalogue.
- Validate allowed key format, integer counts, non-negative values, and maximum totals.
- Validate amenities as bounded, trimmed, non-empty strings with duplicate handling.
- Validate default capacity and rate at the database boundary.
- Keep the UI validation aligned with the database rules.

### P1.4 — Implement explicit workspace selection

**Affected file:** `frontend/src/auth/AuthGate.tsx`.

The current loader selects `organizations[0]` from an unordered query result. It does not provide a workspace selector when a user belongs to multiple organizations.

**Required correction**
1. Load all active memberships and corresponding active organizations.
2. If exactly one workspace exists, select it.
3. If multiple exist, require an explicit user choice or apply a documented persisted preference with a visible switcher.
4. Never silently rely on database row order.
5. On workspace change, clear stale property/room/reservation state and reload all scoped data.
6. Handle auth/session races, loading failures, and stale asynchronous responses without showing another workspace's previous data.

**Acceptance**
- A multi-organization user can identify and switch workspaces.
- Workspace selection is deterministic and visible.
- No data from the previously selected workspace remains visible after switching.
- Failed refreshes show an unavailable/error state rather than misleading empty or stale metrics.

### P1.5 — Improve data loading and error recovery

- Wrap async operations in `try/catch/finally` so loading states always settle.
- Distinguish empty data from unavailable data.
- Do not display stale metrics as current after a failed refresh.
- Provide retry actions for failed loads.
- Disable duplicate submissions while a write is in progress.
- Add request cancellation or stale-response guards when selection changes during a request.
- Keep success messages tied to confirmed database results.

## 4. Test plan

### Migration replay and data-shape fixtures
- Empty database after replay of all recovered migrations.
- Existing rooms and reservations with no properties.
- Existing single hospitality property.
- Multiple hospitality properties.
- Existing real-estate property with a conflicting legacy slug.
- Blank/whitespace room type.
- Reservation without a room.
- Reservation with a room and valid historical dates.
- Duplicate room numbers across two properties.
- Existing overlapping reservation cases.

### RLS and grants
- Anonymous role cannot read or mutate tenant-owned property data.
- Authenticated owner can access all properties in their organization.
- Assigned manager/operations access is limited to assigned properties.
- Unassigned staff cannot access property-scoped records.
- Revoked assignment loses access.
- Cross-tenant and cross-property references are rejected.
- Verification role receives only approved read/verification access.
- Public subscription catalogue remains readable as intended.
- Function EXECUTE and sequence grants are least-privilege.

### Frontend/component tests
- Add Property success, validation, duplicate submission, and transaction failure.
- Multi-workspace selector and switch.
- Property switch resets dependent selections.
- Add/edit/archive room type.
- Add/edit room with property-scoped room types.
- Assigned and unassigned reservation creation.
- Empty, loading, unavailable, retry, and stale-response states.
- Currency changes and formatting.
- Keyboard navigation, focus handling, responsive layout, and reduced motion.

### Integration tests
- Authenticated browser session → workspace selection → property creation.
- Property → room type → room → reservation.
- Two tenants with overlapping IDs/labels remain isolated.
- Concurrent reservation attempts preserve existing overlap guarantees.

## 5. Validation labels required in PR descriptions

Use these exact labels:
- **Implemented:** code or migration file exists.
- **Static-checked:** TypeScript/build/lint or SQL review completed without executing against a database.
- **Frontend-tested:** interaction verified using real frontend code; fixtures/mocks clearly identified.
- **Database-unverified:** migration, RLS, grants, triggers, constraints, or transaction behaviour has not been run in isolation.
- **Integration-unverified:** external provider or Worker round trip has not been tested end to end.

## 6. Phase 0 exit gate

Phase 0 is not complete until all of the following are true:

- [ ] Frontend architecture, auth, navigation, data access, and loading/error behaviour are understood.
- [ ] Recovered migration history is replayed in a clean isolated database.
- [ ] Property migration is corrected and replayed against representative legacy fixtures.
- [ ] RLS and SQL grants are tested under anon/authenticated roles.
- [ ] Tenant and property isolation tests pass.
- [ ] Room/reservation constraints and concurrency protections are verified.
- [ ] Workspace selection is deterministic and tested.
- [ ] All unresolved security and schema gaps have a tested remediation plan.
- [ ] PRs remain unmerged until review and explicit approval.
- [ ] No production migration or deployment occurs without explicit approval.

## 7. Execution sequence

1. Correct the migration design and preflight/backfill logic.
2. Define the atomic property-creation operation and verify the existing Add Property UI and permission gating.
3. Align room and reservation forms, queries, and writes with property scope.
4. Verify property-level role policies and add explicit least-privilege grants.
5. Resolve currency association and lifecycle constraints.
6. Implement multi-workspace selection and stale-data/error handling.
7. Add automated frontend tests and static SQL checks.
8. When an isolated database becomes available, replay all recovered migrations and run migration/RLS/integration tests.
9. Reassess the Phase 0 exit gate before advancing to Phase 1.

## 8. Open decisions that must not be guessed

- Whether managers may create properties, and whether creation automatically grants assignment to that manager.
- Exact manager and verification permissions by operation.
- Supported currency set and whether currency conversion is in scope.
- Approved legacy handling for blank room types and ambiguous legacy property ownership.
- Whether property-level room-type rates need currency stored per rate or an immutable property pricing currency.
- How property deactivation interacts with future reservations and operational dashboards.

Until these decisions are resolved and isolated validation is possible, the migration remains a draft and production remains read-only.
