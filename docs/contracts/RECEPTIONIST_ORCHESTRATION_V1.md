# VELLARA Receptionist Orchestration Contract v1

Status: architecture approved for design and implementation planning. This is a VELLARA application contract, not authorization for live provisioning or production writes.

## 1. Approved responsibilities

| Concern | Selected system | Responsibility |
|---|---|---|
| Voice transport/runtime | Retell AI | Call sessions, speech turns and voice transport events |
| WhatsApp transport | Meta WhatsApp Cloud API | Messages, templates, media and delivery/webhook events |
| Language and reasoning | OpenAI API | Natural-language understanding, response generation and proposed tool selection |
| Business authority | VELLARA backend + Supabase | Tenant authorization, business rules, durable state, transactions and audit |

Retell and Meta are channel adapters. OpenAI is not the database, workflow engine, tenant authorization system, payment processor or booking authority.

## 2. Core invariant

Every customer interaction passes through the same tenant-aware VELLARA orchestration boundary, regardless of whether it starts by phone or WhatsApp.

The model may propose an action. VELLARA independently validates tenant scope, authorization, current data, business rules, confirmation requirements and idempotency before executing it. Model output alone can never establish that a booking, payment, availability check, cancellation, receipt or other action succeeded.

## 3. Request flow

1. Receive Retell or Meta webhook.
2. Verify provider authenticity, timestamp and replay protections.
3. Normalize the event into the VELLARA channel envelope.
4. Deduplicate the provider event.
5. Resolve the provider resource to an active VELLARA channel connection and organization.
6. Load only tenant-owned conversation and business context.
7. Apply channel policy, consent, human-takeover and rate limits.
8. Call OpenAI with bounded context and an allowlisted tool set.
9. Validate any proposed tool call and re-check authorization/business rules.
10. Execute through VELLARA domain services and authoritative transactions.
11. Persist result, conversation state and audit event.
12. Render a channel-specific response and send it through Retell or Meta.

Webhook payloads must never directly select an organization, user, property, reservation or tool permission. Tenant resolution uses a server-owned mapping from a verified provider resource identifier to an active VELLARA connection.

## 4. Normalized channel envelope

The adapters translate provider payloads into one internal event shape. This is an internal contract, not a public client API.

```ts
type Channel = "voice" | "whatsapp";

interface ReceptionistEvent {
  eventId: string;
  providerEventId: string;
  provider: "retell" | "meta";
  channel: Channel;
  providerConnectionId: string;
  providerConversationId: string;
  providerMessageId?: string;
  organizationId: string; // derived by trusted server code, never trusted from webhook body
  occurredAt: string;
  receivedAt: string;
  direction: "inbound" | "outbound" | "system";
  participant: {
    addressE164?: string;
    displayName?: string;
    providerParticipantId?: string;
  };
  content:
    | { kind: "text"; text: string }
    | { kind: "audio_transcript"; text: string; language?: string }
    | { kind: "media_reference"; mediaType: string; opaqueReference: string }
    | { kind: "call_control"; action: string; metadata?: Record<string, unknown> };
  correlationId: string;
}
```

Treat provider payloads, customer text, transcripts, media and model output as untrusted. Validate size, type, timestamp, connection and schema. Do not store raw audio/media by default. Recording and transcript retention require explicit policy. Redact participant addresses in routine logs. Never place provider secrets, OTPs or Supabase credentials in the envelope.

## 5. Tenant and conversation resolution

- Verify provider authenticity before processing instructions.
- Deduplicate using a durable unique key on provider plus provider event ID.
- Resolve the provider connection/resource ID against an active VELLARA channel connection.
- Derive organization ID from that connection in trusted server code.
- Resolve or create the conversation under that organization and channel.
- Confirm the channel is verified, active, not suspended and within current plan entitlement.
- Load only records belonging to that organization and permitted property scope.

If resolution is missing, ambiguous, inactive or cross-tenant, stop. Do not ask the model to guess the tenant or reveal whether another organization owns a resource. A phone-number identity match is not sufficient authorization for sensitive account changes or disclosure.

## 6. OpenAI boundary

The VELLARA orchestrator calls the configured OpenAI API model. Model ID, limits, timeouts, reasoning settings and retention-related configuration must be configurable, not embedded in business logic.

Send only the minimum necessary system policy, business instructions, tenant context, bounded conversation history, channel capabilities and approved tool definitions.

Never send provider API secrets, webhook signing secrets, Supabase service-role credentials, other tenants' data, payment credentials or raw OTPs. Treat model output as untrusted: validate strict schemas, reject unknown tools and malformed arguments, and defend against prompt injection in messages, transcripts, uploads and websites.

## 7. Tool execution

Tools are VELLARA domain operations, never direct SQL or arbitrary HTTP access. Potential tool families include property search/details, availability checks, reservation creation/status/change/cancellation, payment-intent creation/status, mini-website link delivery and human takeover. These remain illustrative until each domain contract and service is approved.

For every tool call:
1. Validate tool name and JSON schema.
2. Bind organization and actor/session from trusted server state, not model arguments.
3. Check tenant and property authorization.
4. Re-read authoritative data; never trust model memory for price, availability, status or payment.
5. Enforce business rules and customer confirmation.
6. Apply idempotency to mutations.
7. Execute through a domain service/database transaction.
8. Persist audit and structured outcome.
9. Return only the minimum safe result to the model.

Mutation outcomes must distinguish accepted, pending, succeeded, failed and requires-confirmation states where applicable. The assistant may claim completion only after the authoritative operation confirms it.

## 8. Channel adapters

### Retell voice
Keep responses concise and speakable. Preserve call/session correlation. Handle interruption, silence, timeout, transfer and termination as explicit states. Do not claim a transfer or call termination until provider state confirms it. Recording/transcription follows configured consent and retention policy. Human takeover blocks AI actions for that session.

### Meta WhatsApp
Respect message-window, template, rate-limit and media constraints. Separate inbound receipt from outbound delivery/read status. Use approved templates when required. Store provider message IDs for deduplication. Do not claim delivery based only on an accepted send request.

Both channels use the same domain tools and business policies. Only presentation and channel capabilities differ.

## 9. Human takeover and concurrency

Conversation control mode: ai_active, handoff_requested, human_active, handoff_failed or closed.

Persist transitions transactionally. When human_active, block new AI tool execution. Use a monotonically increasing conversation version or equivalent concurrency guard so late model responses cannot overwrite newer human actions.

Record who/what requested handoff, reason, time, target queue/user and provider outcome. Resuming AI requires an explicit authorized transition and fresh context load.

## 10. Security and reliability

- Verify Retell and Meta webhooks using their current documented signature procedures.
- Validate timestamps and reject replays outside configured tolerance.
- Use durable idempotency for inbound events, outbound sends and domain mutations.
- Use bounded retries, dead-letter/reconciliation handling and provider outage fallbacks.
- Apply per-tenant, per-channel and per-participant rate limits and cost budgets.
- Correlate webhook, orchestrator, OpenAI, tool and provider operations.
- Log IDs, timings, state transitions and redacted errors, not secrets or unnecessary transcripts.
- Provide tenant-level kill switches for AI, voice and WhatsApp routing.
- Keep credentials in Cloudflare Worker secrets or an approved secret manager. Store only non-secret provider resource references in the database.
- Test RLS and SQL grants independently. Server-only mutations use narrow trusted operations.

## 11. Data model planning

Inventory existing conversation/session tables before creating new ones. Reuse existing structures only if they satisfy tenant isolation and lifecycle needs.

The data model must support tenant-owned conversations with channel/provider references, control mode, status and version; inbound/outbound event records with provider IDs and processing/delivery status; tool execution records with idempotency and authoritative result references; handoff records; and durable provider webhook inbox/outbox processing.

Every tenant-owned record needs organization scope and tested authorization. Property-scoped records also enforce property scope. Never store raw provider secrets, payment credentials or raw OTPs.

## 12. Implementation sequence

1. Inventory existing API routes, tables, migrations and provider code.
2. Define typed event, conversation, tool and adapter interfaces with unit tests.
3. Implement provider-independent orchestration and fake adapters.
4. Implement signed webhook ingestion and durable idempotency in an isolated test environment.
5. Implement OpenAI adapter with mocked responses, then live API integration after cost and data controls are approved.
6. Implement domain tools only after authoritative domain services and authorization tests exist.
7. Add Retell adapter after Ghana number availability, onboarding, pricing and call-control capabilities are confirmed.
8. Add Meta adapter after Business Portfolio/WABA onboarding, permissions, webhook and phone-registration prerequisites are confirmed.
9. Test cross-tenant isolation, replay, concurrency, handoff, timeouts, provider outages, cost limits and false-success prevention.
10. Enable a staging pilot only after secrets, billing, retention policy and rollback/kill-switch procedures are approved.

## 13. Explicit non-goals

This contract does not purchase/port numbers, create provider accounts or paid subscriptions, authorize billable production traffic, add service-role credentials to browser code, authorize production schema/RLS/grant changes, implement business mutations without separate domain contracts, allow direct model database access, or treat provider delivery as proof of business completion.

## 14. Acceptance criteria

- Retell and Meta events normalize to the same internal envelope.
- Invalid signatures, stale timestamps and duplicate events are rejected or safely deduplicated.
- Tenant identity derives from a trusted provider connection, never webhook body fields.
- Cross-tenant identifiers cannot read or mutate another organization's data.
- Inactive, unverified, suspended or over-limit channels cannot invoke the receptionist.
- OpenAI receives bounded tenant context and an allowlisted tool set.
- Prompt injection cannot add tools, change tenant scope or bypass confirmation.
- Mutations are authorized, validated, idempotent and audited.
- Model output cannot fabricate booking/payment/receipt success.
- Human takeover blocks late AI tool calls and stale responses.
- Provider delivery state remains distinct from business transaction state.
- Provider/OpenAI outages produce safe fallback behavior.
- Secrets and sensitive payloads are absent from browser bundles, routine logs and model context.
- RLS, grants, tenant isolation, replay, concurrency and kill-switch tests pass in an isolated environment.
