# VELLARA API

Cloudflare Worker API for the first authenticated Owner Desk milestone.

## Runtime configuration

Set these Worker environment variables:

- `SUPABASE_URL`: URL of the dedicated VELLARA Supabase project.
- `SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key. Never use a service-role or secret key in this Worker.
- `WEB_ORIGINS`: comma-separated exact browser origins permitted to call the API.

No Supabase service-role credential is required. Every database request carries the caller's bearer token, so Postgres RLS remains the tenant authorization boundary.

## Routes

| Method | Route | Authentication | Purpose |
|---|---|---|---|
| GET | `/health` | No | Liveness only |
| GET | `/v1/me` | Required | Verified identity and own profile |
| GET | `/v1/organizations` | Required | Active organization memberships visible to caller |
| POST | `/v1/organizations` | Required | Atomically create organization, business profile and owner membership |

### Create organization

Request:

```json
{
  "name": "Example Hotel",
  "business_type": "hotel",
  "timezone": "Africa/Accra",
  "currency": "GHS"
}
```

Response:

```json
{
  "organization_id": "server-generated-uuid"
}
```

Allowed initial business types: `hotel`, `real_estate`, `other`.

## Security invariants

1. Verify the bearer token with Supabase Auth before using its identity.
2. Do not trust user IDs, organization IDs, roles, or tenant claims supplied by the browser.
3. Use the caller's bearer token for PostgREST. Never use a service-role key in request handling.
4. Do not add direct membership writes. Owner creation goes through the atomic database RPC.
5. Never expose raw Postgres/PostgREST errors or access tokens in responses/logs.
6. CORS is an origin boundary, not an authentication or authorization mechanism.
7. Tenant isolation remains enforced by Postgres RLS, not by route filters alone.

## Not production-complete yet

Before public rollout, add automated Worker runtime tests, request rate limiting, abuse controls for organization creation, structured traces, secret/config validation, and a deployment environment with explicit production origins. This API is the initial identity/tenant slice, not the full VELLARA operational backend.

## Cloudflare project bootstrap

This folder is a new Worker project and uses the current Cloudflare `cf` CLI workflow, not Wrangler.

From this directory, run:

```sh
cf init .
```

Review the generated project changes. The scaffold should provide `cloudflare.config.ts`, package scripts, Cloudflare Vite/Vitest integration, and generated Worker binding types. Do not add `wrangler.toml`, `wrangler.json`, or `wrangler.jsonc` to this new project.

After bootstrap:

1. Declare `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `WEB_ORIGINS` in `cloudflare.config.ts`. Use a secret binding for the publishable key; do not commit its value.
2. Set local development values through the CLI-supported local secret/environment files, excluded from Git.
3. Generate binding types with `cf workers types`.
4. Add Worker runtime tests using the scaffold's Workers Vitest integration.
5. Run typecheck, tests and build before creating a deployment.
6. Configure production `WEB_ORIGINS` only after the actual frontend origin is approved.

The source uses the generated global `Env` and `ExportedHandler` types. Do not hand-maintain a duplicate binding interface.
