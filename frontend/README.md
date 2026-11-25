# VELLARA Owner Desk frontend

React + TypeScript + Vite frontend foundation.

## Local development
1. Use Node.js 20.19+ or 22.12+.
2. Run `npm install` in this directory.
3. Copy `.env.example` to `.env.local` and configure the Supabase project URL and publishable/anon key.
4. Run `npm run dev`.

## Boundaries
- Frontend only. Do not add Cloudflare Worker or backend API implementation here.
- Never expose a Supabase service-role key in browser code or Vite environment variables.
- Tenant authorization is enforced by Supabase RLS, not frontend checks.
- Do not seed fake business, guest, call, or reservation records.
- Add typed API methods only after the backend owner confirms route and payload contracts.
- Keep feature data access in feature-specific service modules.
- Preserve the approved VELLARA Owner Desk visual direction and incoming-call stage.
- Respect reduced-motion preferences.

## Authentication and tenancy
- Supabase Auth owns user identity and browser sessions.
- The frontend reads only active organization memberships visible under existing RLS.
- New workspaces are created through the existing authenticated `public.create_organization` RPC.
- The RPC atomically creates the organization, business profile, and owner membership.
- Default business timezone and currency are `Africa/Accra` and `GHS`.
- Do not bypass RLS or introduce a service-role key into frontend code.

## Voice and live dashboard integration
The incoming-call stage is designed to become a real, event-driven control surface when the voice provider and VELLARA AI runtime are integrated. It must not remain a local interaction demo.

- Retell credentials, webhook verification, provider call control, and AI runtime execution belong in the backend.
- The frontend must render normalized, backend-confirmed call events and enable call actions only when the backend confirms they are valid.
- AI activity must be concise operational summaries, never hidden model reasoning.
- Dashboard figures must come from persisted, organization-scoped records or approved aggregate endpoints. Unknown values remain unavailable, not fabricated zeroes.
- The current disconnected state is intentional until a real voice service and approved data contracts are connected. The normalized call lifecycle reducer is implemented in `src/voice/call-state.ts`, but it is not wired to an event stream yet.

See [the voice and dashboard integration contract](../docs/VOICE_AND_DASHBOARD_INTEGRATION_CONTRACT.md) for the required event model, action boundaries, and acceptance criteria.

The initial dashboard still contains module placeholders for calls, reservations, guests, and rooms. Those become production workflows only after their database model and backend contracts are agreed.
