# VELLARA Backend Developer Handover

**Audience:** Developer 2 (Backend / API / AI integrations)  
**Purpose:** Give the backend developer and their coding model an implementation contract that matches the frontend's needs and the database developer's responsibilities.  
**Status:** Handover specification, not a claim that these APIs or features already exist.

## 1. Project context and current state

VELLARA is a multi-tenant business front-office and operations platform. The first business types are hotels and real estate, with an architecture that can later support other businesses.

The product is intended to connect telephone, WhatsApp, a generated mini-website, and staff-assisted / walk-in operations to one shared business system. The frontend is being developed separately. Your job is to provide stable, secure backend capabilities that the frontend can call.

GitHub repository: `ericdabankah/Vellara`  
Default branch: `main`  
Existing engineering governance and integration-contract work is in open draft pull requests. Inspect the repository and open PRs before changing anything. Do not assume those PRs are merged.

Supabase project: **VELLARA only**, project ref `iztktfglrvdpnwtvefdw`, region `eu-west-1`. Do not touch the user's other Supabase projects (including Serva).

The current Supabase foundation has been applied to the VELLARA project and includes:
- `profiles`
- `organizations`
- `organization_memberships`
- `business_profiles`
- organization and membership enums
- an auth-user profile trigger
- RLS policies and private authorization helpers
- authenticated RPC `create_organization(p_name, p_business_type, p_timezone, p_currency)`

The repository contains the corresponding migration history and architecture documentation. Inspect the actual files and live project before relying on this summary. A follow-up migration tightened phone validation and event-trigger ACLs. There has not yet been a complete end-to-end authenticated tenant-isolation test. Do not describe the system as production-ready.

Cloudflare is already connected to the user's account. Use the existing Cloudflare account connection for VELLARA work. Do not request a new connection or create/deploy resources without first inspecting what exists.

## 2. Your ownership

You own:
- Cloudflare Worker API implementation and routing.
- Authentication/session verification at the API boundary.
- Resolving the signed-in user's active organization membership and permissions.
- Business use cases and orchestration between Supabase and external providers.
- Request validation, response contracts, error handling, idempotency and audit/event emission.
- AI/channel adapters and provider integrations when their contracts are agreed.
- Backend tests, API documentation, local development instructions and deployment configuration.

You do **not** own:
- Designing or independently changing the database schema. Developer 3 owns schema and migrations.
- Frontend components, layouts, visual design or client-side routing.
- Inventing new product requirements or silently changing shared contracts.
- Directly allocating inventory from an AI prompt or trusting frontend-supplied prices, payment statuses or permissions.

Coordinate schema needs with Developer 3. Propose changes through a written schema request and migration PR; do not make ad hoc production SQL changes.

## 3. Frontend integration contract

The frontend should call one versioned API origin, configured by environment, for example `VELLARA_API_BASE_URL`. Use `/api/v1` as the API prefix. Do not hardcode deployment URLs in frontend code.

### Authentication

- The frontend obtains a Supabase Auth access token through the approved Supabase client/session flow.
- Send it as `Authorization: Bearer <access_token>` on protected requests.
- The Worker must verify the token using a trusted Supabase-supported verification method. Never trust decoded-but-unverified JWT claims.
- Resolve the user ID from the verified identity, then resolve active organization membership server-side.
- Never treat a caller-supplied `organization_id`, `role`, `user_id`, or `is_owner` as proof of access.
- If the user belongs to multiple organizations, provide a safe organization-selection/context mechanism. Verify membership on every request after selection.
- Never expose the Supabase service-role key to the browser.

### Standard response shape

Success:
```json
{
  "data": {},
  "meta": {
    "request_id": "server-generated-id"
  }
}
```

Error:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A concise user-safe explanation",
    "field_errors": {},
    "request_id": "server-generated-id"
  }
}
```

Use appropriate HTTP status codes. Keep error codes stable and documented. Never return stack traces, secrets, raw provider credentials or internal database details.

### Initial frontend-facing endpoints

Implement and document these in a staged way. The first integration milestone is the authenticated Owner Desk, not the entire product.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/me` | Current verified user/profile and session context |
| GET | `/api/v1/organizations` | Organizations the user is an active member of |
| POST | `/api/v1/organizations` | Create organization through the approved atomic database RPC |
| GET | `/api/v1/organizations/:organizationId/context` | Authorized organization, business profile and effective permissions |
| PATCH | `/api/v1/organizations/:organizationId/business-profile` | Update allowed business profile fields |
| GET | `/api/v1/dashboard/summary` | Real summary data for the selected organization |

For the first release, do not invent dashboard metrics or return fake activity. Empty states should be represented as real empty data.

The following are later feature groups. Design route naming consistently, but do not build all of them as part of the first milestone:
- Properties / rooms / listings / services and media.
- Availability, reservations, temporary holds and cancellation.
- Payments, provider verification, refunds and reconciliation.
- Conversations, customers/Guest Box, telephone and WhatsApp events.
- Staff, invitations, permissions, PIN-based sensitive actions.
- Receipts, QR verification and check-in.
- AI knowledge, policy, activity and exception/approval centre.
- Mini-website configuration and public customer booking flow.

Before implementing a later group, agree its request/response schema, state transitions, permissions and database ownership with the frontend and database developers.

### Request conventions

- JSON request bodies for mutations; validate shape, size, enums and business rules.
- Use ISO-8601 timestamps in UTC for API timestamps.
- Use stable opaque IDs. Do not expose sequential internal identifiers as security tokens.
- Pagination should use a documented cursor or limit/offset convention consistently.
- Mutating operations that may be retried must accept an idempotency key where duplicate execution could cause harm.
- Return the canonical server state after a successful mutation.
- Distinguish unauthenticated (401), authenticated-but-forbidden (403), not found (404), validation (422), conflict (409), rate limit (429) and unexpected server failure (500).

## 4. Security and business rules

1. Every organization-scoped query and mutation must be authorized against the verified user's active membership.
2. Tenant isolation must be enforced in the backend and database. Frontend hiding is not security.
3. The API must not accept payment success from a browser redirect or client request. Verify payments server-to-server or through authenticated provider webhooks.
4. Inventory and reservation allocation must be atomic and database-authoritative. A cart is not a reservation. A temporary hold is not a confirmed booking.
5. AI output is untrusted input. AI may request an action, but backend services validate permissions, policy, inventory, price and state before committing it.
6. Use idempotency for reservation creation, payment initiation, provider webhooks and other retry-prone operations.
7. Log security-relevant actions with actor, organization, action, target, outcome and timestamp. Do not log secrets or unnecessary personal data.
8. Apply rate limits to authentication-sensitive, public and provider-webhook endpoints.
9. Validate webhook signatures and prevent replay.
10. Keep secrets in Cloudflare secrets/environment configuration, never in Git or frontend bundles.

## 5. Build order and acceptance gates

### Gate A: inspect and agree
- Inspect the repository, existing PRs, Supabase migrations/schema and Cloudflare resources.
- Confirm the Worker runtime, module layout, deployment environment and secret names with the project owner.
- Read `docs/engineering/DEVELOPMENT_GOVERNANCE.md` and `docs/contracts/INTEGRATION_CONTRACTS.md` if present on the branch you use.
- Publish a short backend implementation plan and any proposed contract changes before coding.

### Gate B: first authenticated Owner Desk API
- Verify a real Supabase access token.
- Return the current user's profile.
- List only organizations the user can access.
- Create an organization through the approved database RPC.
- Resolve an organization's context and effective permissions.
- Reject a user who tries to access another tenant by changing an ID.
- Handle expired/invalid tokens and database/network failures cleanly.

### Gate C: tests
Write automated tests for:
- missing, malformed, expired and invalid tokens;
- valid user with no organization;
- valid owner and non-owner membership;
- cross-tenant read and write attempts;
- suspended membership / organization;
- invalid payloads and unsupported business types;
- duplicate idempotency key behavior where applicable;
- safe error responses and request IDs.

Do not mark a gate complete until tests are run and results are recorded. Include test commands and actual output summary in the PR.

## 6. GitHub workflow

- Work in a dedicated branch, never commit directly to `main`.
- Inspect existing branches and open PRs first. Do not overwrite another developer's work.
- Keep commits focused. Open a PR with scope, files changed, migration dependencies, test results, environment variables and known limitations.
- If a change requires a database migration, coordinate with Developer 3 and reference the migration PR. Do not quietly create competing schema changes.
- Keep API contracts and examples in the repository so the frontend developer can implement against a stable source of truth.
- Do not merge your own PR unless the project owner explicitly authorizes it.

## 7. Copy-and-paste instruction for your coding model

> You are the VELLARA backend engineer working in the existing GitHub repository `ericdabankah/Vellara`. Your assignment is the backend only. Read this handover completely, inspect the current repository, branches, open pull requests, Supabase migrations and live VELLARA project before making changes. The VELLARA Supabase project ref is `iztktfglrvdpnwtvefdw`; do not touch any other Supabase project. Cloudflare is already connected; inspect existing account resources before creating or deploying anything.
>
> Do not build the frontend. Do not redesign the database independently. Developer 3 owns schema and migrations; coordinate required changes with them and use reviewed migrations. Do not assume proposed API routes are already implemented. Implement the first authenticated Owner Desk API milestone first, using the frontend contract in this document. Verify Supabase Auth tokens, resolve organization membership server-side, enforce tenant isolation, use the approved `create_organization` RPC, and return consistent documented response/error envelopes.
>
> Work on a feature branch, not `main`. Preserve existing work and open PRs. Add automated tests for authentication, authorization, tenant isolation, validation and failures. Do not use mock data to claim functionality. Do not expose service-role keys or provider secrets. Do not claim completion until the code, tests, migration dependencies and deployment instructions have been reviewed. Report exactly what you changed, what you tested, what remains incomplete, and the PR URL.
