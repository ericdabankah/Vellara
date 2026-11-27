# VELLARA Module Contract: Backend API & Business Services

Status: Draft — requires cross-owner and product approval
Version: 0.1.0
Date: 2026-11-27
Owner: Backend/AI Lead (Developer 2)
Reviewers: Frontend, Database/Security, Product Decision Owner

> This document records a proposed module contract for review. It is not an approval to implement or deploy APIs, and it does not claim that proposed endpoints or features exist. Resolve the contract mismatches identified below before implementation depends on them.

## 1. Purpose

Define the backend API and business-service boundary for VELLARA’s first authenticated Owner Desk milestone and establish integration rules for later operational and AI/channel capabilities.

The backend is responsible for trusted identity, tenant membership and authorization, business rules, orchestration, provider integrations, safe errors, auditability, and API compatibility.

## 2. Non-goals

This contract does not authorize:
- Frontend implementation or design-system changes.
- Database schema changes, migrations, RLS changes, or direct production SQL; these are owned by Database/Security.
- Reservations, inventory, payments, staff PINs, conversations, telephony, WhatsApp, receipts, QR/check-in, or AI production workflows beyond separately approved contracts.
- Provider selection, deployment, or production release without the required decisions and reviews.
- Treating draft endpoints or proposed response shapes as approved.

## 3. User journeys and business rules

### Initial Owner Desk scope
1. An authenticated user retrieves their own profile.
2. The user lists organizations for which they have active membership.
3. The user creates an organization through the approved atomic database RPC.
4. The user retrieves context for an organization they are authorized to access.
5. An authorized owner/manager updates the business profile.
6. The dashboard summary returns real persisted information and explicit empty states; it must not invent metrics or activity.

The last three journeys are proposed handoff scope and are not confirmed as implemented in the inspected API foundation.

### Authorization rules
- Verify the Supabase access token on the server.
- Derive the user ID from the verified identity.
- Resolve active organization membership and permissions server-side for every tenant-scoped request.
- Never trust caller-supplied user IDs, roles, owner flags, or tenant claims as authorization.
- Enforce tenant isolation in backend authorization and database RLS.
- Reject cross-tenant access and suspended users/memberships/organizations according to the approved policy.

## 4. Ownership and dependencies

- **Backend/AI:** Worker routing, authentication/session verification, tenant resolution, authorization, use cases, validation, response/error semantics, idempotency, audit, provider adapters, tests, API documentation, and deployment configuration.
- **Database/Security:** Schema, migrations, constraints, indexes, RLS, storage policies, and database-level authorization.
- **Frontend:** Owner Desk presentation and client-side interaction.
- **Shared:** API/event contracts, compatibility decisions, and production release require joint approval.

Dependencies include the approved Supabase identity/tenant foundation, the frontend integration contract, and the database RPC/schema contract. Coordinate database requests with Database/Security; do not make ad hoc schema changes.

## 5. Data contract

The inspected identity/tenant foundation contains these tables:
- `profiles`: user profile fields including display name, phone, avatar path, and timestamps.
- `organizations`: organization identity, name, status, creator, and timestamps.
- `organization_memberships`: organization/user relationship, role, status, inviter, and timestamps.
- `business_profiles`: organization business type, display/legal names, description, contact details, website, country, timezone, currency, address, and timestamps.

These are based on the reviewed migration and must be checked against the current database contract before use. Do not assume additional tables or fields. Database/Security owns schema definitions and changes.

Organization creation is intended to use the authenticated `create_organization` RPC, which atomically creates the organization, business profile, and owner membership. Backend must validate inputs and use the approved caller-authenticated path; it must not create memberships directly.

## 6. API contract

### Inspected API foundation (current branch proposal)
The inspected implementation documents:
- `GET /health` — unauthenticated health endpoint.
- `GET /v1/me` — authenticated user profile.
- `GET /v1/organizations` — authenticated user's organizations.
- `POST /v1/organizations` — organization creation via RPC.

The inspected contract uses base path `/v1`, direct JSON success objects, and errors shaped as `{ error: { code, message, request_id } }`. The request ID may accept a validated `x-request-id`.

### Proposed handoff scope
The handoff proposes a versioned prefix `/api/v1` and these additional endpoints:
- `GET /api/v1/me`
- `GET /api/v1/organizations`
- `POST /api/v1/organizations`
- `GET /api/v1/organizations/:organizationId/context`
- `PATCH /api/v1/organizations/:organizationId/business-profile`
- `GET /api/v1/dashboard/summary`

These are proposals, not verified implemented routes.

### Contract mismatch — approval required
The handoff proposes success `{ data: {}, meta: { request_id } }` and errors including `field_errors`, with server-generated request IDs. The API foundation instead documents direct success objects and a smaller error shape. The governance integration-contract draft proposes `{ success: true, data: {}, meta: { request_id } }` and a different error envelope/code vocabulary.

**Frontend, Backend, Database/Security, and Product must agree on the exact prefix, success/error envelopes, error codes, request-ID behavior, and route schemas before implementation or integration.** This document intentionally does not select or silently reconcile these alternatives.

General proposed conventions, pending approval:
- JSON request validation, bounded body sizes, explicit field and business-rule validation.
- UTC ISO-8601 timestamps; opaque identifiers.
- Consistent pagination where needed.
- Idempotency for retry-prone mutations.
- Return canonical server state after mutations.
- Safe messages only; no stack traces, secrets, or internal database details.

## 7. Event contract

No event transport, event names, or event schemas are approved by this contract. If events are introduced, define and approve their envelope, versioning, tenant context, delivery/retry behavior, idempotency, and sensitive-data rules before use. The governance draft's event envelope is a proposal only.

## 8. Security and privacy

- Use Supabase Auth access tokens as bearer credentials and verify them server-side.
- Use the caller's token for ordinary tenant-scoped database requests so RLS remains effective; never expose or use a service-role key for client-scoped operations.
- Resolve membership and role from trusted database state, not user-editable Auth metadata.
- Apply exact CORS allowlists; CORS is not authentication.
- Validate payload shape, size, enums, state transitions, and business rules.
- Keep secrets in approved Cloudflare secret bindings/configuration, not source control.
- Do not log tokens, credentials, PINs, payment data, or unnecessary customer content.
- AI/provider output is untrusted. Backend validates every tool call, tenant, permission, policy, price, availability, and state transition. AI must not directly write database state or claim unverified booking/payment outcomes.
- Treat phone numbers, transcripts, recordings, and customer messages as sensitive. Recording and retention require explicit product/legal decisions and access/deletion rules.

## 9. Failure and recovery

Use stable, approved error codes and appropriate HTTP statuses. Distinguish authentication, authorization, validation, not-found, conflict, rate-limit, provider, and internal failures only as agreed in the shared contract. Return safe messages and a request ID; do not expose raw provider/database errors.

Retry-prone commands and webhooks require idempotency. Provider timeouts and uncertain outcomes must not be reported as successful. Recovery behavior and state transitions must be specified per use case before implementation.

## 10. Observability and audit

Use request-scoped correlation/request IDs and structured logs. Record security-relevant and important business mutations with an approved audit approach. Logs must exclude secrets and unnecessary sensitive content. Define metrics, trace fields, retention, and alerting with the team before production use.

## 11. Tests

Required tests for the authenticated Owner Desk milestone include:
- Missing, malformed, expired, and invalid tokens.
- User with no organization and user with multiple memberships.
- Owner versus non-owner permissions.
- Cross-tenant reads and writes rejected.
- Suspended membership/organization behavior.
- Invalid payloads and unsupported business types.
- Organization creation atomicity and failure behavior.
- Idempotency and safe error/request-ID behavior.
- Database/RLS enforcement alongside backend authorization.

Tests must use disposable identities and organizations in the dedicated VELLARA project, never other projects. Do not claim tests have passed until actual results are recorded. The current contract review is not evidence of end-to-end test completion.

## 12. Acceptance criteria

The initial milestone is acceptable only when:
- The exact API contract and response envelope are approved and registered.
- Authentication and server-side tenant resolution are verified.
- Organization creation uses the approved atomic RPC.
- Cross-tenant access is rejected by backend and database controls.
- Required automated tests pass and results are documented.
- Errors, request IDs, logging, and configuration are reviewed.
- Empty dashboard states are real and no fake production metrics are shown.
- Frontend and Database/Security owners confirm integration compatibility.

## 13. Rollout and compatibility

Develop on a focused feature branch and use a pull request. Do not commit directly to `main`, merge, or deploy without required review and release approval. Shared contract changes must be reviewed before dependent implementation. Maintain compatibility or document an approved versioning/migration plan.

## 14. Approval record

| Area | Reviewer | Decision | Date |
|---|---|---|---|
| Frontend integration | Pending | Pending | Pending |
| Backend/API | Pending | Pending | Pending |
| Database/Security | Pending | Pending | Pending |
| Product decision owner | Pending | Pending | Pending |

Until approvals are recorded, this module contract remains a draft.
