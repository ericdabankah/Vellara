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

This API directory already contains source files but has no package manifest or Vite project configuration. Cloudflare documents `cf init .` for an existing app that it can detect (for example, a configured Vite app). Do **not** assume it can scaffold this non-empty, unconfigured directory directly.

Use a clean temporary directory to generate the official Worker scaffold, then merge the generated project files into this folder without replacing the existing API entrypoint:

From `apps/api`:

```sh
cf init ../vellara-api-scaffold --package-manager npm
```

Review the scaffold before copying anything. Bring across its `package.json`, `cloudflare.config.ts`, `vite.config.ts`, `vitest.config.ts`, and `tsconfig.json`. Merge the generated `.gitignore` entries rather than overwriting an existing repository file. Preserve this API's existing `src/index.ts` and `src/receptionist/` files. Review the generated smoke test and adapt it rather than overwriting `test/receptionist/`.

Then, from `apps/api`:

```sh
npm install
cf workers types
```

Add `.cloudflare/` to the API or repository `.gitignore`; Cloudflare's current existing-project instructions explicitly note that generated type/build output is not automatically ignored. Do not add `wrangler.toml`, `wrangler.json`, or `wrangler.jsonc` to this project.

After scaffold review:

1. Declare `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `WEB_ORIGINS` in `cloudflare.config.ts`. Keep the publishable key in a server-side secret binding; never commit its value.
2. Set local development values through the CLI-supported local environment files, excluded from Git.
3. Configure the test environment to load the Cloudflare Worker runtime and run the existing `test/receptionist/` suites.
4. Run typecheck, tests and build. Fix failures before opening live webhook routes.
5. Configure production `WEB_ORIGINS` only after the actual frontend origin is approved.

The source uses generated global `Env` and `ExportedHandler` types. Do not hand-maintain a duplicate binding interface.
