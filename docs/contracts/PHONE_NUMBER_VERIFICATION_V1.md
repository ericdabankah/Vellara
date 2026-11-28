# VELLARA Phone Number Registration and Verification Contract v1

Status: design contract only. No provider is selected and no route is enabled by this document.

## Purpose

This contract separates four states that must never be conflated:

1. **Format-valid**: the supplied number parses and is canonical E.164.
2. **Registered**: the organization has requested to connect the number and a pending record exists.
3. **Ownership-verified**: the selected verification provider has confirmed control of the number, and the server has verified the provider result.
4. **Channel-connected**: a voice or WhatsApp provider has completed its own connection/onboarding handshake and the channel is usable.

A syntactically valid E.164 value is not evidence of ownership, carrier reachability, WhatsApp registration, or voice provisioning.

## Current implementation constraints

The current schema already contains:

- `organization_phone_numbers`: globally unique `phone_e164`, `verification_status` (`pending | verified | rejected`), `status` (`pending | active | suspended | disconnected`), and `verified_at`.
- `phone_number_channels`: one row per number/channel, with `voice | whatsapp` and `pending | active | suspended | disconnected`.
- `organization_subscriptions.phone_number_limit`: a subscription entitlement snapshot.
- RLS policies allow authenticated organization members to read phone and channel records, but not write them directly. Provider and integration records are server-managed.

The current schema does **not** contain verification challenge records, provider transaction references, attempt counters, expiry timestamps, or a provider event inbox for phone verification. Do not write directly to the phone tables from the browser. Do not loosen their grants to make the UI work.

The existing API Worker uses the caller's Supabase bearer token and publishable key. It has no service-role credential and no phone routes. Preserve that boundary. Any server-side write must be implemented through narrowly scoped database functions that validate the caller's active organization role, or through a separately approved trusted server workflow. Never add a service-role key to the browser.

## Proposed endpoints

All routes require a verified Supabase access token. The API must resolve the organization from an active membership; a caller-supplied organization ID is only a lookup key, never proof of access. Initially, only active `owner` and `manager` memberships may manage phone numbers.

### 1. List numbers

`GET /v1/organizations/{organization_id}/phone-numbers`

Returns only records visible under the caller's active organization membership.

Response:

```json
{
  "phone_numbers": [
    {
      "id": "uuid",
      "phone_e164": "+233501234567",
      "label": "Main number",
      "verification_status": "pending",
      "status": "pending",
      "verified_at": null,
      "channels": [
        { "channel": "voice", "status": "pending" }
      ]
    }
  ]
}
```

Never return provider credentials, verification codes, challenge secrets, or raw provider payloads.

### 2. Register a number

`POST /v1/organizations/{organization_id}/phone-numbers`

Request:

```json
{
  "phone_e164": "+233501234567",
  "label": "Main number",
  "requested_channels": ["voice"]
}
```

Rules:

- Server independently parses and validates E.164. Reject malformed, non-canonical, or unsupported values.
- Do not trust a client-provided verification status, active status, provider reference, or organization/user identity.
- Check the active subscription entitlement and count reserved numbers consistently. Pending registrations must not let a customer exceed their plan limit.
- Enforce global uniqueness without disclosing which other organization owns a number.
- Create only a pending registration. No channel becomes active.
- Require an idempotency key for retriable registration requests.
- Audit the actor, organization, requested channels, and outcome.

Response: HTTP 202 with the pending phone record and a list of next verification actions. It must not imply that a provider has been contacted unless that operation actually succeeded.

### 3. Start verification

`POST /v1/organizations/{organization_id}/phone-numbers/{phone_number_id}/verification`

Request:

```json
{
  "channel": "voice",
  "method": "provider_managed"
}
```

The API selects an approved provider adapter from server configuration. The client cannot choose arbitrary provider names or submit provider credentials.

Verification is channel/provider-specific:

- **Voice**: provider must prove control using its supported ownership or number-hosting flow. A generic SMS OTP must not be treated as proof of voice provisioning.
- **WhatsApp**: use Meta's approved business onboarding/phone-number verification flow. A voice verification result must not automatically verify WhatsApp.
- If a provider does not support the required proof, return a stable `VERIFICATION_UNAVAILABLE` error and leave the number pending.

Response: HTTP 202 with an opaque `verification_id`, state, expiry, and safe next-step instructions. Never return a verification code or provider secret.

### 4. Complete verification

`POST /v1/organizations/{organization_id}/phone-numbers/{phone_number_id}/verification/confirm`

Request:

```json
{
  "verification_id": "opaque-server-generated-id",
  "code": "user-entered-code"
}
```

The server verifies the challenge with the provider or against a securely stored one-time code hash. It must check challenge ownership, organization, phone number, channel, expiry, attempt count, and one-time use. A successful result changes only the relevant verification state. It does not automatically activate a channel unless the provider connection step also succeeded.

Do not log the submitted code. Apply rate limits by user, organization, phone number, IP, and challenge. Use constant-shape errors to avoid leaking whether a number is registered elsewhere.

### 5. Connect a channel

`POST /v1/organizations/{organization_id}/phone-numbers/{phone_number_id}/channels/{channel}/connect`

This route is allowed only after the required provider-specific verification and onboarding prerequisites are complete. The server checks current subscription entitlements again, performs provider setup, and then activates the channel. A phone number's top-level `status` becomes `active` only when the approved policy says at least one channel is genuinely connected.

### 6. Disconnect a channel or number

`POST /v1/organizations/{organization_id}/phone-numbers/{phone_number_id}/channels/{channel}/disconnect`

`POST /v1/organizations/{organization_id}/phone-numbers/{phone_number_id}/disconnect`

Disconnect is an audited state transition. It must stop routing before provider teardown is attempted. Provider teardown failures are recorded and retried; they must not silently reactivate routing.

## State machine

```text
pending registration
  -> verification pending
  -> ownership verified
  -> provider onboarding pending
  -> channel active
  -> suspended / disconnected

verification pending -> rejected / expired
channel active -> suspended -> active (only after explicit recovery checks)
```

A rejected or expired challenge never activates a number. Re-verification creates a new challenge; it does not rewrite old challenge history. Disconnecting a channel does not erase the audit trail.

## Required database additions before implementation

Prepare a forward-only migration after the schema is replayed and tested in an isolated database. Do not edit applied migrations.

At minimum, design:

- `phone_number_verification_challenges`: UUID, organization_id, phone_number_id, channel, provider, provider_challenge_ref (nullable and protected), state, code_hash only if VELLARA itself issues codes, expires_at, attempt_count, max_attempts, consumed_at, created_by, created_at.
- `phone_number_provider_events`: provider, provider_event_id, received_at, processed_at, processing_status, safe event type, redacted metadata, and unique(provider, provider_event_id) for webhook idempotency.
- A minimal provider connection reference on the channel row or a dedicated integration table. Secrets belong in Cloudflare secrets, not Postgres rows or client responses.
- Narrow database functions for registration, verification transition, channel activation and disconnect, with explicit authorization and transaction boundaries.
- Audit events for registration, verification started/succeeded/failed, channel connected/disconnected, and administrative suspension.

Never store raw OTPs. If the provider supplies a challenge reference, treat it as sensitive. Retain only what is required to complete and audit the flow.

## Security and reliability requirements

- Provider callbacks require signature verification against the provider's configured secret, timestamp/replay checks, and idempotent event processing.
- A browser request cannot mark a number verified, change provider status, activate a channel, or create provider event rows.
- Verify organization membership and role in the database transaction, not only in Worker route code.
- RLS and SQL grants must both be tested. No broad authenticated write grants on integration tables.
- Apply request-size limits, per-action rate limits, idempotency, bounded retries, and safe structured logs.
- Do not expose whether another tenant owns a globally unique number.
- Provider failure leaves the number pending or in a recoverable failed state; it never results in an active channel.
- Enforce plan number limits transactionally to prevent concurrent registrations from exceeding entitlement.
- Channel routing must ignore every number/channel that is not verified and active.

## Provider decision gate

Before implementation, choose and approve the actual providers for:

1. Voice number purchase/hosting and proof of control.
2. WhatsApp Business onboarding and phone-number registration.
3. OTP delivery, only if the selected provider's approved flow requires VELLARA-managed OTP.

The provider adapters, webhook signatures, callback URLs, pricing, supported countries, number portability, and Ghana availability cannot be safely guessed. No provider has been selected by this contract.

## Acceptance tests

- Anonymous, expired-session, suspended-member and non-member requests are rejected.
- Operations and verification roles cannot register, verify, connect, or disconnect numbers.
- An owner cannot manage a number in another organization.
- Invalid E.164 and unsupported destinations are rejected server-side.
- Concurrent registration attempts cannot exceed the plan limit.
- Duplicate number registration does not disclose the owning tenant.
- A pending, rejected, expired, or unverified number cannot be connected or routed.
- A voice verification cannot activate WhatsApp, and vice versa.
- Expired, replayed, wrong-tenant, wrong-number, wrong-channel and over-attempt challenges fail.
- Duplicate provider webhooks are idempotent; invalid signatures and replayed events are rejected.
- Provider outages and teardown failures do not produce false active states.
- Browser direct writes to phone, channel, challenge, and provider-event tables remain denied.
- Every state transition creates an auditable event without recording OTPs or secrets.
