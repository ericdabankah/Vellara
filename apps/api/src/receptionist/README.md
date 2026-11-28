# Receptionist orchestration core

This folder contains the first provider-independent TypeScript boundary for the VELLARA receptionist.

## Files

- `contracts.ts`: shared channel, normalized event, conversation, tool and orchestration contracts.
- `validate-event.ts`: strict shape/bounds validation for an already normalized provider event candidate.
- `verify-signature.ts`: Web Crypto verification of Retell and Meta signatures against the untouched request body, plus Meta's GET subscription challenge check.

## Trust boundary

`validateProviderEventCandidate` is a parser, not a webhook security mechanism. It does not:
- verify Retell or Meta webhook signatures;
- enforce provider timestamp/replay windows or event deduplication;
- resolve a provider connection to an organization;
- establish that the connection is active, verified or entitled;
- authorize a tool call or perform a domain mutation.

The production ingestion path must perform those checks before constructing a `ReceptionistEvent`. In particular, `organizationId` is intentionally absent from `ProviderEventCandidate`: it must come from the server-owned provider-connection registry, never from a provider payload or model argument.

## Signature verification

- Read and retain the raw request body before JSON parsing. Do not serialize a parsed object and verify that serialization.
- Retell uses `X-Retell-Signature` in `v=<unix-ms>,d=<hex>` form. Verify with the Retell API key marked with the webhook badge; the signed message is the raw body followed by the timestamp, and the timestamp must be within five minutes.
- Meta uses `X-Hub-Signature-256: sha256=<hex>`, keyed with the Meta app secret over the raw request body.
- Meta's GET subscription handshake must require `hub.mode=subscribe`, compare `hub.verify_token` with VELLARA's separately configured verification token, and return `hub.challenge` only after a match.
- Meta's signature has no timestamp. Signature verification does not replace event deduplication, durable inbox persistence, or idempotent processing.
- The helpers return a boolean and do not parse payloads, resolve tenants, or authorize actions. Secrets must be supplied by server-side secret bindings and never by browser input.

## Next integration steps

1. Add runtime tests once the Worker project test harness is bootstrapped.
2. Implement a durable provider-event inbox and unique provider/event key.
3. Resolve active provider connections to tenant IDs in trusted server code.
4. Persist/deduplicate events before asynchronous processing.
5. Add the OpenAI adapter behind a bounded orchestration interface.
6. Add domain tools only when their server-side business services and authorization tests exist.

Do not wire live webhooks or paid provider calls into the Worker until these controls and staging secrets are available.
