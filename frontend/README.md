# VELLARA Owner Desk

Production-oriented React, TypeScript, and Vite application for VELLARA workspace owners.

## Local development

1. Use Node.js 22.12 or newer.
2. Run `npm install` in this directory.
3. Copy `.env.example` to `.env.local`.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the VELLARA Supabase project.
5. Run `npm run dev`.

A legacy `VITE_SUPABASE_ANON_KEY` is accepted temporarily, but new deployments should use the publishable key. Never put a Supabase service-role or secret key in Vite variables.

## Implemented owner workflows

- Email/password owner signup and sign-in, email confirmation return, password reset, and password update.
- Authenticated workspace creation through the existing `public.create_organization` RPC.
- Workspace-scoped Overview, Calls, Reservations, Guests, Rooms, Numbers, AI Receptionists, Plans, and Settings screens.
- Live reads from the organization-scoped Supabase tables, including realtime refresh for calls, reservations, guests, rooms, and activity.
- Guest creation, room creation/status updates, reservation creation/status updates, and business profile editing under RLS.
- New workspaces open the Plans screen until a subscription record exists.
- The four public plan cards are Starter, Growth, Premium, and Enterprise. Pending prices and unapproved Growth/Premium limits are not fabricated.
- Incoming-call controls remain disabled until the backend voice provider and call-control endpoints are connected.

## Database and tenancy

The production Supabase project contains the core tenant foundation plus the VELLARA SaaS domain tables:

- Subscription catalogue, entitlement definitions, prices, organization subscriptions, and server-only provider event inbox.
- Organization phone numbers and channel attachments. A shared E.164 number with voice and WhatsApp is one number identity and consumes one number slot.
- AI receptionist instances and number/channel routing.
- Calls, call-capacity leases, guests, rooms, reservations, and activity events.

All new tables have RLS enabled. Browser clients can read only tenant-scoped records through membership policies. Subscription state, billing events, phone-number registration, receptionist provisioning, call-capacity leases, and provider writes are server-owned. Capacity RPCs are executable only by `service_role`; no service-role credential is shipped to the browser.

Room reservations are protected against overlapping date ranges by a database trigger using a transaction-scoped advisory lock. Phone-number slots, receptionist slots, and concurrent call capacity are checked atomically by server-only database functions.

## Backend integration boundary

The backend remains a separate implementation responsibility. It must:

- Verify payment-provider webhook signatures and process provider event IDs idempotently.
- Create/update organization subscriptions and immutable entitlement snapshots only after verified billing events.
- Verify phone-number ownership before calling `register_verified_phone_number`.
- Provision receptionist instances through `create_receptionist_instance`.
- Create call records before reserving capacity with `reserve_call_capacity`, renew leases during active calls, and call `release_call_capacity` when calls finish.
- Send normalized, tenant-scoped call events and activity records.
- Expose authenticated call-control endpoints before enabling Answer, Decline, End, or Handoff controls.

Do not bypass these boundaries by inserting subscription, phone, receptionist, or call-capacity records from browser code.

## Design and accessibility

- Approved palette: forest green `#0F2B23`, gold `#E0A93B`, ivory `#F4F1EA`.
- Responsive Owner Desk layout.
- Reduced-motion preferences respected.
- Metrics are based on persisted records. No demo data or invented KPI values are seeded.

## Validation still required

- Production email confirmation and password recovery with real owner inboxes.
- Two-user cross-tenant RLS acceptance tests.
- Cloudflare Pages environment configuration and deployed redirect URL verification.
- Backend payment, phone verification, voice event, and call-control integration.
- Growth/Premium capacity limits, prices, billing provider, tax/trial, cancellation, and grace-period decisions.
