# VELLARA Master Development Roadmap

**Status:** Approved  
**Roadmap version:** 1.0  
**Repository:** `ericdabankah/Vellara`  
**Working branch:** `feat/owner-desk-frontend-foundation`

## Product delivery model

VELLARA is a multi-tenant AI-powered business operating platform serving multiple business verticals. Its product scope includes both accommodation/hospitality operations (hotels, serviced apartments, short-stay apartments, and B&Bs) and real-estate sales/rentals (including houses and other properties listed for sale). These are first-class VELLARA business domains, not unrelated products. Delivery is staged: accommodation operations are the initial implementation focus, while the real-estate domain receives its own listing, enquiry/lead, viewing, offer, negotiation, and transaction workflows in a later planned delivery slice. Do not model a property-for-sale as a hotel room or force sales transactions into accommodation reservations. Shared foundations such as organizations, staff permissions, customer identity, communications, AI knowledge/actions, media, payments, receipts, and branded websites should be reusable where appropriate, with domain-specific inventory and lifecycle models.

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

**Objective:** Enable staff to operate an accommodation business using real records, without depending on AI automation. Establish shared platform foundations so the later real-estate vertical can use the same tenant, staff, customer, communication, and website capabilities without conflating its domain records with accommodation inventory.

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

**Objective:** Give each business a branded online destination connected to its authoritative domain records. The accommodation release supports availability and booking. The real-estate vertical will use the same website foundation for property-for-sale/rent listings, enquiries, viewing requests, and sales/rental lead journeys, backed by its own listing and transaction model.

Frontend:
- Branded mini website and listing pages.
- Accommodation: property/room media, descriptions, pricing, availability, enquiry, booking and checkout.
- Real estate: property-for-sale/rent listing media, descriptions, asking prices, location/features, enquiry capture, viewing requests, and lead follow-up. Sales/offer/closing workflows require their own domain model and acceptance criteria.
- Secure continuation/handoff from conversations.

Database:
- Website configuration, branding, publishing, and domain mapping.
- Public listing projection with vertical-specific listing types.
- Accommodation availability holds and expiry, with business-configurable duration and concurrency-safe inventory allocation.
- Booking/checkout sessions, plus separately modelled real-estate viewing, offer, and transaction records when that workflow is delivered.
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
- If local Supabase/Docker is unavailable and hosted development compute is declined, continue frontend and design work without a running database. Keep production read-only; database replay, RLS, grants, constraints, and integration checks remain explicitly unverified until an isolated environment is available.
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
- The live project is currently `ACTIVE_HEALTHY`; its migration history lists the same 11 recovered versions.
- Supabase security and health advisors returned no lints in the 2026-11-26 check.
- Docker Desktop could not be installed. A hosted development branch was quoted at $0.01344/hour and declined.
- The no-Docker workflow is now documented in `docs/VELLARA_NO_DOCKER_DEVELOPMENT_WORKFLOW.md`.
- Production remains read-only. No test records, experimental migrations, or schema changes are authorized by this workaround.
- Clean isolated replay and live-versus-isolated schema comparison remain unverified.
- A least-privilege review remains necessary because RLS being enabled does not by itself establish that table grants are appropriately restricted.

Phase 1 domain design has begun in parallel, without claiming database implementation:
- Accommodation/property model proposal is documented in `docs/VELLARA_PHASE_1_DOMAIN_DESIGN.md`.
- The proposal preserves existing `rooms`, `guests`, and `reservations` compatibility. Organization-level currency/timezone defaults with independent nullable property overrides are approved.
- Room transfers are now an approved domain rule: reject moves while active or future reservations exist; authorize and audit every accepted transfer; retain prior property association history and never rewrite historical reservations.
- Room types are approved as property-specific and fully user-configurable. No fixed names or seeded catalogue; referenced types must retain history and be deactivated rather than destructively deleted.
- Each room type supports a property-entered name, optional description, default capacity, configurable bed configuration, property-managed amenities, and an optional default nightly rate. Rooms may inherit these defaults or use explicit authorized overrides; rates use the property's effective currency.
- Reservation holds are approved: enquiries never block inventory; pending bookings may block a unit only through an explicit, expiring hold. The business configures the hold duration. Expiry releases inventory, hold creation/availability checks must be concurrency-safe, and payment state remains separate from reservation state.
- Property-level staff access is approved for Phase 1: owners can access all properties; managers and operations staff are limited to assigned properties unless explicitly granted broader access; verification permissions are narrowly scoped. Enforcement must be server-side and auditable.
- Real-estate sales/rentals, including houses for sale, are confirmed as a first-class VELLARA product vertical. It is included in the product architecture and roadmap, with dedicated listing, viewing, lead, offer, and transaction models planned separately from accommodation rooms and reservations.
- Frontend work can proceed against verified existing schema; screens requiring new property or room-type tables remain gated until database implementation is safe.
- The Owner Desk now stays on Overview for a new workspace without a subscription; Plans remains available through navigation instead of being forced as the landing page.
- The live reception hero now distinguishes a ringing incoming call from an in-progress call and includes restrained pulse/transform motion with reduced-motion support. Call controls remain disabled until the verified call-control integration exists.
- GitHub Actions Frontend CI passed the TypeScript check and production build for the Owner Desk frontend changes.

Phase 0 database acceptance gates remain open. Phase 1 design and limited frontend foundation work are in progress; Phase 1 implementation and acceptance are not yet complete.
