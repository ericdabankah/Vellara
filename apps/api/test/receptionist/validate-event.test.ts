import { describe, expect, it } from "vitest";
import {
  InvalidProviderEventError,
  validateProviderEventCandidate,
} from "../../src/receptionist/validate-event";

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    provider: "meta",
    channel: "whatsapp",
    providerEventId: "evt_123",
    providerConnectionId: "conn_123",
    providerConversationId: "conv_123",
    occurredAt: "2026-11-28T10:30:00.000Z",
    direction: "inbound",
    participant: {
      addressE164: "+233241234567",
      displayName: "Guest",
    },
    content: { kind: "text", text: "I need a room tonight." },
    ...overrides,
  };
}

describe("validateProviderEventCandidate", () => {
  it("normalizes a valid Meta WhatsApp event", () => {
    const event = validateProviderEventCandidate(validEvent());

    expect(event.provider).toBe("meta");
    expect(event.channel).toBe("whatsapp");
    expect(event.occurredAt).toBe("2026-11-28T10:30:00.000Z");
    expect(event.participant.addressE164).toBe("+233241234567");
  });

  it("rejects unsupported provider and channel combinations", () => {
    expect(() =>
      validateProviderEventCandidate(validEvent({ provider: "retell" })),
    ).toThrow(InvalidProviderEventError);
  });

  it("requires an explicit timezone in occurredAt", () => {
    expect(() =>
      validateProviderEventCandidate(
        validEvent({ occurredAt: "2026-11-28T10:30:00" }),
      ),
    ).toThrow(/explicit timezone/);
  });

  it("rejects impossible calendar dates instead of allowing Date.parse rollover", () => {
    expect(() =>
      validateProviderEventCandidate(
        validEvent({ occurredAt: "2026-02-30T10:30:00Z" }),
      ),
    ).toThrow(/invalid calendar date/);
  });

  it("rejects non-canonical participant phone numbers", () => {
    expect(() =>
      validateProviderEventCandidate(
        validEvent({
          participant: { addressE164: "0241234567" },
        }),
      ),
    ).toThrow(/canonical E.164/);
  });

  it("rejects oversized message content", () => {
    expect(() =>
      validateProviderEventCandidate(
        validEvent({
          content: { kind: "text", text: "x".repeat(8_001) },
        }),
      ),
    ).toThrow(/too long/);
  });

  it("rejects unknown content variants", () => {
    expect(() =>
      validateProviderEventCandidate(
        validEvent({ content: { kind: "arbitrary_payload", value: "x" } }),
      ),
    ).toThrow(/Unsupported content kind/);
  });

  it("does not accept a tenant identifier from the provider payload", () => {
    const event = validateProviderEventCandidate(
      validEvent({ organizationId: "attacker-controlled-tenant" }),
    );

    expect(event).not.toHaveProperty("organizationId");
  });
});
