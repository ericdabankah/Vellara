# VELLARA Staging Preview Workflow

## Purpose

The `staging` branch is the shared integration environment for production-bound VELLARA work. Cloudflare Pages should build a branch preview from this branch so product owners can inspect the latest integrated frontend without needing a business-owner account.

## Environments

- **Feature branches:** isolated work in progress. Their individual previews are optional review environments, not the canonical staging environment.
- **Staging:** the canonical review environment. Only reviewed feature work is integrated here. The stable branch preview is the place to inspect the combined product.
- **Production (`main`):** customer-facing release. Staging does not deploy to production.

## Change flow

1. Build each feature or fix on its own branch.
2. Open a pull request targeting `staging` once its dependencies and API/database contracts are clear.
3. Require frontend CI, relevant backend/database review, and a review of the resulting preview.
4. Merge approved work into `staging`. Cloudflare Pages should publish the updated staging preview from that branch.
5. Test the combined experience and record known limitations.
6. Prepare a separate release pull request from `staging` to `main` only after release checks and required approvals pass.
7. Never merge unreviewed work into `main` merely to update the preview.

## Preview demo route

- `/preview` is a public, read-only visual demo that uses fictional in-memory sample data.
- It does not create a Supabase session, read tenant records, write database records, upload media, publish content, initiate calls, or process payments.
- The sign-in page links to the demo.
- The demo must be clearly labelled as staging/demo content.
- Any new demo interactions must remain local and must not call privileged or production APIs.

## Data and environment isolation

The current Pages preview configuration was previously supplied with the VELLARA Supabase URL and public publishable key. These are browser-visible credentials, but they connect the preview to the existing Supabase project. Before enabling authenticated staging workflows or testing writes, create/use a separate Supabase staging project and configure the Pages preview environment with that project's URL and publishable key. Do not point staging at production data for test operations.

Until a separate staging Supabase project exists, use `/preview` for visual inspection only. Cloudflare Pages preview environment variables are intentionally unset so the staging preview cannot authenticate against the existing Supabase project. Do not sign in to the staging preview to test real tenant operations.

## Current bootstrap limitation

The `staging` branch was initially bootstrapped from the Owner Desk media UI branch so a visual baseline could be reviewed. It is not a declaration that all stacked property migrations, backend APIs, media storage, or payment features have been integrated or approved. Those changes must be reconciled and reviewed before being added to staging.

## Acceptance checks for every staging update

- Frontend CI passes (TypeScript and production build).
- Cloudflare Pages deployment for the staging branch completes successfully.
- The `/preview` route loads without authentication.
- The demo banner and fictional-data warning are visible.
- No real tenant data is fetched and no mutation is possible from demo mode.
- Mobile and desktop layouts are manually inspected.
- Release-specific backend, database, security, provider and payment tests are completed where applicable.
