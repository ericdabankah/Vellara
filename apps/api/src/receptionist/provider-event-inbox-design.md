# Provider event inbox and connection registry design

Status: design only. This document does not create or apply a database migration.

## Why the current tables are not sufficient

The production schema was inspected read-only.

- `organization_phone_numbers` stores the organization's E.164 number and verification/status fields, but no Retell or Meta external resource identifier.
- `phone_number_channels` records the enabled channel and status, but no provider connection reference.
- `receptionist_number_routes` links an internal phone number/channel to an internal receptionist instance. It is not a provider webhook identity registry.
- `calls` stores Retell call records, but it is not a generic inbound event inbox.
- `subscription_provider_events` is explicitly billing-only: its provider constraint permits `paystack`, `stripe`, and `manual`; its unique key is `(provider, provider_event_id)`; and its RLS policy denies client access. Do not weaken or repurpose this table for voice/WhatsApp events.

## Required trust sequence

1. Receive the untouched request body and provider headers.
2. Verify provider authenticity before parsing or trusting payload fields.
3. Parse the provider-specific payload using a provider-specific adapter.
4. Resolve the external provider resource identifier to a server-owned VELLARA provider connection.
5. Confirm the connection is active, verified, not suspended, and belongs to an organization with the channel entitlement.
6. Derive organization and internal routing IDs from the database mapping, never from webhook JSON.
7. Insert a normalized event into a durable inbox with a provider-specific idempotency key.
8. Acknowledge only after durable acceptance. Process asynchronously and idempotently.
9. Re-check current conversation state and authorization before any domain tool executes.

## Proposed schema boundaries

### `receptionist_provider_connections`

A server-owned registry mapping provider resource identifiers to VELLARA entities.

Suggested fields:
- `id` UUID primary key.
- `organization_id` UUID not null.
- `phone_number_id` UUID not null.
- `channel` constrained to `voice` or `whatsapp`.
- `provider` constrained to `retell` or `meta`.
- `provider_connection_ref` text not null, the external resource identifier used to correlate provider callbacks.
- `status` constrained to pending/active/suspended/disconnected.
- `verified_at`, `created_at`, `updated_at`.
- Sanitized provider metadata only; never store access tokens or signing secrets here.

Constraints should include:
- Composite foreign key to the matching `phone_number_channels(organization_id, phone_number_id, channel)` row.
- Unique `(provider, provider_connection_ref)` so one external resource cannot be mapped to two tenants.
- A scoped uniqueness constraint preventing duplicate provider connections for the same organization, phone number, and channel.

### `receptionist_provider_events`

A durable, minimal event inbox. It must not become a general transcript archive.

Suggested fields:
- `id` UUID primary key.
- `organization_id` UUID not null.
- `provider_connection_id` UUID not null.
- `provider`, `channel`, `provider_event_key`, `provider_event_type`.
- `occurred_at`, `received_at`.
- `processing_status` constrained to received/processing/processed/failed/ignored.
- `attempt_count`, `processed_at`, `last_error_code`.
- A bounded normalized payload only where required for retry; avoid storing raw request bodies, media URLs, access tokens, transcripts, or unnecessary personal data.

The uniqueness key should be `(provider_connection_id, provider_event_key)`, not just `(provider, event_id)`. Provider adapters must construct a stable key from the actual event identity:
- Retell: event type plus call identifier, with event-specific identifiers included where the payload provides them.
- Meta WhatsApp: message ID for message events; status events need a deterministic composite derived from the message ID, status, recipient, and provider timestamp. Batched notifications must be split and deduplicated item by item.

The exact key derivation must be confirmed against current provider payload references and fixtures before implementation.

## Privileges and RLS

- Browser clients receive no INSERT/UPDATE/DELETE grants on either table.
- Tenant read access, if required for Owner Desk observability, must use a narrow SELECT policy through active organization membership.
- Provider webhook writes must use a separate server-only ingress privilege path. The current Owner Desk API's caller-bearer-token pattern cannot authenticate an unauthenticated provider callback by itself.
- Do not add a broad `SECURITY DEFINER` function or grant generic write access to `anon`. If a privileged server-side credential is selected, keep it only in Cloudflare secret bindings and restrict it to the webhook ingestion path.
- Keep event insertion, duplicate detection, and state transition atomic.
- Add retention/deletion policy for event payloads and audit state before production use.

## Required tests before a migration is approved

- Cross-tenant provider resource mapping is impossible.
- One provider resource cannot map to multiple organizations.
- Duplicate and retried events are accepted once.
- A batched Meta webhook is split into independently idempotent event items.
- Invalid signatures never reach tenant resolution or database writes.
- Suspended, unverified, disconnected, or non-entitled connections are rejected.
- Concurrent deliveries cannot double-process one event.
- Failed processing can retry without repeating completed business actions.
- Browser roles cannot mutate inbox or provider connection rows.

## Explicitly not done

No SQL migration was generated or applied. Production was queried read-only. The current schema and security posture need isolated migration replay and review before this design becomes DDL.
