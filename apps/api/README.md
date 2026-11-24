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
