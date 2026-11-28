import { describe, expect, it } from "vitest";
import {
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
  verifyRetellWebhookSignature,
} from "../../src/receptionist/verify-signature";

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("provider webhook signature verification", () => {
  it("accepts a valid Retell signature over raw body plus timestamp", async () => {
    const body = '{"event":"call_started"}';
    const timestamp = "1000000";
    const digest = await sign("retell-webhook-key", body + timestamp);

    await expect(
      verifyRetellWebhookSignature(
        body,
        `v=${timestamp},d=${digest}`,
        "retell-webhook-key",
        1_000_000,
      ),
    ).resolves.toBe(true);
  });

  it("rejects a Retell signature when the raw body changes", async () => {
    const timestamp = "1000000";
    const digest = await sign("retell-webhook-key", '{"event":"call_started"}1000000');

    await expect(
      verifyRetellWebhookSignature(
        '{"event":"call_ended"}',
        `v=${timestamp},d=${digest}`,
        "retell-webhook-key",
        1_000_000,
      ),
    ).resolves.toBe(false);
  });

  it("rejects stale Retell signatures", async () => {
    const body = '{"event":"call_started"}';
    const timestamp = "1000000";
    const digest = await sign("retell-webhook-key", body + timestamp);

    await expect(
      verifyRetellWebhookSignature(
        body,
        `v=${timestamp},d=${digest}`,
        "retell-webhook-key",
        1_301_001,
      ),
    ).resolves.toBe(false);
  });

  it("rejects malformed Retell signature headers", async () => {
    await expect(
      verifyRetellWebhookSignature("{}", "not-a-signature", "key", 1_000_000),
    ).resolves.toBe(false);
  });

  it("accepts a valid Meta signature over the raw body", async () => {
    const body = '{"object":"whatsapp_business_account"}';
    const digest = await sign("meta-app-secret", body);

    await expect(
      verifyMetaWebhookSignature(body, `sha256=${digest}`, "meta-app-secret"),
    ).resolves.toBe(true);
  });

  it("rejects a Meta signature when the body changes", async () => {
    const digest = await sign("meta-app-secret", '{"object":"whatsapp_business_account"}');

    await expect(
      verifyMetaWebhookSignature(
        '{"object":"untrusted"}',
        `sha256=${digest}`,
        "meta-app-secret",
      ),
    ).resolves.toBe(false);
  });

  it("rejects malformed Meta signature headers", async () => {
    await expect(
      verifyMetaWebhookSignature("{}", "sha256=abc", "meta-app-secret"),
    ).resolves.toBe(false);
  });

  it("returns the Meta subscription challenge only for the expected token", () => {
    expect(
      verifyMetaWebhookChallenge("subscribe", "challenge-123", "vellara-token", "vellara-token"),
    ).toBe("challenge-123");
  });

  it("rejects Meta subscription challenges with the wrong mode or token", () => {
    expect(
      verifyMetaWebhookChallenge("unsubscribe", "challenge-123", "vellara-token", "vellara-token"),
    ).toBeNull();
    expect(
      verifyMetaWebhookChallenge("subscribe", "challenge-123", "attacker-token", "vellara-token"),
    ).toBeNull();
  });

  it("rejects empty or oversized Meta challenges", () => {
    expect(
      verifyMetaWebhookChallenge("subscribe", "", "vellara-token", "vellara-token"),
    ).toBeNull();
    expect(
      verifyMetaWebhookChallenge("subscribe", "x".repeat(513), "vellara-token", "vellara-token"),
    ).toBeNull();
  });
});
