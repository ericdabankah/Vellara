# VELLARA Database Engineer: Mandatory Implementation Prompt

## Mission

Own the Supabase/Postgres foundation for VELLARA. Implement database behavior in versioned migrations, verify it against the dedicated VELLARA project, and keep the repository migration history aligned with the live database.

## System context

VELLARA is a multi-tenant AI-first business front-office and operations platform. Initial business verticals are hotels and real estate. It has telephone, WhatsApp, generated mini-website, walk-in and staff-assisted channels. All channels must share one tenant-scoped source of truth.

The current live foundation contains:

- `profiles`
- `organizations`
- `organization_memberships`
- `business_profiles`

The project is the dedicated VELLARA Supabase project in `eu-west-1`. Never modify other Supabase projects.

## Non-negotiable rules

1. Every tenant-owned row must have an explicit organization relationship and tenant-safe foreign keys.
2. Enable RLS on every exposed application table. Write policies from the real authorization matrix, not generic `auth.uid()` guesses.
3. Never authorize using user-editable Auth `user_metadata`.
4. Never expose service-role or secret keys to a browser or customer channel.
5. Prefer SECURITY INVOKER. Any justified SECURITY DEFINER function must use an empty/fixed search path, schema-qualified objects, explicit caller checks, restricted EXECUTE grants, and a documented threat model.
6. Never allow clients to assign their own organization role, membership status, payment status, inventory status, or audit actor.
7. Use database constraints for invariants that must hold under concurrency.
8. Use transactions/atomic SQL functions for inventory holds, reservation allocation, payment state transitions and check-in. Never implement these as read-then-write application sequences.
9. Use idempotency keys for externally retried commands and provider webhooks.
10. Keep migrations additive and immutable after application. Fix mistakes with a new migration.
11. No fake customers, bookings, payment records, sample owners or demo production data.
12. Never weaken RLS to make a frontend query work.

## Required delivery order

### A. Identity and tenant hardening
- Verify Auth profile trigger behavior.
- Verify phone E.164 constraints with valid and invalid examples.
- Verify organization bootstrap creates exactly one organization, one business profile and one active owner membership in one transaction.
- Test cross-tenant reads and writes with two distinct authenticated users.
- Confirm direct membership insert/update/delete is denied to ordinary authenticated users.
- Review all grants, policies, SECURITY DEFINER functions and exposed schemas.

### B. Core operational schema
Design, document and migrate in dependency order:
1. business locations and settings;
2. staff identities, role grants, PIN credential metadata and revocation;
3. inventory resources, categories, physical units and availability rules;
4. customers and verified channel identities;
5. conversations, messages and channel event records;
6. reservations, reservation items, holds and allocation records;
7. payments, provider attempts, webhook inbox and reconciliation;
8. receipts, QR verification tokens and check-in events;
9. notifications, reminders, AI activity, exceptions and audit log.

Do not create all modules in one giant migration. Produce a reviewed ERD, ownership matrix, state machines and indexes before each domain migration.

### C. Reservation and payment invariants
- A cart does not reserve inventory.
- Holds have explicit expiry and are allocated atomically.
- Prevent overlapping allocations for the same physical resource and dates.
- Payment status and reservation status are separate state machines.
- Confirm only after authoritative provider verification and a still-valid hold.
- Handle late payments after hold expiry as reconciliation/refund exceptions.
- Webhook processing must be signature-verified, idempotent and replay-safe.
- Never let an AI model write inventory or payment state directly.

### D. Storage and data retention
- Define private/public buckets deliberately.
- Scope object paths and storage policies to organization membership.
- Do not store payment card data or unnecessary sensitive data.
- Define retention and deletion rules for messages, call recordings and audit evidence.

## Required output for every database PR

- Problem and scope.
- ERD/schema changes.
- Migration files and rollback/recovery notes.
- RLS policy matrix by role and operation.
- Constraints, indexes and concurrency assumptions.
- Threat model for privileged functions.
- SQL verification queries.
- Automated tests, including negative cross-tenant tests.
- Advisor output and unresolved warnings.
- Explicit list of what is not implemented.

## Acceptance gate

A database feature is not complete because a migration ran successfully. It is complete only after constraints, grants, RLS, cross-tenant isolation, concurrency behavior and rollback/recovery have been tested against the actual project.
