# VELLARA Engineering Governance

Status: Proposed baseline for team approval  
Applies to: Every contributor, module, service, migration and deployment

This document is the shared engineering rulebook. It is intended to prevent incompatible module implementations, unsafe data access, undocumented contracts and integration regressions.

## 1. Non-negotiable rules

1. Inspect the existing implementation before creating, replacing or restructuring files.
2. Do not introduce a framework, runtime, library, database table, API endpoint, event name or deployment target without documenting the decision and its impact.
3. Every module must have one named owner, a written scope, dependencies, contract references and acceptance criteria.
4. A module may not invent or privately redefine shared API fields, database relationships, event names, status values or permission names.
5. Shared contracts are changed through a reviewed proposal before dependent modules are changed.
6. Never commit secrets, credentials, private keys, service-role keys, provider tokens or production customer data.
7. Never trust client-supplied business/tenant identifiers, prices, payment status, inventory availability, roles or permissions.
8. Backend services enforce authorization and business rules. Frontend checks are for experience only and are not security controls.
9. Database changes must be version-controlled migrations. Do not make undocumented manual production schema changes.
10. External provider webhooks must be authenticated, idempotent and safe against replay.
11. Important mutations must be auditable and safe to retry where appropriate.
12. Do not merge unfinished, unreviewed or knowingly failing work into the stable branch.

## 2. Module ownership

- Frontend lead: presentation, interaction, accessibility, client state, API client and realtime presentation.
- Backend/AI lead: API services, authentication verification, orchestration, channel adapters, business rules, integrations and event production.
- Database/security lead: schema, migrations, constraints, RLS, storage policies, indexes and database integrity.
- Cross-cutting changes require review from every affected owner.

Ownership does not grant permission to change another module's contract unilaterally.

## 3. Required module contract

Before implementation, each module must document:
- Purpose and non-goals.
- Owner and collaborating owners.
- User journeys and business rules.
- Data entities read or written.
- API operations and exact request/response schemas.
- Events consumed and emitted.
- Authentication, tenant scope and permissions.
- Failure modes, retries and idempotency.
- Loading, empty, error and recovery behaviour.
- Observability and audit requirements.
- Tests and acceptance criteria.
- Dependencies and rollout/migration plan.

Use `docs/contracts/MODULE_CONTRACT_TEMPLATE.md`.

## 4. API and event compatibility

- API paths, HTTP methods, payloads, response envelopes and error codes must be documented before use.
- Use additive, backward-compatible changes where possible.
- Breaking changes require a versioning/migration plan and coordinated frontend/backend release.
- Timestamps use ISO 8601 UTC.
- Identifiers are opaque strings; clients must not infer meaning from their format.
- Money must include currency and use integer minor units or an explicitly agreed decimal representation. Never use floating-point arithmetic for authoritative money calculations.
- Event consumers must tolerate duplicate and delayed delivery.
- Events require a unique event ID, event type, occurrence timestamp, schema version, tenant scope and entity reference.
- Never put secrets, payment credentials or unnecessary personal data in events or logs.

The exact shared response envelope, event schema and naming conventions must be approved in the contract register before production endpoints are built. Examples in planning documents are not live contracts until approved.

## 5. Data and tenant security

- Every business-owned record must have an enforceable tenant relationship.
- Enforce tenant isolation in backend authorization and database RLS; never rely on UI filtering.
- Use least-privilege permissions.
- Service-role credentials stay server-side.
- PINs and passwords must be securely hashed; never store plaintext credentials.
- Sensitive operations require explicit permission and audit records.
- Avoid broad personal-data replication across services.
- Define retention and deletion behaviour for customer data.
- Test cross-tenant access denial, including nested records and storage objects.

## 6. Transaction integrity

- Inventory allocation and temporary holds must be atomic and concurrency-safe.
- A cart is not an inventory reservation.
- Payment success is determined by verified provider/server evidence, never by a browser redirect.
- Reservation confirmation must depend on authoritative payment and valid inventory state.
- Use idempotency keys for retryable create/payment/confirmation operations.
- Duplicate or late webhooks must not create duplicate financial or booking effects.
- Refunds, overrides and exceptional policy actions require explicit authorization.

## 7. Frontend quality and motion

- Use the approved VELLARA design tokens; do not invent competing brand palettes.
- Shared components must provide hover, focus, active, disabled, loading and error states as applicable.
- Hover must never be the only way to access an action.
- Respect reduced-motion preferences.
- Animations must not obscure important information or imply a transaction succeeded before backend confirmation.
- Call UI state must be driven by authoritative call events and support concurrent calls and reconnection recovery.
- Provide responsive layouts and accessible labels/statuses.

## 8. Git workflow

- Work on focused feature branches; do not commit directly to `main`.
- Keep pull requests small enough to review.
- Do not combine unrelated modules in one pull request.
- Include tests, screenshots or API examples where relevant.
- Resolve review comments and confirm affected owners before merge.
- Never force-push shared branches without coordination.
- Keep generated files and lockfiles consistent with the existing project tooling.

## 9. Definition of done

A module is complete only when:
- Its contract is approved and current.
- Acceptance criteria are met.
- Relevant automated tests pass.
- Authorization and tenant isolation are tested where applicable.
- Failure, retry and recovery paths are covered.
- No secrets or sensitive test data are committed.
- Documentation and migrations are included.
- Dependent module owners have reviewed integration impact.

## 10. Governance limitation

This document and pull-request templates establish the required team process. They do not, by themselves, technically enforce GitHub branch protection or required status checks. Repository administrators must enable branch protection/rulesets and required CI checks after the team and CI stack are confirmed.
