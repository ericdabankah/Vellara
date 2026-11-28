import {
  handlePaystackWebhook,
  verifyPaystackWebhookSignature,
} from "./index.ts";

const encoder = new TextEncoder();

async function sign(secret: string, message: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.test("verifies current timestamped Paystack-Signature", async () => {
  const body = encoder.encode('{"event":"charge.success","data":{"id":42}}');
  const timestamp = 1_800_000_000;
  const prefix = encoder.encode(timestamp + ".");
  const message = new Uint8Array(prefix.length + body.length);
  message.set(prefix);
  message.set(body, prefix.length);
  const signature = await sign("whsec_test", message);
  const headers = new Headers({
    "paystack-signature": "t=" + timestamp + ",v1=whk_test:" + signature,
  });

  const valid = await verifyPaystackWebhookSignature(
    body,
    headers,
    "whsec_test",
    undefined,
    timestamp,
  );
  if (!valid) throw new Error("Expected current signature to validate");
});

Deno.test("rejects stale timestamped Paystack-Signature", async () => {
  const body = encoder.encode('{"event":"charge.success","data":{"id":42}}');
  const timestamp = 1_800_000_000;
  const prefix = encoder.encode(timestamp + ".");
  const message = new Uint8Array(prefix.length + body.length);
  message.set(prefix);
  message.set(body, prefix.length);
  const signature = await sign("whsec_test", message);
  const headers = new Headers({
    "paystack-signature": "t=" + timestamp + ",v1=whk_test:" + signature,
  });

  const valid = await verifyPaystackWebhookSignature(
    body,
    headers,
    "whsec_test",
    undefined,
    timestamp + 301,
  );
  if (valid) throw new Error("Expected stale signature to be rejected");
});

Deno.test("verifies legacy X-Paystack-Signature against raw bytes", async () => {
  const body = encoder.encode('{ "event" : "charge.success", "data" : {"id":42} }');
  const signature = await sign("sk_test_example", body);
  const headers = new Headers({ "x-paystack-signature": signature });

  const valid = await verifyPaystackWebhookSignature(
    body,
    headers,
    "whsec_test",
    "sk_test_example",
  );
  if (!valid) throw new Error("Expected legacy signature to validate");
});

Deno.test("does not fall back to legacy header when current header is present but invalid", async () => {
  const body = encoder.encode('{"event":"charge.success","data":{"id":42}}');
  const legacySignature = await sign("sk_test_example", body);
  const headers = new Headers({
    "paystack-signature": "t=1800000000,v1=whk_test:" + "0".repeat(128),
    "x-paystack-signature": legacySignature,
  });

  const valid = await verifyPaystackWebhookSignature(
    body,
    headers,
    "whsec_test",
    "sk_test_example",
    1_800_000_000,
  );
  if (valid) throw new Error("Expected invalid current signature to fail closed");
});

Deno.test("rejects invalid signatures without writing to Supabase", async () => {
  const body = encoder.encode('{"event":"charge.success","data":{"id":42}}');
  const request = new Request("https://example.test/functions/v1/paystack-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "paystack-signature": "t=1800000000,v1=whk_test:" + "0".repeat(128),
    },
    body,
  });
  const response = await handlePaystackWebhook(request, {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEYS: "{}",
    PAYSTACK_WEBHOOK_SECRET: "whsec_test",
    PAYSTACK_SECRET_KEY: "sk_test_example",
  });
  if (response.status !== 401) {
    throw new Error("Expected 401 for invalid signature, received " + response.status);
  }
});
