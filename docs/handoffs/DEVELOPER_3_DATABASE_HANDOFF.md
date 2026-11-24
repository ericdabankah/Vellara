# VELLARA Database Developer Handover

**Audience:** Developer 3 (Database / Supabase / Data Security)  
**Purpose:** Define the database responsibilities and give the database developer's coding model a safe, coordinated implementation brief.  
**Status:** Handover specification. It describes the current foundation and required next steps; it does not claim the full VELLARA database is already built.

## 1. Project context and current state

VELLARA is a multi-tenant business front-office and operations platform, initially for hotels and real estate. Telephone, WhatsApp, mini-website and staff-assisted workflows must share the same authoritative business data.

GitHub repository: `ericdabankah/Vellara`  
Default branch: `main`  
Inspect current branches and open draft PRs before making changes. Existing governance and initial Supabase foundation work may still be in unmerged pull requests.

**Use only this Supabase project for VELLARA:**
- Project ref: `iztktfglrvdpnwtvefdw`
- Region: `eu-west-1`
- The Supabase connection is already available.
- Do not modify Serva or any other project.

The current live VELLARA foundation includes:
- Tables: `profiles`, `organizations`, `organization_memberships`, `business_profiles`.
- Enums for organization status, member role and membership status.
- Auth-user trigger that creates a profile.
- An authenticated `create_organization(p_name, p_business_type, p_timezone, p_currency)` RPC that creates the organization, business profile and initial owner membership atomically.
- RLS on the four tables and private authorization helper functions.
- A follow-up migration that tightened phone validation and restricted execution of a platform event-trigger helper.

The repository contains migration files and `docs/architecture/SUPABASE_CORE_FOUNDATION.md`. Inspect both the repository and live schema before adding anything. The first foundation has not yet passed a complete automated end-to-end tenant-isolation test suite. Do not call it production-ready.

## 2. Your ownership

You own:
- PostgreSQL schema design and data relationships.
- Versioned, repeatable Supabase migrations committed to GitHub.
- RLS policies, grants, helper functions and database-side authorization.
- Constraints, indexes, triggers, transactional RPCs and data integrity.
- Supabase Storage buckets and policies when required by an agreed feature.
- Database test fixtures and security/integrity tests.
- A clear schema contract for Developer 2 (backend) and the frontend developer.

You do **not** own:
- Cloudflare Worker routes or backend business orchestration.
- Frontend UI or client-side data access design.
- Payment-provider integration or AI decision-making.
- Direct untracked edits to the live database.

The database is the source of truth for tenant ownership, relationships, inventory state, reservation state and payment state. Backend code must use the schema and approved database functions; the frontend must never bypass backend authorization for sensitive business operations.

## 3. Immediate assignment: audit the existing foundation

Before expanding the schema:
1. Inspect all existing migration files and migration history.
2. Inspect the live tables, columns, constraints, indexes, triggers, functions, grants and RLS policies in the VELLARA project.
3. Compare the live state to the repository migrations.
4. Identify drift, missing constraints, incorrect grants, policy gaps and unsafe SECURITY DEFINER functions.
5. Review the phone validation follow-up migration and preserve migration immutability. Do not rewrite an already-applied migration to hide a correction; add a forward migration if a correction is needed.
6. Test the auth trigger and organization bootstrap RPC with real test users in a safe test environment.
7. Produce an audit note listing confirmed facts, risks and proposed migrations before implementing broader tables.

The Supabase platform may install its own event triggers, including automatic RLS-related helpers. Do not drop or alter platform-managed triggers/functions just to make a migration pass. Inspect ownership and grants, and use documented safe ACL changes only when appropriate.

## 4. Data model direction

Do not attempt to build every VELLARA table in one migration. Design incrementally around the first real user journey: a business owner signs in, creates an organization, and loads only that organization's Owner Desk.

### Foundation entities already present

| Entity | Responsibility |
|---|---|
| profiles | Application profile linked to Supabase Auth user |
| organizations | Tenant/business account boundary |
| organization_memberships | User-to-organization membership, role and status |
| business_profiles | Business-specific profile/configuration |

Preserve existing IDs and relationships unless a reviewed migration explicitly changes them. Organization membership is the authority for tenant access.

### Next domain areas, staged after the audit

Plan schema contracts for these areas, but only implement a group when its use cases and API contract are agreed with Developer 2:

1. **Business configuration:** business type, timezone, currency, operating hours, contact/location and public profile settings.
2. **Catalog and inventory:** hotel room types/rooms, real-estate listings, services, media metadata, facilities, pricing and availability rules. Use a model that supports different business types without a pile of unrelated nullable columns.
3. **Customers and conversations:** customer identities, channel identities, conversations, messages and identity-link confidence/provenance. Do not merge people based on weak phone/name matches.
4. **Reservations:** reservation records, line items/resources, state history, temporary holds, expiry, cancellation and allocation.
5. **Payments:** payment attempts, provider references, webhook events, verification state, refunds and reconciliation. Payment state and reservation state must remain distinct.
6. **Staff and access:** staff membership, role/permission model, invitations, PIN credential metadata (never plaintext PIN), revocation and sensitive-action audit.
7. **Receipts and verification:** receipt records and unpredictable opaque QR/check-in tokens. Do not place personal/payment details in QR payloads.
8. **AI and operations:** approved knowledge sources, policy versions, AI action requests, approvals/exceptions, activity events and delivery logs.
9. **Channel and telephone configuration:** connected numbers, channel accounts, routing configuration and provider status.
10. **Mini-website:** published configuration/version, public slug/domain mapping and safe references back to the tenant's canonical catalog.

For each domain, document entities, ownership, cardinality, lifecycle states, constraints, indexes, retention and RLS before migration.

## 5. Non-negotiable database rules

- Every tenant-owned row must have a clear organization ownership path and enforceable tenant isolation.
- RLS must be enabled and policies tested for every exposed tenant table. Avoid broad policies such as unrestricted authenticated access.
- Use least-privilege grants. Do not expose service credentials or private helper schemas to browser clients.
- SECURITY DEFINER functions must use a safe fixed/empty search_path, schema-qualify objects, validate inputs and have deliberate EXECUTE grants.
- Do not rely only on Worker checks for tenant isolation. Database policies and constraints must provide defense in depth.
- Never accept a frontend-supplied organization ID as authorization. Check the authenticated user’s active membership.
- Use foreign keys, check constraints, unique constraints and indexes to encode invariants.
- Use transactions and appropriate row locking/constraints for reservation holds and inventory allocation. Avoid race-prone read-then-write logic.
- A cart does not reserve inventory. A hold is temporary. A reservation is confirmed only after the authoritative business/payment workflow says it is confirmed.
- Keep payment attempts and reservation status separate. Never mark a payment successful based only on a client redirect.
- Use idempotency keys and unique provider event identifiers to prevent duplicate effects.
- Store timestamps in `timestamptz`; store business timezone separately. Use explicit currency codes and integer minor units or a documented exact numeric representation for money. Never use floating point for monetary values.
- Store media in Supabase Storage and metadata/ownership in Postgres. Storage object paths and policies must prevent cross-tenant access.
- Audit sensitive changes. Avoid retaining unnecessary personal data and never store plaintext PINs, passwords, access tokens or provider secrets.
- Add indexes for actual query patterns, especially organization-scoped filtering, foreign keys, status and expiry scans.

## 6. Database contract required by the backend

Developer 2 needs a documented, stable database contract before implementing business workflows. For every table/RPC, publish:
- exact name and purpose;
- columns, types, nullability, defaults and generated values;
- primary/foreign/unique/check constraints;
- organization ownership path;
- RLS policy behavior by role and status;
- allowed client grants;
- functions/RPC signatures, input validation and return shape;
- transaction and concurrency behavior;
- expected error conditions;
- indexes and retention requirements.

For the first Owner Desk milestone, confirm and test:
- profile lookup by authenticated user ID;
- listing only active organization memberships for that user;
- organization/business profile reads for an authorized member;
- organization creation through the existing atomic RPC;
- owner/manager update rights versus read-only or other roles;
- cross-tenant reads and writes are rejected.

Coordinate RPC names and parameter types with Developer 2. Do not let backend code depend on undocumented table internals where an RPC or stable query contract is safer.

## 7. Test and acceptance gates

### Gate A: audit
Deliver a concise audit report comparing repository migrations with the live VELLARA database. Include actual findings, not assumptions.

### Gate B: foundation security
Test with at least two distinct users and two organizations:
- user A cannot read or mutate user B's profile;
- a member of organization A cannot access organization B's rows;
- a non-member cannot read organization data;
- suspended memberships and organizations are handled correctly;
- owner/manager permissions differ from other roles as specified;
- direct membership writes are blocked unless an explicitly approved workflow permits them;
- RPC execution grants are correct for anon/authenticated/service roles.

### Gate C: migration integrity
- A fresh database can apply the full migration sequence successfully.
- Existing VELLARA data is preserved.
- Migrations are repeatable in CI/test environments and do not depend on hand-edited dashboard state.
- No unrelated Supabase project is changed.
- All RLS policies, grants, triggers and functions are included in version control.

### Gate D: domain readiness
Before a domain is marked ready, include tests for constraints, concurrency, idempotency, tenant isolation and state transitions. Reservation/hold logic must have a race-condition test, and payment/webhook logic must have duplicate-event tests.

Record exact commands and results in the PR. Do not claim a test passed unless it was actually run.

## 8. GitHub workflow and coordination

- Work on a dedicated feature branch. Never commit directly to `main`.
- Inspect open PRs and migration history before creating a branch.
- One migration owner: you. Developer 2 must not independently apply schema changes.
- Submit schema changes as migration files and a PR. Do not make undocumented live-only edits.
- Coordinate migration order and RPC contracts with Developer 2 before implementation.
- Keep the frontend developer supplied with stable API-facing data shapes, not raw unreviewed schema changes.
- Do not merge your own PR unless the project owner explicitly authorizes it.

## 9. Copy-and-paste instruction for your coding model

> You are the VELLARA database engineer working in `ericdabankah/Vellara`. Your assignment is Supabase/Postgres schema, migrations, RLS, grants, database functions, storage policies and database tests only. Read this handover completely. Inspect the current repository, open pull requests, all migration files and the live Supabase schema before changing anything.
>
> Work only in VELLARA Supabase project ref `iztktfglrvdpnwtvefdw` (eu-west-1). Do not touch Serva or any other Supabase project. The existing foundation contains profiles, organizations, organization_memberships and business_profiles, plus an auth profile trigger, RLS and the create_organization RPC. Verify these facts against the live project and repository; do not assume they are complete or production-ready.
>
> Your first task is an audit and security verification of the existing foundation, not a full database build. Compare live schema with version-controlled migrations, preserve applied migration history, identify drift, and report findings. Then implement only the next agreed scope needed for the authenticated Owner Desk milestone. Developer 2 owns the backend and must agree RPC/table contracts with you before depending on them. Do not build frontend routes or Cloudflare Worker logic.
>
> Enforce tenant isolation in the database with tested RLS, least-privilege grants, safe SECURITY DEFINER functions, constraints and transactions. Use migrations committed to GitHub; do not make undocumented dashboard-only changes. Test with at least two users and two organizations, including cross-tenant access attempts. Work on a feature branch, preserve existing work and open PRs, and never commit directly to main.
>
> Report the audit, exact files/migrations changed, actual test commands and results, security limitations, dependencies for Developer 2, and the PR URL. Do not claim production readiness or completion without evidence.
