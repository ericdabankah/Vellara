# Owner Desk Foundation: Acceptance Test Gate

Status: required before frontend integration or public deployment.

## Environment rules

- Run end-to-end tests in a dedicated Supabase development/staging project, never by creating fake production customers.
- Use two disposable test identities, User A and User B, with separate organizations.
- Keep test credentials and tokens out of GitHub, logs, screenshots and chat.
- Clean up test identities and tenant rows after the test run.
- Do not use the Serva or SLEIT Supabase projects.

## Database tests

| Test | Expected result |
|---|---|
| New Auth user inserted | Exactly one profile row is created |
| Duplicate profile trigger execution | No duplicate profile |
| User A creates organization | One organization, one business profile and one active owner membership are created atomically |
| Invalid organization name | Rejected; no partial rows |
| Unsupported business type | Rejected; no partial rows |
| Invalid timezone or currency | Rejected; no partial rows |
| Unauthenticated organization bootstrap | Rejected |
| User A selects own profile | Own profile only |
| User A selects User B profile | No row returned |
| User A reads User B organization | No row returned |
| User A updates User B business profile | No row changed |
| Authenticated client inserts membership directly | Permission denied |
| Authenticated client changes own role/status | Permission denied |
| Suspended membership reads tenant data | No tenant data returned |
| Cross-tenant foreign-key attempt | Rejected by constraints/RLS |
| Phone E.164 valid and invalid cases | Valid formats pass; malformed formats fail |

## Worker API tests

| Request | Expected result |
|---|---|
| GET /health | 200; no secrets or database details |
| GET /v1/me without token | 401 |
| GET /v1/me with invalid/expired token | 401 |
| GET /v1/me with User A token | User A identity and profile only |
| GET /v1/organizations with User A token | Only User A's active memberships |
| POST /v1/organizations without token | 401 |
| POST /v1/organizations with invalid body | 400; no database write |
| POST /v1/organizations with User A token | 201; owner membership created atomically |
| User A requests User B tenant context | 403 or no data, never User B data |
| Disallowed browser origin | CORS request denied |
| Oversized request body | 413 |
| Unknown route | 404 |
| Unsupported method | 405 |
| Supabase Auth outage | Stable 502 response; no raw upstream body |
| PostgREST/RLS denial | Stable safe error; no SQL details |

## Required automated checks

- TypeScript typecheck using generated Cloudflare Worker binding types.
- Cloudflare Workers runtime tests using the `cf init` scaffold's test setup.
- Unit tests for input validation, CORS, body size and error mapping.
- Integration tests against a staging Supabase project.
- Two-user tenant-isolation tests.
- Advisor review after every database migration.
- No deployment until all required tests pass.

## Current verified facts

- Four public application tables have RLS enabled.
- The security advisor reports no current security lints.
- The public organization RPC is SECURITY INVOKER and the privileged implementation is in the non-exposed private schema.
- Anonymous profile SELECT and direct authenticated membership writes are not granted.
- E.164 constraints and the two missing foreign-key indexes have been corrected.
- The current live database has no customer or booking seed data.

## Not yet verified

- A successful end-to-end Auth signup/sign-in against the VELLARA project.
- Two-user cross-tenant isolation with real disposable staging identities.
- Worker compilation, runtime tests and deployed API behavior.
- Rate limiting and organization-creation abuse controls.
