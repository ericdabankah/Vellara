# VELLARA Development Workflow Without Docker

**Status:** Active workaround  
**Date:** 2026-11-26  
**Applies to:** Frontend and database design work on `feat/owner-desk-frontend-foundation`

## Decision

Docker Desktop could not be installed, and a hosted Supabase development branch was declined because of its recurring compute cost. Development therefore continues without a running local or hosted development database.

This is a delivery-mode change, not permission to use production as a test environment.

## Work that can proceed

- React/Vite/TypeScript implementation and local browser testing.
- TypeScript type checks and production builds on the developer's machine.
- Component-level tests and tests using explicitly labelled fixtures.
- UX flows, loading/empty/error states, responsive layouts, accessibility, and reduced-motion behaviour.
- SQL migration design and review in Git without executing it.
- Read-only inspection of the existing production schema, migration history, and advisors.
- API/event contracts for the separate backend Worker workstream.
- Static SQL review, dependency review, and migration ordering checks.

## Work that is blocked or must remain unverified

- Clean replay of the 11 recovered migrations.
- Local PostgreSQL integration tests.
- Migration execution and schema-diff validation.
- RLS behaviour tests under real anon/authenticated JWT roles.
- Constraint, trigger, concurrency, and transaction tests.
- End-to-end browser-to-Supabase write verification.
- Production-readiness claims for any database change.

A TypeScript build does not prove database correctness. Static SQL review does not prove migration replay. Mocks do not prove real integration.

## Production safety rules

1. Production Supabase is read-only for this workaround.
2. Do not use `apply_migration`, direct DDL, seed inserts, test users, or destructive SQL on production.
3. Read-only queries may inspect catalog metadata, migration history, grants, policies, and existing records only where needed.
4. Never place service-role or secret keys in browser code, repository files, screenshots, or logs.
5. Every new schema change remains a proposed migration until it can be executed and tested in an isolated environment.
6. Do not mark a phase exit gate complete while its database checks are pending.
7. Do not merge or deploy without explicit approval.

## Validation labels

Use these labels in PR descriptions and engineering notes:

- **Implemented:** Code or migration file exists.
- **Static-checked:** TypeScript/build/lint or SQL review completed without executing against a database.
- **Frontend-tested:** Interaction verified in a browser using real frontend code; any mock data is clearly identified.
- **Database-unverified:** Migration, RLS, grants, triggers, constraints, or transaction behaviour has not been run in isolation.
- **Integration-unverified:** External provider or Worker round trip has not been tested end to end.

## Re-entry path

When a free isolated database environment becomes available:

1. Create a clean disposable database.
2. Replay all 11 recovered migrations in timestamp order.
3. Compare schema objects with the live production catalog.
4. Run role-based tenant-isolation and least-privilege tests.
5. Execute new proposed migrations and their rollback/recovery checks.
6. Only then promote database work through the normal review process.

The recovered migration files are the canonical source for this validation. Never reconstruct or silently rewrite an already-applied migration.
