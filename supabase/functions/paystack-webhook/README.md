# Paystack webhook ingress

This function is the only public ingress for Paystack billing webhooks. It does not activate subscriptions or change entitlements. It verifies the provider signature, filters billing event types, stores a minimal event record in `subscription_provider_events`, and acknowledges only after persistence succeeds.

## Trust boundaries

- `verify_jwt = false` is required because Paystack does not send a VELLARA user JWT. The function performs Paystack signature verification itself.
- Verify the exact raw request bytes before JSON parsing.
- Prefer `Paystack-Signature` using the Paystack webhook signing secret (`whsec_...`). The timestamp must be within 300 seconds. During transition, support `X-Paystack-Signature` only when the current header is absent.
- A present but invalid `Paystack-Signature` is rejected. It never falls back to the legacy header.
- The function uses only the named `billing` key from `SUPABASE_SECRET_KEYS`. Create a dedicated Supabase secret API key named `billing` and verify it is present in the Edge Function environment before deployment. Do not use the general Cloudflare Worker or browser credentials here.
- Supabase secret API keys bypass RLS. A named key isolates rotation and usage, but is not a table-level restricted Postgres role. This function's code is intentionally limited to inserting billing events; the key must not be reused by other services.
- The legacy Paystack secret key is needed only while Paystack still sends `X-Paystack-Signature`. Remove it after confirming all test/live webhooks use `Paystack-Signature`.

## Event handling

Accepted events are charge success, subscription lifecycle, and invoice lifecycle events. Other event types are acknowledged and ignored.

The event inbox uses the existing unique key `(provider, provider_event_id)`. The provider event key is derived from event type and resource ID, falling back to a SHA-256 digest of the raw body. Inserts use `resolution=ignore-duplicates`, so duplicate deliveries are idempotent.

The stored payload is deliberately minimized. It excludes customer email, phone, card authorization objects, bank data, and the raw webhook body. The event's organization ID is left null at ingress. Metadata billing-attempt ID is retained only as an untrusted correlation hint and must be checked against a server-created pending payment attempt before it can be associated with a tenant.

## Required environment

Automatically supplied by Supabase:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEYS` containing the dedicated `billing` key

Set in Edge Function secrets:
- `PAYSTACK_WEBHOOK_SECRET`: Paystack signing secret (`whsec_...`)
- `PAYSTACK_SECRET_KEY`: legacy Paystack secret key, only during the signature migration period

Do not commit any key or secret to the repository. Configure separate test and live secrets only after merchant onboarding and explicit production approval.

## Local tests

Run with Deno:
```sh
deno test --allow-env --allow-net supabase/functions/paystack-webhook/index.test.ts
```

No live Paystack API request is made by these tests. Persistence tests should be added with a local Supabase instance before deploying.

## Current limitations

- This is event intake only. A separate processor must verify the transaction reference with Paystack, compare the verified amount/currency against a server-created payment attempt, then update subscription entitlements atomically.
- The existing schema has no dedicated payment-attempt table. Do not use webhook metadata alone as tenant authority.
- No payment-attempt table, migration, secret, function deployment, Paystack dashboard webhook URL, or production setting is created by this code change.
