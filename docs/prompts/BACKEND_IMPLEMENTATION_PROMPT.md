# VELLARA Backend Engineer: Mandatory Implementation Prompt

## Mission

Build VELLARA's backend as a secure Cloudflare Worker API integrated with Supabase Auth and Postgres. Backend behavior is the authority for identity, tenant access, reservations, payments, staff actions and AI operations.

## Current stack boundary

- Cloudflare Workers for API execution. For new Worker projects use the current Cloudflare `cf` CLI workflow (`cf init`), not Wrangler; generate binding types from `cloudflare.config.ts` and do not hand-maintain an Env interface.
- Supabase Auth for identity.
- Supabase Postgres for relational state and RLS.
- Supabase Storage for tenant assets when storage policies are implemented.
- Cloudflare services only when a concrete requirement justifies them.
- Do not introduce a framework, ORM, queue, AI provider or payment provider without an approved architecture decision.

## Non-negotiable rules

1. Verify every bearer token server-side with Supabase Auth. Never trust a decoded JWT, browser-supplied user ID, tenant ID, role or metadata.
2. Use the caller's JWT for ordinary tenant-scoped database operations so RLS applies. Never use service-role credentials as a shortcut around RLS.
3. Resolve tenant membership from database state on every request that needs tenant context.
4. Enforce authorization at the service boundary and again through RLS/database constraints.
5. Validate every input at runtime. Bound request sizes and reject unknown or invalid state transitions.
6. Return stable error codes, never raw SQL errors, secrets, tokens or provider payloads.
7. Use request-scoped state only. No mutable module globals.
8. Use cryptographically secure identifiers/tokens. Never use Math.random for security-sensitive values.
9. Every mutation that can be retried must be idempotent.
10. Log structured metadata and request IDs, never access tokens, PINs, payment credentials or message contents by default.
11. CORS is not authorization. Apply exact allowed origins and explicit authentication.
12. Use Cloudflare bindings for Cloudflare services. Keep secrets out of source and config.
13. Do not let AI agents directly mutate database tables or invent successful outcomes. Agents call typed backend tools, and domain services validate every action.
14. No fake data or mock success responses in production paths.

## Channel architecture

Telephone, WhatsApp, mini-website, walk-in and staff-assisted activity must call the same domain services. Channel adapters normalize inbound events and carry verified channel metadata. Do not create separate inventory or reservation engines per channel.

## Domain service order

1. identity and tenant context;
2. organization and business profile;
3. staff authorization and sensitive-action approval;
4. business resources and availability;
5. customer identity resolution and conversation history;
6. atomic reservation holds;
7. payment initiation, authoritative verification and webhook reconciliation;
8. receipts, QR issuance and check-in;
9. notifications and reminders;
10. AI orchestration, knowledge retrieval, escalation and activity events.

## Reservation/payment rules

- Cart state never allocates inventory.
- Call an atomic database operation to create a temporary hold.
- Recalculate price and availability on the server.
- Payment initiation is not payment success.
- A redirect/query parameter is never proof of payment.
- Verify payment against the provider's authenticated server-side API/webhook.
- Confirm a reservation only when payment is verified and the hold is still valid.
- Separate reservation and payment state machines.
- Handle duplicate, delayed, reordered and replayed webhooks.
- Require human approval for exceptional refunds, policy overrides and other high-risk actions.

## AI safety and autonomy

AI may answer approved questions, search availability, suggest alternatives, initiate permitted holds/payments and execute standard policy actions through typed tools. AI may not override inventory, pricing, tenant permissions, payment verification, refunds or staff authorization. Human takeover must stop conflicting autonomous actions and be recorded.

## Required output for every backend PR

- API contract and versioning.
- Authentication and tenant resolution flow.
- Authorization matrix.
- Input/output schemas and stable error codes.
- Idempotency and retry behavior.
- Database dependencies and transaction assumptions.
- Provider/webhook trust model where relevant.
- Logs/metrics/traces plan.
- Automated unit, integration and negative security tests.
- Deployment configuration and secret names, never secret values.
- Explicit unimplemented scope.

## Acceptance gate

A backend feature is not complete because the route returns HTTP 200. It is complete only after authenticated and unauthenticated tests, cross-tenant denial tests, invalid-input tests, retry/idempotency tests and database integration tests pass.
