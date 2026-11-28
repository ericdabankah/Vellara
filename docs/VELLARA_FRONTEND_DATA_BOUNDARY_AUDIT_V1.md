# VELLARA Frontend Data-Boundary Audit v1

**Reviewed:** 2026-11-28  
**Branch reviewed:** `staging`  
**Status:** Read-only code audit. No frontend source files changed.

## 1. Executive finding

The current Owner Desk is a useful visual and workflow baseline, but it is not yet aligned with the agreed system boundary:

> Retell and Meta handle communication. OpenAI handles intelligence. VELLARA controls business decisions and data.

The current React frontend creates a Supabase client and performs many reads directly from public tables. It also performs direct inserts and updates for important operational actions. RLS may scope these operations, but RLS alone does not make the frontend the correct owner of booking, availability, payment, publication or property-domain business rules.

The next frontend integration pass should preserve the existing visual baseline while moving authoritative operations behind the VELLARA `/v1` API. Do not replace working screens with guessed endpoints. Use typed mock adapters until the backend owner approves and implements the API contract.

## 2. Files inspected

- `frontend/src/App.tsx`
- `frontend/src/components/PropertyWorkspace.tsx`
- `frontend/src/components/PreviewDemo.tsx`
- `frontend/src/lib/supabase.ts`
- `frontend/src/styles.css`
- `frontend/package.json`

The isolated `/preview` demo is explicitly labelled demo-only and does not call Supabase. Keep that isolation.

## 3. Direct Supabase reads in the current Owner Desk

`App.tsx` directly reads:
- Calls.
- Reservations.
- Guests.
- Rooms and joined room types.
- Organization phone numbers and channel status.
- Receptionist instances and number routes.
- Subscription plans, entitlements, prices and organization subscription.
- Activity events.
- Business profile.
- Properties, organization modules and room types.
- Dashboard aggregate counts.

`PropertyWorkspace.tsx` directly reads room types.

These reads currently depend on the browser's Supabase session and database RLS/grants. They can remain temporarily during development if their exact role policies and least-privilege grants are verified. The longer-term direction is a versioned API/query layer for consistent authorization, DTO shaping, audit and stable frontend contracts.

## 4. Direct writes that should move behind VELLARA backend operations

### `App.tsx`
- Inserts guests.
- Inserts rooms.
- Inserts reservations.
- Updates room and reservation status.
- Updates business profile.
- Calls `create_property` RPC for property creation.
- Reads and displays operational state.

### `PropertyWorkspace.tsx`
- Updates property fields, including slug, status, currency and timezone.
- Inserts and updates room types.
- Archives room types.
- Reads room types.

### Why these require backend/domain review

- Reservation creation currently writes directly to `reservations`, with status selected from the presence of a room assignment. The new booking model requires room-type line items, price snapshots, inventory validation and potentially a hold. The current write path cannot guarantee those invariants.
- Room creation accepts a client-computed nightly rate and currency. Currency precedence is not yet finalized, and room-type pricing should be the canonical new booking path.
- Room/reservation status updates are performed directly from the browser. These transitions should be validated against a backend state machine and audit policy.
- Property publication is not yet represented as a separate lifecycle. Updating `status` must not accidentally publish a public property.
- Room-type creation/archiving changes sellable inventory and should coordinate with active reservations, holds and property status.
- Business-profile edits are lower-risk than booking/money actions, but still need explicit field permissions and an audit decision.

## 5. Target frontend architecture

Suggested structure:

```text
frontend/src/
  api/
    client.ts                 # /v1 HTTP client, auth token, request_id/errors
    properties.ts             # public resolver + owner property operations
    hospitality.ts            # availability, quote, holds, reservations
    inventory.ts              # room types, rooms, allocations, blocks
    guests.ts                 # guest lookup/create
    dashboard.ts              # dashboard query DTOs
  domain/
    properties.ts             # frontend-safe property types
    hospitality.ts            # quote, hold, reservation, allocation types
    money.ts                  # integer minor units + ISO currency helpers
  adapters/
    mock/
      properties.ts
      hospitality.ts
      dashboard.ts
  features/
    ...existing screens...
```

The exact folder structure can follow the repository's conventions. The important boundary is that UI components call typed domain services, not Supabase tables for privileged business operations.

### API client responsibilities
- Prefix requests with `/v1`.
- Attach the current authenticated access token for owner routes.
- Generate/request idempotency keys for mutations.
- Normalize the standard error envelope.
- Preserve `request_id` for support diagnostics.
- Never include a service-role or secret key.
- Avoid logging guest PII, payment data or access tokens.

### Mock adapter responsibilities
- Provide deterministic, clearly labelled demo data.
- Implement the same request/response shapes as the approved API contract.
- Simulate realistic states: unavailable inventory, expired quote, hold expiry, conflict and permission denial.
- Never write to the live Supabase project.
- Be selectable only in explicit preview/demo mode, never silently as a fallback after a production API failure.

## 6. Recommended refactor order

1. Add shared API response/error and domain types.
2. Add an HTTP client with auth, request IDs and idempotency support.
3. Add typed mock adapters matching the proposed property/hospitality API contract.
4. Refactor public property discovery and property detail screens to use the adapter.
5. Refactor room-type availability and quote UI.
6. Add hold and payment progress UI using mocked lifecycle states.
7. Refactor Owner Desk property publication and room-type management.
8. Refactor reservation creation, status transitions and physical room allocation.
9. Move guest/profile/dashboard reads to stable API DTOs as backend endpoints become available.
10. Remove direct browser writes to operational tables once the equivalent backend routes are deployed and tested.

Do not refactor every dashboard read at once. Prioritize writes that can create bookings, consume inventory, change publication, or change payment/operational state.

## 7. Backend API contract dependency

The proposed endpoint and payload contract is in:

- [VELLARA Property and Hospitality API Contract v1](VELLARA_PROPERTY_AND_HOSPITALITY_API_CONTRACT_V1.md)

The detailed database model is in:

- [VELLARA Property Identity and Hospitality Booking Model v1](VELLARA_PROPERTY_IDENTITY_AND_HOSPITALITY_BOOKING_MODEL_V1.md)

These documents are proposals. The backend owner must approve route names, request/response shapes, idempotency, hold duration, pending reservation semantics and permission rules before the frontend binds to live endpoints.

## 8. Build and release gate

The repository's frontend package uses React 19, TypeScript 5.8, Vite 7 and a `build` script that runs TypeScript checking before Vite production bundling.

The current execution environment does not have the Supabase CLI or Docker available. No frontend package install/build was run during this read-only audit. Before a code change is claimed complete, run the repository's pinned package manager/install workflow, `npm run typecheck` and `npm run build` in the project's intended environment, then inspect the Cloudflare staging deployment.

Do not merge to main or deploy production as part of this staging refactor.

## 9. Current decision

- Keep the current Owner Desk visual baseline.
- Keep `/preview` isolated and demo-only.
- Do not add more direct browser writes for booking, room inventory, publication or payment.
- Build typed mock adapters first.
- Switch to live `/v1` endpoints only after backend implementation and API approval.
- Keep production Supabase untouched until the schema and API release gates pass.
