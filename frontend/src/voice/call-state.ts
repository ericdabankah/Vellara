export type CallStatus = "ringing" | "in_progress" | "completed" | "missed" | "failed";
export type CallDirection = "inbound" | "outbound";

export type CallRecord = {
  call_id: string;
  direction: CallDirection;
  status: CallStatus;
  caller_number: string | null;
  guest_name: string | null;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  outcome: string | null;
  summary: string | null;
};

export type CallEventType =
  | "call.created"
  | "call.ringing"
  | "call.answered"
  | "call.updated"
  | "call.ended"
  | "call.missed"
  | "call.failed";

export type CallEvent = {
  event_id: string;
  event_type: CallEventType;
  organization_id: string;
  occurred_at: string;
  schema_version: 1;
  data: CallRecord;
};

export type CallLifecycleState = {
  organizationId: string;
  callsById: Record<string, CallRecord>;
  lastEventAtByCallId: Record<string, string>;
  processedEventIds: string[];
};

export function createCallLifecycleState(organizationId: string): CallLifecycleState {
  return {
    organizationId,
    callsById: {},
    lastEventAtByCallId: {},
    processedEventIds: [],
  };
}

const STATUS_BY_EVENT: Record<CallEventType, CallStatus | null> = {
  "call.created": null,
  "call.ringing": "ringing",
  "call.answered": "in_progress",
  "call.updated": null,
  "call.ended": "completed",
  "call.missed": "missed",
  "call.failed": "failed",
};

const TERMINAL_STATUSES = new Set<CallStatus>(["completed", "missed", "failed"]);

export function reduceCallEvent(
  state: CallLifecycleState,
  event: CallEvent,
): CallLifecycleState {
  if (
    event.schema_version !== 1 ||
    event.organization_id !== state.organizationId ||
    !event.event_id ||
    !event.data?.call_id ||
    !Number.isFinite(Date.parse(event.occurred_at)) ||
    state.processedEventIds.includes(event.event_id)
  ) {
    return state;
  }

  const callId = event.data.call_id;
  const previous = state.callsById[callId];
  const previousEventAt = state.lastEventAtByCallId[callId];

  // Ignore late delivery so an old ringing/answered event cannot revive a call.
  if (previousEventAt && Date.parse(event.occurred_at) < Date.parse(previousEventAt)) {
    return {
      ...state,
      processedEventIds: [...state.processedEventIds, event.event_id].slice(-200),
    };
  }

  // Once terminal, only a strictly newer call.created event can establish a new
  // lifecycle for the same provider call ID (normally provider IDs are unique).
  if (
    previous &&
    TERMINAL_STATUSES.has(previous.status) &&
    event.event_type !== "call.created"
  ) {
    return {
      ...state,
      processedEventIds: [...state.processedEventIds, event.event_id].slice(-200),
    };
  }

  const eventStatus = STATUS_BY_EVENT[event.event_type];
  const nextStatus = eventStatus ?? event.data.status;
  const nextCall: CallRecord = {
    ...(previous ?? event.data),
    ...event.data,
    status: nextStatus,
  };

  return {
    ...state,
    callsById: { ...state.callsById, [callId]: nextCall },
    lastEventAtByCallId: {
      ...state.lastEventAtByCallId,
      [callId]: event.occurred_at,
    },
    processedEventIds: [...state.processedEventIds, event.event_id].slice(-200),
  };
}

export function selectCurrentCall(state: CallLifecycleState): CallRecord | null {
  const calls = Object.values(state.callsById);
  const active = calls.filter((call) => call.status === "ringing" || call.status === "in_progress");
  active.sort((a, b) => {
    const aTime = Date.parse(state.lastEventAtByCallId[a.call_id] ?? a.started_at);
    const bTime = Date.parse(state.lastEventAtByCallId[b.call_id] ?? b.started_at);
    return bTime - aTime;
  });
  return active[0] ?? null;
}
