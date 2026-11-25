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
- Do not seed fake business records or use mock records in production flows.
- Add typed API methods only after the backend owner confirms route and payload contracts.
- Keep feature data access in feature-specific service modules.
- Preserve the approved VELLARA Owner Desk visual direction and incoming-call stage.
- Respect reduced-motion preferences.

The initial dashboard is a shell. The call stage is a visual interaction preview, not a live telephony integration. KPI values remain empty until real data contracts are agreed.