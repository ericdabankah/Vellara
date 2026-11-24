# VELLARA Cross-Module Integration Contracts

Status: Draft baseline; not yet approved as deployed API  
Version: 0.1.0  
Applies to: Frontend, backend/AI and database/security modules

> This document defines shared design constraints. It does not claim that any listed endpoint, table, event transport or provider integration currently exists. Concrete implementation details must be approved after repository and Supabase inspection.

## 1. Contract authority

- Backend owns externally callable API semantics and server-side business rules.
- Database/security owns persistence schema, constraints, RLS and storage policies.
- Frontend owns presentation and client interaction, not transaction authority.
- Shared contract changes require review from every affected owner.
- The contract register must be updated before implementation begins.

## 2. Common conventions

### Identity and tenant scope
- Authentication uses the approved identity provider after existing configuration is inspected.
- Backend verifies every access token.
- Backend resolves business membership from trusted server-side data.
- A client-provided business identifier is a requested scope, never proof of membership.
- Database policies independently enforce tenant isolation.

### Time and money
- Timestamps: ISO 8601 UTC.
- IDs: opaque strings; no semantic parsing by clients.
- Money: currency plus integer minor units, unless an ADR approves another exact representation. Never use binary floating-point for authoritative monetary calculations.
- Date-only business values must be distinguished from timestamps.

### API response envelope (proposed)
Success:
```json
{
  "success": true,
  "data": {},
  "meta": { "request_id": "opaque-request-id" }
}
```

Failure:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A safe user-facing message",
    "details": {}
  },
  "meta": { "request_id": "opaque-request-id" }
}
```

This envelope is proposed and must be approved before the first production API is implemented. Error details must not disclose stack traces, SQL, secrets or sensitive provider responses.

Initial error-code vocabulary:
- UNAUTHENTICATED
- FORBIDDEN
- VALIDATION_ERROR
- NOT_FOUND
- CONFLICT
- RATE_LIMITED
- PRECONDITION_FAILED
- PROVIDER_UNAVAILABLE
- INTERNAL_ERROR

## 3. API operation catalogue

Exact routes and payload schemas are intentionally pending repository/runtime inspection and contract approval.

| Domain | Required operations | Authoritative owner |
|---|---|---|
| Identity | Get current user, list authorized business contexts, select active context | Backend + database |
| Business | Read/update permitted business profile and settings | Backend |
| Calls | List active calls, retrieve call, perform permitted call controls | Backend |
| Conversations | List, retrieve and send permitted messages | Backend |
| Customers | Search and retrieve tenant-scoped customer records | Backend |
| Properties/services | List, retrieve and manage business inventory metadata | Backend |
| Availability | Query availability | Backend + database |
| Holds | Create, retrieve, expire and release holds | Backend + database |
| Reservations | Create through approved channel workflow, retrieve, cancel under policy | Backend + database |
| Payments | Initiate, retrieve and reconcile provider transactions | Backend |
| Receipts | Retrieve and deliver issued receipts | Backend |
| Verification | Validate QR token and record permitted check-in/action | Backend + database |
| Staff | Manage staff, roles, PIN lifecycle and permissions | Backend + database |
| Activity | Query tenant-scoped activity and audit views | Backend + database |
| Entitlements | Read and enforce plan limits and connected-number quotas | Backend + database |

Each operation must define HTTP method/path, auth, permission, tenant scope, request/response schema, validation, errors, idempotency, pagination and rate limits.

## 4. Event envelope (proposed)

```json
{
  "event_id": "opaque-unique-event-id",
  "event_type": "call.incoming",
  "occurred_at": "2026-11-24T12:00:00Z",
  "schema_version": 1,
  "business_id": "tenant-reference",
  "entity_type": "call",
  "entity_id": "call-reference",
  "data": {}
}
```

Requirements:
- Producer authenticates event publication.
- Consumers authorize tenant scope.
- Consumers tolerate duplicates, delayed delivery and reconnect replay.
- Consumers track event IDs and entity versions/cursors where applicable.
- Event payloads contain only necessary data.
- Sensitive credentials, payment secrets and unnecessary personal data are prohibited.
- Delivery transport (Supabase Realtime, Worker WebSocket, queue or another mechanism) is not selected until existing architecture is inspected.

## 5. Call state contract (proposed)

Proposed states:
- incoming
- connecting
- active
- on_hold
- transferred
- ended
- missed
- failed

Rules:
- Backend/provider is authoritative for call lifecycle.
- Every call has its own stable ID and independent state.
- Multiple concurrent calls must not overwrite each other.
- State changes are validated against allowed transitions.
- Reconnection/refresh must recover current active calls from an authoritative source.
- Human takeover must be explicit and auditable.
- The frontend transforms the VELLARA hero stage for incoming calls (Option A), while preserving access to the rest of Owner Desk.
- Audio-reactive waveforms require real audio-level data; otherwise motion must be presented as decorative.

The backend lead must validate the lifecycle and event mapping against the chosen telephony provider before freezing this enum.

## 6. Reservation and payment invariants

1. A cart does not reserve inventory.
2. Availability checks are advisory until an atomic hold is created.
3. Hold creation is concurrency-safe and tenant-scoped.
4. Hold expiry is explicit and independent from reminder timing.
5. Payment initiation is server-side and references a valid hold/order context.
6. Payment success requires verified provider/server evidence.
7. Browser redirects are not proof of payment.
8. Reservation confirmation requires valid inventory state and verified payment according to the approved business policy.
9. All retryable create/confirm/webhook operations are idempotent.
10. Late payment after hold expiry enters a reconciliation path; it must not silently overbook.
11. Refunds and exceptional overrides require explicit permission and audit history.

## 7. Human permissions and staff PINs

- Individual staff identities; no shared staff PIN.
- Store only secure PIN hashes using an appropriate password/PIN hashing method.
- Rate-limit and temporarily lock repeated failed attempts.
- PIN reset/revocation must be supported.
- Permissions are checked server-side for every sensitive operation.
- PIN authentication must not bypass normal business membership or tenant scope.
- Refunds, payment overrides and exceptional policy actions require elevated permission/approval.
- Record actor, action, target, time and outcome in an audit trail without storing the PIN.

## 8. Mini-website continuity and trust boundaries

- Customer-facing mini-website uses the same central reservation/payment services as WhatsApp, phone and staff flows.
- Browser prices and availability are untrusted; backend recalculates and validates.
- Linking a website checkout to an originating conversation requires an expiring, unguessable, server-validated reference.
- References must be tenant-scoped, purpose-bound, revocable/expiring and must not expose customer PII.
- Never assume a browser can silently resume a WhatsApp session.
- After confirmed transaction, backend may send an approved confirmation through the original channel when identity and consent rules permit.

## 9. Contract approval register

| Contract | Owner(s) | Status |
|---|---|---|
| Auth/session and business context | All three | Draft |
| API response/error envelope | Frontend + backend | Draft |
| API operation schemas | Backend + frontend + database | Not started |
| Database entities and RLS | Database + backend | Not started |
| Event envelope and transport | Backend + frontend | Draft |
| Call lifecycle/provider mapping | Backend + frontend | Draft |
| Reservation/hold/payment invariants | All three | Draft |
| Staff roles and permission matrix | All three | Draft |
| Mini-website session continuity | All three | Draft |

No contract should be labelled Approved until the responsible developers have reviewed it and recorded the decision.
