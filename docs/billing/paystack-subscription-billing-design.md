# VELLARA subscription billing with Paystack (Ghana)

## Decision

Paystack is the approved payment provider for VELLARA's own SaaS subscription revenue. Subscription proceeds must settle to VELLARA's registered company payout bank account configured in the Paystack merchant dashboard.

This design applies only to VELLARA plan fees charged to business-owner customers. It must not be reused for hotel/property guest bookings, deposits, refunds, or business-owner payouts. Those are separate payment domains and ledgers.

## Ghana payment methods and renewal behaviour

Offer both cards and Ghana Mobile Money at checkout:

- **Card:** use Paystack's hosted Checkout/transaction initialization and, after a successful first transaction with a reusable authorization, create a Paystack subscription against a server-managed plan. Paystack's Subscriptions API supports card and Direct Debit in Nigeria; for Ghana, treat card as the supported automatic-renewal method.
- **Mobile Money:** support MTN MoMo, Telecel Cash, and AirtelTigo Money in GHS. MoMo authorizations are not reusable. Each renewal therefore requires a fresh payment request and customer approval. Do not describe MoMo as an automatic recurring debit.
- **Manual recovery:** Paystack documents that Subscriptions API charges are not retried after a failed subscription charge. VELLARA must handle the failed invoice state, notify the owner, and provide a secure way to update payment details or make a fresh payment. Do not assume Paystack will retry automatically.

The exact plan prices, billing intervals, grace period, and cancellation policy remain product decisions. Do not invent them in code or seed data.

## Money and settlement boundaries

1. VELLARA creates subscription charges using its own Paystack merchant integration, never a business tenant's Paystack account.
2. Paystack's merchant dashboard payout account must be a bank account owned by VELLARA and verified during merchant onboarding.
3. The application records Paystack transaction references and settlement/reconciliation metadata. It does not route subscription proceeds to individual tenants.
4. Paystack controls payout timing under the merchant account's configured settlement schedule. The application must not promise an exact settlement date until the live merchant dashboard confirms the schedule.
5. Keep booking payments and subscription payments distinguishable at every layer: separate purpose/type, references, reporting, webhook handling and reconciliation. Never let a booking payment activate a SaaS subscription.

## Server-side payment flow

### Starting checkout

1. An authenticated owner/authorized billing manager requests a plan change or subscription checkout.
2. Server resolves the caller's organization from trusted membership data. Never accept an arbitrary organization ID as proof of tenant authority.
3. Server loads the plan and amount from trusted server-side plan configuration/database. Ignore client-submitted amount, currency, plan code, interval, and organization ownership.
4. Server creates a pending internal billing attempt with a unique VELLARA reference and purpose 'vellara_subscription'.
5. Server initializes a Paystack transaction in GHS using amount in pesewas (integer minor units), customer email, the internal reference, and metadata sufficient to correlate the organization and billing attempt. Do not place sensitive personal data in metadata.
6. Return only the hosted authorization URL/reference needed by the client. Never expose the Paystack secret key or webhook signing secret.

### Confirming payment

- A browser redirect/callback is not proof of payment.
- Verify webhook authenticity before parsing or acting on the payload.
- Prefer Paystack's current Paystack-Signature webhook signing-secret scheme when enabled. It signs timestamp + "." + raw_body using HMAC-SHA512 and the full whsec_ secret; enforce the documented 300-second timestamp window and constant-time comparison. During migration, support the legacy X-Paystack-Signature HMAC-SHA512 raw-body scheme only while the merchant integration still sends it.
- Acknowledge a valid webhook quickly, then process it idempotently.
- For charge.success, also verify the transaction by reference from the server when required for callback/reconciliation. Match the verified reference, amount, currency (GHS), customer, and internal pending billing attempt. Only a verified success with the expected amount and currency can grant or extend access.
- Treat pending/offline Mobile Money responses as pending. The customer must approve the prompt. Paystack documents a 180-second approval window; if no success webhook arrives, verify the transaction to establish final state.
- Never activate a plan from the initialize response, a client redirect, or a model-generated statement.

### Subscription lifecycle

Maintain an explicit VELLARA billing state machine, for example:

- pending_payment
- active
- past_due
- grace_period (only if a grace policy is approved)
- cancel_at_period_end
- cancelled
- expired

The exact states must be reconciled with the existing organization_subscriptions schema before implementation. Keep provider subscription status separate from VELLARA entitlement status. A provider event is input to a validated state transition, not authority to change arbitrary organization entitlements.

For card plans, handle Paystack subscription lifecycle and invoice/payment events, including failed payment outcomes. For MoMo, VELLARA schedules a renewal attempt and sends a new payment request for the due period; the subscription remains pending/past-due until the corresponding successful charge is verified.

Cancellation must be explicit and idempotent. If a customer cancels at period end, preserve access only through the already-paid-through date. Do not refund automatically unless a separately approved refund policy and workflow says so.

## Database and event processing

- Reuse the existing billing-specific subscription_provider_events table only after confirming its current constraints and columns. It is appropriate for Paystack billing events; it must not be reused for Retell/Meta receptionist events.
- Its unique provider/event identity should prevent duplicate webhook processing. Paystack may retry or resend events, so the handler must safely ignore already-processed event IDs.
- Correlate the Paystack event to a pending VELLARA billing attempt using the unique transaction reference and server-owned metadata. Never use a webhook-supplied organization ID alone to establish tenant scope.
- Preserve a minimal audit trail: internal billing attempt, provider reference, amount/currency, channel, normalized status, event ID, timestamps, and safe failure codes. Do not store full card data, PINs, OTPs, or unnecessary raw payloads.
- Reconcile organization_subscriptions, payment attempts, and provider events before any schema change. Existing schema names are not proof that all required fields or transitions exist.



### Read-only Supabase schema review (2026-11-28)

The live VELLARA project was inspected with read-only SQL. No data was changed.

Existing billing foundations:

- subscription_plans contains plan codes constrained to starter, growth, premium, and enterprise. Plan listing and purchase availability are separate flags.
- subscription_prices already supports GHS, monthly/yearly intervals, integer amount_minor (pesewas), provider values including paystack, and provider_price_ref. A partial unique index permits one active price per plan/currency/interval/provider.
- organization_subscriptions already stores plan_id, price_id, status, billing_provider, provider_customer_ref, provider_subscription_ref, current billing period, cancellation fields, and plan entitlements. Its allowed statuses include incomplete, pending, trialing, active, past_due, paused, canceled, and expired. It has a partial unique index allowing one current subscription per organization and a unique provider subscription reference when present.
- subscription_provider_events already supports Paystack and has a unique (provider, provider_event_id) constraint, event type, optional organization_id, JSON object payload, received/processed timestamps, and received/processing/processed/failed/ignored states. This is the correct existing inbox for billing-provider events, subject to safe server-side insertion and processing.

Important gaps and guardrails:

- No dedicated payment-attempt/transaction table appeared in the schema inventory. A durable internal billing attempt with a unique VELLARA reference, expected amount/currency, organization, price, payment channel, and state is still required unless an existing table outside the billing-name inventory is proven suitable.
- subscription_provider_events is an event inbox, not a payment ledger. It cannot replace payment attempts or verified payment records.
- RLS policies currently permit organization members to SELECT their own organization_subscriptions; listed subscription plans and active prices are readable by anon/authenticated clients; subscription_provider_events denies all anon/authenticated client operations. No client-side write path should be added.
- The subscription tables have no direct client write policy. The current Cloudflare Worker contract explicitly uses the caller's bearer token and Supabase publishable key only; it forbids a service-role key in that Worker. A Paystack webhook has no authenticated VELLARA user bearer token, and the provider-event table denies anon/authenticated writes. Therefore the webhook cannot safely write through the current user-scoped PostgREST helper. A separate trusted ingress/write path is required. Candidate: a narrowly scoped Supabase Edge Function that verifies Paystack signatures and invokes a restricted database operation, with its privileged credential isolated to that function and never exposed to the browser or general Worker routes. This is an architecture decision requiring approval before introducing privileged credentials or DDL. Do not solve it with a generic public RPC or a broad service-role credential in the Cloudflare Worker.
- The database currently supports monthly/yearly price intervals only. Keep the first implementation to those intervals unless a separately reviewed migration expands it.
- The existing provider constraints already include paystack, so no provider-enum migration is indicated by this inspection.

These findings are schema observations, not proof that billing workflows are implemented or secure end-to-end. RLS/grants, trigger behaviour, and the isolated webhook write path still require a focused audit and isolated testing before runtime changes.

## Security and operational requirements

- Keep Paystack secret keys and webhook signing secrets in Cloudflare Worker secret bindings, separately for test and live environments. No secrets in Git, frontend bundles, logs, or Supabase client configuration.
- Use test keys and Paystack test webhooks first. Live mode must remain disabled until merchant verification, payout bank ownership, webhook signing, plan catalogue, cancellation/refund rules, and reconciliation are reviewed.
- Restrict payment initialization and subscription management to authorized organization roles. A tenant must not be able to select another tenant's subscription or overwrite prices.
- Use integer GHS pesewa amounts; validate currency and expected amount server-side.
- Apply rate limits to checkout creation and renewal initiation. Use idempotency keys/internal references so retries cannot create duplicate paid periods.
- Never store reusable authorization codes in browser-visible rows or return them to the client. If VELLARA must retain one for future card charges, store it server-side with restricted access and a documented retention policy.
- Do not log secrets, full payment payloads, or sensitive authorization data.
- Build an admin reconciliation view before relying on automated access changes at scale.

## Acceptance tests required before release

1. Owner can start checkout for their own organization and receives a Paystack authorization URL.
2. Client-submitted amount, plan code, currency, and organization ID cannot override server-owned values or cross tenant boundaries.
3. Valid card charge.success with matching reference, amount and GHS currency activates the correct subscription once.
4. Wrong amount, wrong currency, unknown reference, failed/pending status, invalid signature, stale timestamp, and malformed body do not activate access.
5. Duplicate and out-of-order webhook deliveries are idempotent and cannot grant duplicate billing periods or downgrade a newer valid state.
6. Mobile Money checkout supports mtn, vod, and atl; remains pending until the user approves and Paystack confirms success.
7. MoMo renewal creates a fresh payment request; no reusable authorization or automatic debit is assumed.
8. Failed card subscription invoice moves the VELLARA billing state according to the approved failure/grace policy; no undocumented automatic retry is assumed.
9. Subscription cancellation, plan change, and end-of-period access are tested against the agreed policy.
10. A booking payment event cannot alter organization_subscriptions.
11. Webhook processing returns promptly, queues durable work, and safely retries transient database failures.
12. Test and live credentials, webhooks, payout configuration, and event stores are isolated.

## Current implementation status

Design and read-only schema review only. No Paystack merchant account, API key, signing secret, live plan, checkout route, webhook route, database migration, production write, or payout account has been configured or created. The next implementation step is to resolve the trusted server-only database write path and durable payment-attempt model, then build and test against Paystack test mode. Live activation requires explicit approval.
