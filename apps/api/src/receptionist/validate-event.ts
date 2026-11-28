import type {
  InboundContent,
  ProviderEventCandidate,
  ReceptionistChannel,
  ReceptionistProvider,
} from "./contracts";

const MAX_ID_LENGTH = 200;
const MAX_TEXT_LENGTH = 8_000;

export class InvalidProviderEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProviderEventError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  value: unknown,
  field: string,
  maxLength = MAX_ID_LENGTH,
): string {
  if (typeof value !== "string") {
    throw new InvalidProviderEventError(`${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new InvalidProviderEventError(`${field} is empty or too long.`);
  }
  return normalized;
}

function optionalString(
  value: unknown,
  field: string,
  maxLength = 200,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredString(value, field, maxLength);
}

function parseContent(value: unknown): InboundContent {
  if (!isRecord(value)) {
    throw new InvalidProviderEventError("content must be an object.");
  }

  switch (value.kind) {
    case "text":
    case "audio_transcript":
      return {
        kind: value.kind,
        text: requiredString(value.text, "content.text", MAX_TEXT_LENGTH),
        ...(value.kind === "audio_transcript"
          ? { language: optionalString(value.language, "content.language", 35) }
          : {}),
      };
    case "media_reference":
      return {
        kind: "media_reference",
        mediaType: requiredString(value.mediaType, "content.mediaType", 100),
        // This must be an opaque provider reference, never a fetched URL.
        opaqueReference: requiredString(value.opaqueReference, "content.opaqueReference"),
      };
    case "call_control":
      return {
        kind: "call_control",
        action: requiredString(value.action, "content.action", 100),
      };
    default:
      throw new InvalidProviderEventError("Unsupported content kind.");
  }
}

/**
 * Validates shape and bounds only. It does not verify signatures, replay windows,
 * provider ownership, tenant mapping, or channel entitlement.
 */
export function validateProviderEventCandidate(
  input: unknown,
): ProviderEventCandidate {
  if (!isRecord(input)) {
    throw new InvalidProviderEventError("Provider event must be an object.");
  }

  const provider = requiredString(input.provider, "provider", 20) as ReceptionistProvider;
  const channel = requiredString(input.channel, "channel", 20) as ReceptionistChannel;

  if (
    (provider === "retell" && channel !== "voice") ||
    (provider === "meta" && channel !== "whatsapp") ||
    !["retell", "meta"].includes(provider) ||
    !["voice", "whatsapp"].includes(channel)
  ) {
    throw new InvalidProviderEventError("Provider and channel combination is not supported.");
  }

  const occurredAt = requiredString(input.occurredAt, "occurredAt", 40);
  if (
    !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?(?:Z|[+-]\\d{2}:\\d{2})$/.test(occurredAt) ||
    !Number.isFinite(Date.parse(occurredAt))
  ) {
    throw new InvalidProviderEventError("occurredAt must be an ISO-8601 timestamp with an explicit timezone.");
  }

  const direction = requiredString(input.direction, "direction", 20);
  if (!["inbound", "outbound", "system"].includes(direction)) {
    throw new InvalidProviderEventError("direction is not supported.");
  }

  if (!isRecord(input.participant)) {
    throw new InvalidProviderEventError("participant must be an object.");
  }

  const addressE164 = optionalString(input.participant.addressE164, "participant.addressE164", 16);
  if (addressE164 && !/^\+[1-9][0-9]{7,14}$/.test(addressE164)) {
    throw new InvalidProviderEventError("participant.addressE164 must be canonical E.164.");
  }

  return {
    provider,
    channel,
    providerEventId: requiredString(input.providerEventId, "providerEventId"),
    providerConnectionId: requiredString(input.providerConnectionId, "providerConnectionId"),
    providerConversationId: requiredString(input.providerConversationId, "providerConversationId"),
    providerMessageId: optionalString(input.providerMessageId, "providerMessageId"),
    occurredAt: new Date(occurredAt).toISOString(),
    direction: direction as ProviderEventCandidate["direction"],
    participant: {
      addressE164,
      displayName: optionalString(input.participant.displayName, "participant.displayName", 120),
      providerParticipantId: optionalString(
        input.participant.providerParticipantId,
        "participant.providerParticipantId",
      ),
    },
    content: parseContent(input.content),
  };
}
