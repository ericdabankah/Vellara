# VELLARA subscription and receptionist capacity model

## Status

Product architecture decision in progress. This document records the owner's stated direction and separates confirmed rules from limits, prices, and billing-provider decisions that still need approval. It does not create live subscription records or change the production database.

## Owner journey

1. Owner creates an account with email and password.
2. Owner confirms their email address.
3. Owner signs in and creates their business workspace.
4. Owner selects a subscription plan.
5. Owner completes checkout through the approved billing provider.
6. The billing provider's verified server-side event activates or updates the subscription.
7. Owner connects phone numbers and assigns receptionist capacity within the plan entitlement.
8. Owner Desk shows the plan, billing state, connected numbers, assigned AI receptionists, and remaining capacity.

An account and workspace may exist before payment, but paid capabilities must remain unavailable until the backend confirms an active entitlement. The frontend must never activate a paid plan based only on a browser redirect or a client-supplied status.

## Product rules confirmed so far

- VELLARA is subscription-based.
- The Starter plan includes one connected phone number and one AI receptionist instance.
- A telephone number used for voice calls and WhatsApp should count as one connected number when both channels use the same E.164 number.
- Higher plans should allow multiple connected numbers and multiple AI receptionist instances.
- Multiple receptionist instances must be able to work independently and handle separate calls at the same time, within the plan's concurrency allowance.
- Plan limits must be enforced by the backend, not just by disabled buttons in the Owner Desk.
- No plan prices or billing provider have been approved in this document.

## Confirmed plan lineup and working entitlement matrix

The four plan names are approved: **Starter, Growth, Premium, and Enterprise**. Exact limits and prices remain unapproved and must not be invented in the product UI or database seed data.

| Entitlement | Starter | Growth | Premium | Enterprise |
|---|---:|---:|---:|---:|
| Connected phone-number slots | 1 | Pending | Pending | Custom agreement |
| AI receptionist instances | 1 | Pending | Pending | Custom agreement |
| Simultaneous AI-handled calls | 1 proposed baseline, provider validation required | Pending | Pending | Custom agreement |
| Voice + WhatsApp on the same E.164 number | Counts as one number slot | Counts as one number slot | Counts as one number slot | Counts as one number slot |
| Price and billing interval | Pending | Pending | Pending | Custom quote / agreement |

Growth and Premium should provide progressively higher capacity than the tier before them. Enterprise should support negotiated limits and onboarding rather than an arbitrary hard-coded ceiling. Do not expose pending values as final marketing copy.

## Important distinction: numbers, channels, instances, and concurrency

These are separate concepts and should not be collapsed into one counter:

- **Connected number:** one unique E.164 telephone identity owned/authorized by a workspace.
- **Channel:** a capability attached to a number, such as voice calling or WhatsApp messaging. Two channels on the same number do not consume two number slots.
- **AI receptionist instance:** a separately configured receptionist runtime that can be assigned to a connected number or routing configuration.
- **Concurrent call capacity:** the number of calls the subscription permits VELLARA to process at the same time.

For example, a workspace with two receptionist instances can have Receptionist 1 handling one call while Receptionist 2 handles another call. The backend must reserve and release concurrency capacity atomically to prevent over-allocation during simultaneous incoming calls.

A single receptionist instance should not be assumed to handle unlimited simultaneous calls. Provider-specific session limits, telephony limits, and the subscription's concurrency allowance must all be respected.

## Proposed data model for backend/database alignment

Names are conceptual and are not live tables yet:

- `plans`: stable plan code, display name, active status, billing interval, currency, and public price.
- `plan_entitlements`: number-slot limit, receptionist-instance limit, simultaneous-call limit, and feature flags, versioned by plan.
- `organization_subscriptions`: organization, plan version, billing provider reference, status, period start/end, trial dates, and cancellation state.
- `subscription_events`: verified provider event IDs and processing status for idempotent webhook handling.
- `organization_phone_numbers`: organization, normalized E.164 number, verification state, and status.
- `phone_number_channels`: voice/WhatsApp channel configuration associated with a phone-number record.
- `receptionist_instances`: organization, configuration/version, status, and assigned number/routing target.
- `call_capacity_reservations` or an equivalent atomic backend mechanism: tracks active sessions against the organization's concurrency entitlement.

Unique constraints should prevent the same normalized number being counted twice for the same organization. Cross-organization ownership/number reuse rules require explicit product and provider decisions.

## Enforcement and security boundaries

- The backend resolves the authenticated user and organization membership. It does not trust a browser-supplied organization ID as authorization.
- The backend reads the current subscription and plan entitlements before allowing number connection, receptionist creation, or call admission.
- Capacity reservation must be atomic under concurrent requests.
- Billing-provider webhook signatures must be verified server-side. Event IDs must be idempotent.
- Browser clients may read their own subscription summary under RLS, but must not write plan prices, entitlement limits, paid status, provider references, or usage counters.
- Provider secrets and billing secrets must never be shipped to the frontend.
- Supabase RLS must isolate subscription and number records by organization.
- Past-due, canceled, expired, and payment-failed behaviour must be explicitly defined before enforcement is enabled. Existing call handling should not be cut off unexpectedly without a documented grace policy.

## Decisions still required before live billing

1. Set connected-number limits for Growth and Premium.
2. Set AI receptionist-instance limits for Growth and Premium, and decide whether those limits always match number slots.
3. Confirm simultaneous-call limits for every tier against real telephony and AI-provider capacity.
4. Set monthly and annual prices, currency, tax treatment, and trial policy.
5. Select the billing provider and confirm Ghana payment methods, recurring-payment support, webhook reliability, and refund/cancellation handling.
6. Define Enterprise quotation, contracting, onboarding, and negotiated entitlement workflow.
7. Define grace periods and what happens to active calls when a subscription becomes inactive.

Until these are approved, implement the account/workspace flow and subscription-aware UI structure, but do not activate checkout or invent plan prices.
