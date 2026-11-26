# VELLARA Master Development Roadmap

**Status:** Approved  
**Roadmap version:** 1.0  
**Repository:** `ericdabankah/Vellara`  
**Working branch:** `feat/owner-desk-frontend-foundation`

## Product delivery model

VELLARA is a multi-tenant AI-powered business operating platform. The initial market is hotels, serviced apartments, short-stay apartments, and B&B operators. The architecture must allow future expansion without pulling deferred real-estate sales and autonomous physical reception into the first release.

The project is delivered through two coordinated primary workstreams:

1. **Frontend:** Owner Desk, customer-facing business websites, workflows, responsive interfaces, accessibility, and interaction states.
2. **Database:** Supabase schema, relationships, constraints, tenant isolation, RLS, permissions, migrations, and authoritative business records.

A third coordination boundary is maintained for **backend integration contracts**. The separate backend Worker workstream owns Worker implementation. This workstream defines and documents request/response contracts, event semantics, authorization expectations, and integration acceptance tests. It does not modify Worker code.

## Eight delivery phases

### Phase 0 — Foundation and project control

**Objective:** Establish a reproducible, secure foundation and a controlled development workflow.

Frontend:
- Audit the existing React, Vite, and TypeScript application.
- Stabilize design tokens, navigation, reusable components, authentication, and workspace onboarding.
- Record implemented, incomplete, and backend-dependent capabilities accurately.

Database:
- Preserve and validate the 11 recovered original migrations.
- Verify clean replay in an isolated environment.
- Compare the isolated schema with the existing production schema.
- Review RLS, grants, tenant isolation, foreign keys, and migration discipline.
- Establish development/production separation and backup/change controls.

Project controls:
- Maintain architecture, schema gap, roadmap, and API contract documentation.
- Keep changes on the agreed feature branch and use pull requests.
- Do not merge, deploy, or run production schema changes without explicit approval.

**Exit gate:** The current foundation is understood, migration replay is verified in an isolated environment, and security gaps are documented with a tested remediation plan.

### Phase 1 — Core business platform

**Objective:** Enable staff to operate an accommodation business using real records, without depending on AI automation.

Frontend:
- Owner Desk overview and business profile.
- Property/building and room management.
- Guest/customer records.
- Reservation creation, editing, status, and history.
- Operational room status.
- Activity timeline and foundational staff access controls.

Database:
- Multiple properties per organization.
- Property, room type, room/unit, capacity, and amenities foundations.
- Guests and customer records with safe identity matching foundations.
- Reservation lifecycle and status history.
- Availability and overlap protection.
- Staff roles/permissions foundations and audit events.

**Exit gate:** An authorized operator can manage properties, rooms, guests, and reservations using authoritative Supabase data, with tenant isolation and reservation integrity verified.

### Phase 2 — Unified customer communication

**Objective:** Manage customer conversations and leads across supported channels in one workspace.

Frontend:
- Unified inbox and conversation view.
- Customer profile and enquiry history.
- Lead pipeline and journey stage.
- Conversation assignment.
- AI/staff control indicators and explicit human takeover.

Database:
- Canonical customer identities and channel identities.
- Conversations, participants, messages, and attachments.
- Provider message IDs, delivery states, and idempotency.
- Assignment, handover, and control-state history.
- Leads and links to guests/reservations.

**Exit gate:** Conversations can be associated with the correct customer across channels, with duplicate handling, tenant isolation, delivery state, and auditable human takeover.

### Phase 3 — AI receptionist and business knowledge

**Objective:** Configure a shared AI capability safely for each tenant's business.

Frontend:
- AI receptionist settings.
- Business knowledge, FAQs, policies, and instructions.
- Authorized actions and approval settings.
- AI activity and action history.

Database:
- Tenant AI configuration and versioning.
- Knowledge sources, documents, ingestion status, and versions.
- Tool/action permissions and approval rules.
- AI action requests/results and audit history.

Integration contracts:
- Shared AI engine interface.
- Backend Worker interfaces and context requirements.
- Tool authorization, human escalation, and failure semantics.

**Exit gate:** Tenant knowledge and permissions are isolated, actions are auditable, and unsupported facts or unauthorized actions cannot be presented as completed.

### Phase 4 — Payments, receipts, and QR verification

**Objective:** Provide trustworthy transaction records and secure receipt verification.

Frontend:
- Payment attempts and transaction history.
- Payment status and reconciliation visibility.
- Receipt generation and viewing.
- Authenticated QR scanning and verification.
- Refund/reversal status.

Database:
- Payment intents/attempts and transactions.
- Provider events, idempotency, refunds, reversals, and reconciliation.
- Immutable receipt snapshots and unique receipt numbers.
- Opaque, unguessable QR verification tokens with revocation.
- Scan/verification audit records.

**Exit gate:** Payment success is established only by an authoritative provider event or approved reconciliation. QR scanning resolves the canonical receipt securely and never acts as proof of payment by itself.

### Phase 5 — Customer-facing mini websites and booking

**Objective:** Give each business a branded online destination connected to the same inventory and booking source of truth.

Frontend:
- Branded mini website and listing pages.
- Property/room media, descriptions, and pricing.
- Availability display and enquiry.
- Booking and checkout experience.
- Secure continuation/handoff from conversations.

Database:
- Website configuration, branding, publishing, and domain mapping.
- Public listing projection.
- Availability holds and expiry.
- Booking/checkout sessions.
- Scoped, expiring handoff tokens.

**Exit gate:** Customers can discover accommodation, enquire, check availability, and complete a supported booking journey. Owner Desk changes are reflected from the authoritative records.

### Phase 6 — Automation and operational management

**Objective:** Automate repeatable work while respecting consent, business rules, and human control.

Frontend:
- Follow-up and automation management.
- Task assignment and notifications.
- Staff management and permissions.
- Operational reporting.

Database:
- Tenant rules and schedules.
- Follow-up jobs, retries, delivery attempts, and stop conditions.
- Customer opt-outs.
- Staff assignments, tasks, and audit history.

**Exit gate:** Automations are idempotent, observable, retry safely, respect opt-outs, and stop when the required conditions are met.

### Phase 7 — Subscription, billing, and commercial controls

**Objective:** Operate VELLARA as a commercially controlled SaaS platform.

Frontend:
- Subscription and usage dashboard.
- Plan comparison and upgrade/downgrade flows.
- Billing history and account status.

Database:
- Plan entitlements and subscription lifecycle.
- Usage records and enforcement.
- Billing provider events and audit history.

Commercial decisions such as prices, trials, billing intervals, and provider selection remain unapproved until explicitly decided.

**Exit gate:** Entitlements are enforced consistently across UI and backend boundaries, and billing state is based on authoritative provider/reconciliation records.

### Phase 8 — Integration, testing, and production readiness

**Objective:** Verify the complete product as one connected system.

- Integrate the separate backend Worker workstream through approved contracts.
- Integrate voice, WhatsApp, SMS, and the shared AI engine when their providers and credentials are ready.
- Verify cross-channel customer continuity.
- Test concurrent reservations, payment events, retries, and failure recovery.
- Test tenant isolation, roles, and sensitive actions.
- Test mobile responsiveness, accessibility, performance, observability, and recovery.
- Complete deployment and production security review.

**Exit gate:** End-to-end business workflows pass with real integrations, real authoritative data, security checks, and operational recovery. Mocked integrations do not qualify as production readiness.

## Standard delivery cycle for every phase

1. Define scope, exclusions, and acceptance criteria.
2. Inspect existing code, schema, and relevant contracts before changing anything.
3. Design the data model, constraints, authorization, and migration plan.
4. Define frontend screens, states, permissions, and user journeys.
5. Agree on API/event contracts with the separate backend workstream.
6. Implement database and frontend changes in coordinated increments.
7. Test happy paths, edge cases, failure states, tenant boundaries, and accessibility.
8. Update documentation, commit changes, and record unresolved risks.
9. Close the phase only after its exit gate is met.

## Non-negotiable engineering rules

- No fake functionality, fake metrics, or success states unsupported by authoritative records.
- No schema expansion before domain modelling and access-control review.
- Never edit an already-applied migration; create a new migration for each subsequent schema change.
- Never use production as an experimental environment.
- Use a separate development Supabase project if local Supabase/Docker is unavailable or unsuitable. Confirm organization and any nonzero project cost before creating it.
- Never expose Supabase service-role/secret keys in browser code.
- Every tenant-owned record must have an explicit, tested tenant access model.
- RLS and SQL grants are separate controls; review both.
- Payment, booking, receipt, and AI action state must be grounded in authoritative records.
- Human takeover must be explicit and auditable.
- Do not implement autonomous walk-in kiosks, self-check-in/out, smart locks, or unattended physical reception in Phase 1.
- Do not modify the separate backend Worker implementation under this frontend/database workstream.
- Do not merge or deploy without explicit approval.

## Current position

Phase 0 is in progress:
- The 11 original Supabase migrations have been recovered from Supabase migration history and restored to the repository.
- All 11 repository files were compared against their original stored statements and matched exactly, after normalizing the trailing newline.
- Clean isolated replay and live-versus-isolated schema comparison remain unverified.
- A least-privilege review remains necessary because RLS being enabled does not by itself establish that table grants are appropriately restricted.
- Existing production schema must remain unchanged during local/isolated validation.

Phase 1 has not been declared started or complete. It begins after the Phase 0 exit gate is satisfied, or after any remaining Phase 0 risks are explicitly accepted and tracked.
