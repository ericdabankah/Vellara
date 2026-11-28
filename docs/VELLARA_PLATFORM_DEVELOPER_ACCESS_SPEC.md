# VELLARA Platform Developer Access Specification

**Status:** design proposal only. No developer identity has been provisioned, no production database changes have been made, and no authentication behavior is changed by this document.

## 1. Purpose and separation

VELLARA needs a platform-level Developer Workspace for authorized VELLARA maintainers. This is distinct from a business owner's Owner Desk and from organization staff roles.

Existing organization roles remain:
- `owner`
- `manager`
- `operations`
- `verification`

Do not add `developer` to `organization_memberships.role`. A developer is a platform operator, not a member of every customer organization. Do not create a fake organization membership or business profile merely to make the developer pass the Owner Desk workspace gate.

## 2. Authentication

- Use Supabase Auth for identity, password hashing, email confirmation, session issuance, recovery and MFA where enabled.
- The Developer Workspace uses the same trusted Supabase Auth identity provider, but a developer identity does not need an organization membership.
- The initial requested developer login identifier is `kquayet@gmail.com`. This email is an account identifier only, not proof of developer authority.
- The account must complete the normal verified-email authentication flow. Never store or commit a password, password hash, recovery token, service-role key or other credential in frontend code, Git, configuration files or assistant memory.
- Do not add a public "create developer account" or "become a developer" signup path.
- If the Auth identity does not exist, create it through the approved secure Supabase Auth flow. Do not use browser-side Admin APIs.

## 3. Platform authorization source of truth

Introduce a platform-scoped authorization relation, separate from organization membership. Proposed logical shape:

| Field | Purpose |
|---|---|
| `user_id` | Primary key / FK to `auth.users.id` |
| `status` | `active` or `suspended` |
| `scopes` | Explicit allow-listed platform capabilities |
| `granted_by` | Trusted granting administrator, nullable only for a documented bootstrap |
| `created_at` | Database-generated creation time |
| `updated_at` | Database-generated update time |
| `revoked_at` | Revocation timestamp; historical grant must not be silently reactivated |

The final table name and exact SQL are for Database/Security approval. Suggested name: `platform_developer_access`.

Security requirements:
- No direct INSERT, UPDATE or DELETE for `anon` or ordinary `authenticated` clients.
- No client-writable Auth user metadata or profile field can grant platform access.
- A developer cannot grant access to themselves or change their own scopes.
- Grant/revoke operations run through a narrowly scoped trusted administrative process and are audited.
- Suspended or revoked access takes effect on the next authorization check; do not rely only on long-lived JWT role claims.
- Scope values are validated against a server-side allow-list. Do not accept arbitrary scope strings from the browser.
- Prefer immutable grant history. Regrant by a new grant record or a carefully designed versioned history model, not by clearing a prior revocation timestamp.

## 4. Initial bootstrap

The first developer grant must be a controlled bootstrap, not a public registration feature.

1. Confirm the intended person controls the verified Supabase Auth identity for the requested email.
2. Resolve the exact `auth.users.id` from the trusted Auth system after confirmation.
3. A trusted project administrator provisions that exact user ID in the platform access relation with the minimum initial scopes.
4. Record who performed the grant, when, why, and the approved scopes.
5. Verify the developer session through the backend before rendering the Developer Workspace.

Do not automatically grant access merely because a signup uses the requested email. Email matching is only an identity lookup step after the email is verified; the actual authorization grant is a separate trusted action.

## 5. Login and routing behavior

The Owner Desk currently assumes that an authenticated user with no active organization workspace should see the business workspace setup screen. That assumption must be changed carefully.

After Supabase authentication:
1. Ask the trusted backend for the caller's platform session/capabilities.
2. If the response confirms active developer access, route to the Developer Workspace.
3. Otherwise continue the existing organization-membership lookup and normal Owner Desk flow.
4. A user with no developer access and no organization membership must continue to see the normal owner onboarding flow.
5. A frontend route, hidden navigation item, local storage value, email string or user metadata must never grant access.

The backend should expose an approved platform-session contract (suggested `GET /v1/platform/session`) using the existing PR #3 API conventions: direct JSON success response and `{ error: { code, message, request_id } }` errors. This route is a proposal and must be approved by Backend/API before frontend integration.

The platform-session response should contain only the authenticated caller's effective platform access, such as:
- `access: "developer"` or `access: "none"`
- allow-listed `scopes`
- a request/correlation identifier if part of the shared API contract

Never return secrets, internal credentials, service-role material or unnecessary user records.

## 6. Initial scope model

Start with narrow, explicit scopes rather than an all-powerful boolean. Candidate scopes for future approval:
- `platform:read`: read platform-level health and configuration summaries.
- `organizations:read`: inspect organization metadata needed for support.
- `organizations:support`: perform explicitly approved support actions through audited workflows.
- `onboarding:manage`: configure developer-assisted business onboarding.
- `platform:security`: manage platform access grants; reserved for a separately authorized platform administrator.

Do not grant production database superuser access, unrestricted customer-data access, payment-provider credentials or secret-management access merely because someone is a developer. High-risk actions should require separate scope, strong authentication, reason capture and audit. Prefer read-only support access by default, with sensitive fields minimized or redacted.

The initial account should receive only the scopes required to configure and support launch onboarding. The exact scope list requires product and security approval before provisioning.

## 7. Audit and security events

Record trusted events for:
- developer access granted, suspended, revoked and re-granted;
- successful and denied Developer Workspace access checks where operationally useful;
- scope changes;
- sensitive organization support actions;
- privileged configuration changes.

Audit records must be append-only to application callers. Actor identity and timestamps are derived by the trusted backend/database, never supplied as proof by the browser. Never log passwords, tokens, API keys, payment credentials or unnecessary customer message content.

## 8. Frontend integration requirements

- Add a distinct Developer Workspace entry point and layout; do not disguise it as an owner business workspace.
- Keep the current Owner Desk sign-in usable for owners.
- After authentication, resolve platform access before rendering the no-workspace onboarding screen.
- Treat backend authorization errors as fail-closed. Do not fall back to developer access when the session endpoint is unavailable.
- Do not persist developer privileges in local storage or client-controlled profile metadata.
- Show only navigation/actions permitted by the returned scopes, while remembering that the backend must independently authorize every action.
- Sign-out must clear the Supabase session and all in-memory developer workspace state.

## 9. Backend and database responsibilities

**Backend/API owner**
- Verify Supabase JWTs.
- Implement the approved platform-session endpoint.
- Resolve active platform grants from trusted database state.
- Enforce scope checks on every privileged platform operation.
- Add rate limiting, safe errors and request IDs.
- Never trust caller-supplied user IDs, email addresses, roles or scopes.

**Database/Security owner**
- Approve and implement the platform grant relation, constraints, grants and RLS.
- Ensure ordinary authenticated users cannot enumerate or mutate platform grants.
- Implement safe bootstrap and revocation procedures.
- Add authorization tests for active, suspended, revoked, non-developer and cross-user cases.

**Frontend owner**
- Add route resolution and Developer Workspace UI only after the backend contract is approved.
- Keep API integration fail-closed until the approved endpoint and response schema exist.

## 10. Required tests and release gates

- Verified developer identity with active grant is routed to Developer Workspace even with no organization membership.
- Authenticated non-developer with no organization membership is routed to normal owner onboarding.
- A matching email without an explicit grant does not receive developer access.
- Unverified email, expired session, invalid token and suspended/revoked grant are denied.
- User metadata, local storage, URL parameters and forged request bodies cannot elevate privileges.
- One developer cannot grant or expand their own access.
- Cross-user and cross-tenant access attempts are denied.
- Backend endpoint unavailable or malformed response fails closed.
- Audit actor, scope and timestamp are derived from trusted context.
- Scope-specific operations are tested independently.

No developer access is production-ready until database policies, backend enforcement and end-to-end tests pass. Documentation or a successful frontend build alone is not proof of authorization.

## 11. Decisions pending

- Database/Security approval of table design and bootstrap mechanism.
- Backend/API approval of `GET /v1/platform/session` and scope enforcement.
- Product approval of the initial minimum scope set.
- Confirmation that the requested email is the intended developer identity and that its owner can complete verified Supabase Auth sign-in.

**Current implementation status:** documentation only. No user was created, no role was granted, no password was saved, no production migration was run, and no frontend/backend behavior was changed.
