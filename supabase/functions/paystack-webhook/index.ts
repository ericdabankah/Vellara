const MAX_BODY_BYTES = 256 * 1024;
const SIGNATURE_TOLERANCE_SECONDS = 300;

const BILLING_EVENTS = new Set([
  "charge.success",
  "subscription.create",
  "subscription.disable",
  "subscription.not_renew",
  "invoice.create",
  "invoice.update",
  "invoice.payment_failed",
]);

type PaystackEvent = {
  event: string;
  data: Record<string, unknown>;
};

type Environment = {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEYS: string;
  PAYSTACK_WEBHOOK_SECRET: string;
  PAYSTACK_SECRET_KEY?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]{128}$/i.test(hex)) return null;
  const bytes = new Uint8Array(64);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) {
    difference |= left[i] ^ right[i];
  }
  return difference === 0;
}

async function hmacSha512(secret: string, message: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
}

function parseTimestampedSignature(header: string): {
  timestamp: number;
  signatures: string[];
} | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === "t") {
      if (timestamp !== null || !/^\d{1,12}$/.test(value)) return null;
      timestamp = Number(value);
    } else if (key === "v1") {
      const colon = value.indexOf(":");
      if (colon < 1) continue;
      const keyId = value.slice(0, colon);
      const signature = value.slice(colon + 1);
      if (/^whk_[A-Za-z0-9_-]+$/.test(keyId) && /^[0-9a-f]{128}$/i.test(signature)) {
        signatures.push(signature.toLowerCase());
      }
    }
  }

  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}

export async function verifyPaystackWebhookSignature(
  rawBody: Uint8Array,
  headers: Headers,
  webhookSecret: string,
  legacySecret?: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const currentHeader = headers.get("paystack-signature");

  // When Paystack sends its current signing-secret header, it takes precedence.
  // Do not fall back to the legacy header if the current signature is present but invalid.
  if (currentHeader) {
    const parsed = parseTimestampedSignature(currentHeader);
    if (!parsed || Math.abs(nowSeconds - parsed.timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
      return false;
    }

    const prefix = new TextEncoder().encode(String(parsed.timestamp) + ".");
    const signedMessage = new Uint8Array(prefix.length + rawBody.length);
    signedMessage.set(prefix, 0);
    signedMessage.set(rawBody, prefix.length);

    const expected = await hmacSha512(webhookSecret, signedMessage);
    return parsed.signatures.some((signature) => {
      const received = hexToBytes(signature);
      return received !== null && constantTimeEqual(expected, received);
    });
  }

  // Legacy X-Paystack-Signature signs only the exact raw request body.
  const legacyHeader = headers.get("x-paystack-signature");
  if (!legacyHeader || !legacySecret || !/^[0-9a-f]{128}$/i.test(legacyHeader)) {
    return false;
  }

  const expected = await hmacSha512(legacySecret, rawBody);
  const received = hexToBytes(legacyHeader.toLowerCase());
  return received !== null && constantTimeEqual(expected, received);
}

function safeText(value: unknown, maxLength = 200): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function safeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function sanitizedPayload(event: PaystackEvent): Record<string, unknown> {
  const data = event.data;
  const metadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
    ? data.metadata as Record<string, unknown>
    : {};

  const billingAttemptId = safeText(metadata.billing_attempt_id, 64);
  const safeData: Record<string, unknown> = {};

  for (const key of [
    "id",
    "reference",
    "status",
    "amount",
    "currency",
    "subscription_code",
    "customer_code",
    "plan",
    "invoice_code",
    "paid_at",
    "created_at",
    "period_start",
    "period_end",
    "next_payment_date",
  ]) {
    const value = data[key];
    if (typeof value === "string") {
      const safe = safeText(value, 200);
      if (safe !== null) safeData[key] = safe;
    } else if (typeof value === "number") {
      const safe = safeInteger(value);
      if (safe !== null) safeData[key] = safe;
    }
  }

  if (billingAttemptId && /^[0-9a-f-]{36}$/i.test(billingAttemptId)) {
    // This is only a correlation hint. It is not trusted as proof of tenant ownership.
    safeData.billing_attempt_id = billingAttemptId;
  }

  return { event: event.event, data: safeData };
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", value));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function providerEventId(event: PaystackEvent, rawBody: Uint8Array): Promise<string> {
  const providerResourceId = event.data.id;
  if (
    (typeof providerResourceId === "string" && providerResourceId.length > 0) ||
    (typeof providerResourceId === "number" && Number.isSafeInteger(providerResourceId))
  ) {
    return event.event + ":" + String(providerResourceId);
  }
  return event.event + ":sha256:" + await sha256Hex(rawBody);
}

function getBillingSecret(env: Environment): string | null {
  try {
    const keys = JSON.parse(env.SUPABASE_SECRET_KEYS) as Record<string, unknown>;
    return typeof keys.billing === "string" && keys.billing.length > 0 ? keys.billing : null;
  } catch {
    return null;
  }
}

async function persistEvent(
  env: Environment,
  event: PaystackEvent,
  rawBody: Uint8Array,
): Promise<void> {
  const secretKey = getBillingSecret(env);
  if (!secretKey) throw new Error("billing_database_key_missing");

  const projectUrl = new URL(env.SUPABASE_URL);
  const endpoint = new URL("/rest/v1/subscription_provider_events", projectUrl);
  endpoint.searchParams.set("on_conflict", "provider,provider_event_id");

  const providerEventIdValue = await providerEventId(event, rawBody);
  const row = {
    provider: "paystack",
    provider_event_id: providerEventIdValue,
    event_type: event.event,
    organization_id: null,
    payload: sanitizedPayload(event),
    processing_status: "received",
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: secretKey,
      "content-type": "application/json",
      prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    // Do not log provider payloads, credentials, or raw database errors.
    throw new Error("billing_event_persist_failed_" + response.status);
  }
}

export async function handlePaystackWebhook(
  request: Request,
  env: Environment,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }

  if (!env.PAYSTACK_WEBHOOK_SECRET) {
    return json({ error: "webhook_not_configured" }, 503);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (rawBody.length === 0 || rawBody.length > MAX_BODY_BYTES) {
    return json({ error: "invalid_payload_size" }, 413);
  }

  const signatureValid = await verifyPaystackWebhookSignature(
    rawBody,
    request.headers,
    env.PAYSTACK_WEBHOOK_SECRET,
    env.PAYSTACK_SECRET_KEY,
  );
  if (!signatureValid) {
    return json({ error: "invalid_signature" }, 401);
  }

  let event: unknown;
  try {
    event = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (
    !event ||
    typeof event !== "object" ||
    Array.isArray(event) ||
    typeof (event as Record<string, unknown>).event !== "string" ||
    !(event as Record<string, unknown>).data ||
    typeof (event as Record<string, unknown>).data !== "object" ||
    Array.isArray((event as Record<string, unknown>).data)
  ) {
    return json({ error: "invalid_event_shape" }, 400);
  }

  const parsedEvent = event as PaystackEvent;
  if (!BILLING_EVENTS.has(parsedEvent.event)) {
    // Acknowledge unrelated Paystack events without changing VELLARA billing state.
    return json({ received: true, ignored: true });
  }

  try {
    await persistEvent(env, parsedEvent, rawBody);
    return json({ received: true });
  } catch (error) {
    console.error(JSON.stringify({
      message: "Paystack webhook persistence failed",
      reason: error instanceof Error ? error.message : "unknown_error",
    }));
    // Non-2xx lets Paystack retry transient persistence failures.
    return json({ error: "event_persistence_unavailable" }, 500);
  }
}

Deno.serve((request: Request) => {
  const env: Environment = {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? "",
    SUPABASE_SECRET_KEYS: Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}",
    PAYSTACK_WEBHOOK_SECRET: Deno.env.get("PAYSTACK_WEBHOOK_SECRET") ?? "",
    PAYSTACK_SECRET_KEY: Deno.env.get("PAYSTACK_SECRET_KEY") ?? undefined,
  };

  if (!env.SUPABASE_URL) {
    return json({ error: "webhook_not_configured" }, 503);
  }
  return handlePaystackWebhook(request, env);
});
