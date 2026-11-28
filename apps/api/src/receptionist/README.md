# Receptionist orchestration core

This folder contains the first provider-independent TypeScript boundary for the VELLARA receptionist.

## Files

- `contracts.ts`: shared channel, normalized event, conversation, tool and orchestration contracts.
- `validate-event.ts`: strict shape/bounds validation for an already normalized provider event candidate.

## Trust boundary

`validateProviderEventCandidate` is a parser, not a webhook security mechanism. It does not:
- verify Retell or Meta webhook signatures;
- enforce provider timestamp/replay windows or event deduplication;
- resolve a provider connection to an organization;
- establish that the connection is active, verified or entitled;
- authorize a tool call or perform a domain mutation.

The production ingestion path must perform those checks before constructing a `ReceptionistEvent`. In particular, `organizationId` is intentionally absent from `ProviderEventCandidate`: it must come from the server-owned provider-connection registry, never from a provider payload or model argument.

## Next integration steps

1. Add runtime tests once the Worker project test harness is bootstrapped.
2. Implement a durable provider-event inbox and unique provider/event key.
3. Implement provider-specific signature verification using current Retell and Meta documentation.
4. Resolve active provider connections to tenant IDs in trusted server code.
5. Add the OpenAI adapter behind a bounded orchestration interface.
6. Add domain tools only when their server-side business services and authorization tests exist.

Do not wire live webhooks or paid provider calls into the Worker until these controls and staging secrets are available.
