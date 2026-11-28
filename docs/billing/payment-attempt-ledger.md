# Paystack payment-attempt ledger and atomic activation

**Status: implementation proposal, not a deployable migration.** The SQL companion file is a review reference only. It has not been applied to Supabase and must first be converted into a CLI-generated migration, tested against a local database, and reviewed.

## Why this layer is required

The current VELLARA schema has plans, prices, organization subscriptions, and a provider-event inbox, but no durable payment-attempt ledger. The event inbox is not a financial record and must not be treated as one.

A payment attempt must be created by trusted server code using:
- organization and subscription resolved from authenticated membership, not client-supplied tenant authority;
- selected plan and active price read from the database;
- integer GHS pesewa amount, currency, and monthly/yearly interval;
- a unique VELLARA-generated Paystack reference;
- an idempotency key scoped to the organization;
- a short expiry and an expected payment channel.

The browser receives only the Paystack authorization URL and reference. It never supplies the amount to Paystack and never receives secret credentials.

## Atomic activation contract

The SQL reference proposes `public.apply_verified_paystack_payment(...)`. It is intentionally SECURITY INVOKER and callable only by `service_role`. It locks the attempt and subscription rows, validates the independently verified transaction facts against the server-created attempt, and updates the payment attempt and subscription in one Postgres transaction.

The processor must call Paystack's server-side Verify Transaction endpoint using the stored reference and secret key. It must pass the RPC only these verified values:
- exact transaction reference;
- status;
- amount in pesewas;
- currency;
- transaction ID represented as text (avoids unsigned-64-bit overflow concerns);
- normalized channel (`card` or `mobile_money`);
- provider paid timestamp.

The RPC rejects or quarantines mismatches. Duplicate delivery with the same Paystack transaction ID returns `already_applied`; a second transaction ID for an already succeeded attempt returns `conflict`. It never trusts organization metadata from the webhook.

## Important gaps before production

1. **Card automatic renewals:** this proposal covers server-created checkout attempts and manually initiated renewal attempts. It does not yet implement Paystack subscription invoice reconciliation or the creation of ledger rows for provider-initiated card renewals. That must be added as a separate reviewed path, correlating the Paystack subscription code to the stored `provider_subscription_ref` and verifying the invoice's transaction before applying a period.
2. **Mobile Money:** each renewal remains a fresh payment attempt and requires customer approval. Do not store a reusable MoMo authorization.
3. **Late payments:** a successful transaction outside the attempt expiry window is moved to `review_required`, not automatically granted access. An approved reconciliation path must resolve it.
4. **Plan catalogue:** read-only inspection on 2026-11-28 found zero active Paystack prices. All plans currently have `is_available_for_purchase = false`; Growth, Premium, and Enterprise entitlements are still `pending`. Checkout must remain disabled until the plan catalogue and prices are explicitly configured.
5. **Billing policy:** exact prices, grace period, cancellation/refund rules, and late-payment handling remain undecided. No values are invented here.
6. **Event retries:** the provider-event inbox needs a recoverable processing lease/claim strategy so a worker crash cannot strand an event in `processing`. The webhook should persist and acknowledge quickly; a durable worker/cron should retry `received` and recoverable `failed` events. A background task alone is not a durable retry queue.
7. **Security:** the Supabase named secret key still bypasses RLS. Its name isolates rotation, not table permissions. Keep it only in the dedicated billing Edge Function; never place it in browser code or the general Cloudflare Worker.

## Current database facts (read-only, 2026-11-28)

- `subscription_payment_attempts` does not exist.
- `subscription_provider_events` already has a unique `(provider, provider_event_id)` constraint and denies anon/authenticated client operations.
- `organization_subscriptions` permits organization-member SELECT only.
- `subscription_prices` is publicly readable only when active and not expired.
- Plans: Starter is listed and entitlements are configured, but purchase is disabled. Growth, Premium, and Enterprise are also purchase-disabled and their entitlements are pending. No active Paystack GHS prices exist.

## Required validation before merge/deploy

- Generate the migration locally using the Supabase CLI, not by inventing a timestamped migration filename.
- Apply it only to a local Supabase stack first; do not use the hosted project as a test database.
- Add pgTAP tests for RLS, tenant isolation, duplicate references, amount/currency/channel mismatches, expired attempts, canceled subscriptions, unavailable plans, duplicate webhook delivery, and concurrent processing.
- Add Deno tests for Paystack verification parsing and the event worker.
- Confirm the SQL function can be executed by `service_role` and cannot be executed by `anon` or `authenticated`.
- Run Supabase advisors and inspect grants/RLS before considering merge.
- Keep Paystack test/live credentials, webhook signing secrets, Edge Function deployment, and merchant dashboard changes out of this PR.
