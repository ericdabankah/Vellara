const RETELL_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1_000;

function decodeHex(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)),
  );
}

/**
 * Verify Retell's X-Retell-Signature against the untouched request body.
 * The Retell API key must be the key marked with the webhook badge.
 */
export async function verifyRetellWebhookSignature(
  rawBody: string,
  signature: string | null,
  webhookApiKey: string,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!signature || !webhookApiKey) return false;
  const match = signature.match(/^v=(\d+),d=([0-9a-f]{64})$/i);
  if (!match) return false;

  const timestamp = Number(match[1]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowMs - timestamp) > RETELL_TIMESTAMP_TOLERANCE_MS) {
    return false;
  }

  const suppliedDigest = decodeHex(match[2]);
  if (!suppliedDigest) return false;
  const expectedDigest = await hmacSha256(webhookApiKey, rawBody + match[1]);
  return constantTimeEqual(expectedDigest, suppliedDigest);
}

/**
 * Verify Meta's X-Hub-Signature-256 against the untouched request body.
 * This authenticates the payload; event persistence/deduplication is still
 * required because this signature format has no timestamp or replay window.
 */
export async function verifyMetaWebhookSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signature || !appSecret) return false;
  const match = signature.match(/^sha256=([0-9a-f]{64})$/i);
  if (!match) return false;

  const suppliedDigest = decodeHex(match[1]);
  if (!suppliedDigest) return false;
  const expectedDigest = await hmacSha256(appSecret, rawBody);
  return constantTimeEqual(expectedDigest, suppliedDigest);
}

/**
 * Complete Meta's GET webhook subscription handshake. The verification token
 * is a VELLARA-owned secret, not the Meta app secret or an access token.
 * Returns the challenge only when mode and token both match.
 */
export function verifyMetaWebhookChallenge(
  mode: string | null,
  challenge: string | null,
  suppliedToken: string | null,
  expectedToken: string,
): string | null {
  if (mode !== "subscribe" || !challenge || challenge.length > 512) return null;
  if (!suppliedToken || !expectedToken) return null;

  const encoder = new TextEncoder();
  const supplied = encoder.encode(suppliedToken);
  const expected = encoder.encode(expectedToken);
  return constantTimeEqual(supplied, expected) ? challenge : null;
}
