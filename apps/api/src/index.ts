type AuthenticatedUser = {
  id: string;
  email?: string;
  phone?: string;
};

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "METHOD_NOT_ALLOWED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  const headers = new Headers(JSON_HEADERS);
  new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(data), { status, headers });
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(env.WEB_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean));
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, x-request-id",
    "access-control-max-age": "600",
    vary: "Origin",
  });
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set("access-control-allow-origin", origin);
  }
  return headers;
}

function requestId(request: Request): string {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9._-]{8,80}$/.test(supplied) ? supplied : crypto.randomUUID();
}

function bearerToken(request: Request): string {
  const match = request.headers.get("Authorization")?.match(/^Bearer ([^\s]+)$/i);
  if (!match) throw new ApiError(401, "UNAUTHORIZED", "A valid bearer token is required.");
  return match[1];
}

function supabaseUrl(env: Env, path: string): string {
  return new URL(path, env.SUPABASE_URL).toString();
}

async function authenticate(token: string, env: Env): Promise<AuthenticatedUser> {
  let response: Response;
  try {
    response = await fetch(supabaseUrl(env, "/auth/v1/user"), {
      method: "GET",
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        authorization: "Bearer " + token,
        accept: "application/json",
      },
    });
  } catch {
    throw new ApiError(502, "UPSTREAM_ERROR", "Identity verification is temporarily unavailable.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApiError(401, "UNAUTHORIZED", "Your session is invalid or has expired.");
  }
  if (!response.ok) {
    throw new ApiError(502, "UPSTREAM_ERROR", "Identity verification is temporarily unavailable.");
  }

  const user = (await response.json()) as AuthenticatedUser;
  if (!user?.id) throw new ApiError(401, "UNAUTHORIZED", "Your session could not be verified.");
  return user;
}

async function supabaseUserRequest<T>(
  env: Env,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("apikey", env.SUPABASE_PUBLISHABLE_KEY);
  headers.set("authorization", "Bearer " + token);
  headers.set("accept", "application/json");
  if (init.body) headers.set("content-type", "application/json");

  let response: Response;
  try {
    response = await fetch(supabaseUrl(env, path), { ...init, headers });
  } catch {
    throw new ApiError(502, "UPSTREAM_ERROR", "The data service is temporarily unavailable.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApiError(403, "FORBIDDEN", "You are not permitted to access this resource.");
  }
  if (!response.ok) {
    // Never return raw Postgres/PostgREST errors to callers.
    throw new ApiError(502, "UPSTREAM_ERROR", "The data service could not complete the request.");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(400, "VALIDATION_ERROR", "Content-Type must be application/json.");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 16_384) {
    throw new ApiError(413, "VALIDATION_ERROR", "Request body is too large.");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "VALIDATION_ERROR", "Request body is required.");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    totalBytes += part.value.byteLength;
    if (totalBytes > 16_384) {
      await reader.cancel();
      throw new ApiError(413, "VALIDATION_ERROR", "Request body is too large.");
    }
    chunks.push(part.value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

function validateCreateOrganization(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const businessType =
    typeof body.business_type === "string" ? body.business_type.trim().toLowerCase() : "";

  if (name.length < 2 || name.length > 120) {
    throw new ApiError(400, "VALIDATION_ERROR", "Business name must be between 2 and 120 characters.");
  }
  if (!["hotel", "real_estate", "other"].includes(businessType)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Business type must be hotel, real_estate, or other.");
  }

  const timezone = typeof body.timezone === "string" ? body.timezone.trim() : "Africa/Accra";
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "GHS";
  if (timezone.length < 1 || timezone.length > 80) {
    throw new ApiError(400, "VALIDATION_ERROR", "Timezone must be between 1 and 80 characters.");
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Currency must be a three-letter code.");
  }

  return { name, business_type: businessType, timezone, currency };
}

async function handleRoute(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === "GET" && url.pathname === "/health") {
    return json({ status: "ok", service: "vellara-api", version: "v1" });
  }

  if (!["GET", "POST"].includes(request.method)) {
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  const token = bearerToken(request);
  const user = await authenticate(token, env);

  if (request.method === "GET" && url.pathname === "/v1/me") {
    const profiles = await supabaseUserRequest<Array<{
      id: string;
      display_name: string | null;
      phone_e164: string | null;
      avatar_path: string | null;
    }>>(
      env,
      token,
      "/rest/v1/profiles?select=id,display_name,phone_e164,avatar_path&id=eq." +
        encodeURIComponent(user.id) +
        "&limit=1",
    );

    return json({
      user: { id: user.id, email: user.email ?? null, phone: user.phone ?? null },
      profile: profiles[0] ?? null,
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/organizations") {
    const memberships = await supabaseUserRequest<Array<{
      organization_id: string;
      role: string;
      status: string;
      organizations: {
        id: string;
        name: string;
        status: string;
        business_profiles: {
          display_name: string;
          business_type: string;
          timezone: string;
          currency: string;
        } | null;
      } | null;
    }>>(
      env,
      token,
      "/rest/v1/organization_memberships?select=organization_id,role,status,organizations(id,name,status,business_profiles(display_name,business_type,timezone,currency))" +
        "&user_id=eq." + encodeURIComponent(user.id) +
        "&status=eq.active&order=created_at.asc",
    );

    return json({ organizations: memberships });
  }

  if (request.method === "POST" && url.pathname === "/v1/organizations") {
    const body = validateCreateOrganization(await readJsonObject(request));
    const result = await supabaseUserRequest<string>(
      env,
      token,
      "/rest/v1/rpc/create_organization",
      {
        method: "POST",
        body: JSON.stringify({
          p_name: body.name,
          p_business_type: body.business_type,
          p_timezone: body.timezone,
          p_currency: body.currency,
        }),
      },
    );

    return json({ organization_id: result }, 201);
  }

  throw new ApiError(404, "NOT_FOUND", "Route not found.");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = requestId(request);
    const cors = corsHeaders(request, env);
    const origin = request.headers.get("Origin");

    if (origin && !allowedOrigins(env).has(origin)) {
      return json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Origin is not allowed.",
            request_id: id,
          },
        },
        403,
        { "x-request-id": id },
      );
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const response = await handleRoute(request, env, new URL(request.url));
      const headers = new Headers(response.headers);
      cors.forEach((value, key) => headers.set(key, value));
      headers.set("x-request-id", id);
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred.");

      console.error(JSON.stringify({
        message: "VELLARA API request failed",
        request_id: id,
        status: apiError.status,
        code: apiError.code,
      }));

      return json(
        {
          error: {
            code: apiError.code,
            message: apiError.message,
            request_id: id,
          },
        },
        apiError.status,
        { ...Object.fromEntries(cors), "x-request-id": id },
      );
    }
  },
} satisfies ExportedHandler<Env>;
