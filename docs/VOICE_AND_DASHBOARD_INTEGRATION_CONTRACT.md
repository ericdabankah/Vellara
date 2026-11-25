# VELLARA voice and dashboard integration contract

## Purpose

The approved Owner Desk incoming-call stage is a production interaction surface, not a decorative demo. When the voice provider and VELLARA AI runtime are connected, this interface must display real call state and expose only actions that the backend confirms are supported for that call.

This document defines the frontend-facing contract boundary. It does not implement or claim a Retell integration, Worker route, webhook, or AI runtime.

## System responsibilities

### Voice/backend service

- Own Retell API credentials and all provider secrets. Never send them to the browser.
- Receive provider webhooks and verify their signatures before trusting events.
- Normalize provider-specific events into the VELLARA event model below.
- Persist call records, call outcomes, AI activity, and reservation/guest changes.
- Enforce organization membership and call ownership on every read and action.
- Execute call actions through the provider only when the call state and provider mode support them.
- Publish authorized updates to the correct organization's live channel.
- Make webhook processing idempotent and tolerate duplicate/out-of-order provider events.

### Supabase

- Remains the source of truth for tenant identity and membership.
- Applies RLS to every exposed tenant-owned table.
- Stores durable business records and approved metrics.
- Must not trust organization IDs supplied by an unauthenticated browser or provider payload.

### Owner Desk frontend

- Authenticates the user and loads only organizations they actively belong to.
- Subscribes only to the selected organization's authorized live updates.
- Renders call states from backend events, not local guesses or timers.
- Sends user actions to approved backend endpoints and reflects success/failure returned by the backend.
- Loads KPI values from persisted, tenant-scoped data or an approved aggregate endpoint.
- Shows a clear disconnected/reconnecting state when live delivery is unavailable.

## Normalized event envelope

All live events should use a stable envelope, independent of Retell's raw webhook shape:

```ts
type VellaraEvent<T> = {
  event_id: string;       // unique and stable for idempotency
  event_type: string;
  organization_id: string;
  occurred_at: string;    // ISO 8601 UTC timestamp
  schema_version: 1;
  data: T;
};
```

The backend must derive and authorize `organization_id`; the frontend must never treat a payload's organization ID as proof of access.

## Call lifecycle events

The frontend needs these normalized event types:

- `call.created`: a new inbound or outbound call exists.
- `call.ringing`: an inbound call is ringing and can be presented to reception.
- `call.answered`: the provider confirms the call is connected.
- `call.updated`: caller identity, guest match, or other safe call metadata changed.
- `call.ended`: the provider confirms the call ended.
- `call.missed`: an inbound call was not answered.
- `call.failed`: call setup or handling failed.

Minimum call data:

```ts
type CallRecord = {
  call_id: string;
  direction: "inbound" | "outbound";
  status: "ringing" | "in_progress" | "completed" | "missed" | "failed";
  caller_number: string | null;
  guest_name: string | null;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  outcome: string | null;
  summary: string | null;
};
```

The call stage must derive its display from the latest confirmed call state. A ringing event may enable supported answer/decline actions. An ended, missed, failed, or completed call must not leave stale controls enabled. The frontend lifecycle reducer lives in `frontend/src/voice/call-state.ts`; it rejects events for another organization, deduplicates event IDs, ignores older events, and selects the most recently active call. It is deliberately not connected to a live channel until the backend event transport and authorization contract are approved.

## AI receptionist activity

Publish `ai.activity` events for meaningful actions performed by the VELLARA brain, for example:

- identifying or matching a guest;
- answering a property question;
- checking room availability;
- creating or changing a reservation;
- escalating to a human;
- completing or failing a task.

Minimum activity data:

```ts
type AiActivity = {
  activity_id: string;
  call_id: string | null;
  category: string;
  label: string;
  status: "started" | "completed" | "failed";
};
```

Do not expose hidden chain-of-thought, private prompts, credentials, or internal model reasoning. Display concise operational summaries only.

## Dashboard data

The dashboard must replace placeholders only with values from an approved, tenant-scoped source. Required initial metrics:

- calls received today;
- reservations created/updated today;
- current room occupancy;
- guest enquiries handled today.

Each metric needs a documented definition, date boundary, timezone, and source. Use the business profile timezone (initial default: `Africa/Accra`) rather than the visitor's device timezone. Unknown values should remain unavailable, not become zero.

## Call actions

Proposed frontend action intents:

- answer an eligible ringing call;
- decline an eligible ringing call;
- end an active call;
- request human handoff, if supported by the selected voice setup.

The backend owner must confirm exact route names, payloads, provider capabilities, and state preconditions before the frontend implements these actions. The frontend must disable actions when a call is not eligible and must not optimistically claim that an action succeeded.

## Live delivery and recovery

- Use an authenticated, organization-scoped Realtime channel or an approved authenticated streaming endpoint.
- Enforce tenant access at the database/channel boundary, not only in React.
- On reconnect, fetch the current call and activity snapshot before resuming incremental events.
- Deduplicate by `event_id` and tolerate out-of-order delivery using event timestamps/versioning.
- If the stream drops, show a reconnecting state and preserve the last known state with a stale indicator.
- Do not fabricate incoming calls or seed fake call history in production.

## Acceptance criteria

1. A real provider call creates one persisted call record and one visible incoming-call state for the correct organization.
2. A user from another organization cannot see the call or subscribe to its events.
3. Answer/decline controls are enabled only for eligible calls and reflect backend-confirmed outcomes.
4. The call stage transitions through ringing, connected, and ended/failed states without a page reload.
5. AI activity appears as concise, timestamped operational updates associated with the correct call.
6. Refreshing the page restores the current call state and recent call history from persisted data.
7. Dashboard metrics match the documented database/aggregate definitions and the property's timezone.
8. Provider webhook retries do not duplicate calls, reservations, or activity records.
9. If Retell or the event stream is unavailable, the UI clearly reports the disconnected state and never presents a preview as a live call.
