import type {
  ApiErrorBody,
  ApiResult,
  AvailabilityQuote,
  AvailabilityRequest,
  CreateHoldRequest,
  HoldResponse,
  OwnerPropertyResponse,
  PaymentAttemptResponse,
  PublicPropertyResponse,
} from "./contracts";

export class VellaraApiError extends Error {
  readonly code: string;
  readonly requestId: string | null;
  readonly status: number;
  constructor(message: string, code: string, requestId: string | null, status: number) {
    super(message);
    this.name = "VellaraApiError";
    this.code = code;
    this.requestId = requestId;
    this.status = status;
  }
}
export interface VellaraApi {
  resolvePublicProperty(organizationSlug: string, propertySlug: string): Promise<ApiResult<PublicPropertyResponse>>;
  checkAvailability(organizationSlug: string, propertySlug: string, input: AvailabilityRequest): Promise<ApiResult<AvailabilityQuote>>;
  createHold(organizationSlug: string, propertySlug: string, input: CreateHoldRequest, idempotencyKey: string): Promise<ApiResult<HoldResponse>>;
  createPaymentAttempt(holdId: string, idempotencyKey: string): Promise<ApiResult<PaymentAttemptResponse>>;
  publishProperty(propertyId: string): Promise<ApiResult<OwnerPropertyResponse>>;
}
export interface VellaraApiOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
  fetcher?: typeof fetch;
}
export function createVellaraApi(options: VellaraApiOptions): VellaraApi {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const fetcher = options.fetcher ?? fetch;

  async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
    const token = await options.getAccessToken?.();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetcher(`${baseUrl}/v1${path}`, { ...init, headers, credentials: "include" });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const body = payload as Partial<ApiErrorBody> | null;
      const error = body && typeof body.error === "object" ? body.error : null;
      throw new VellaraApiError(
        error?.message || `VELLARA API request failed (${response.status})`,
        error?.code || "HTTP_ERROR",
        error?.request_id || response.headers.get("x-request-id"),
        response.status,
      );
    }
    if (payload === null || payload === undefined) {
      throw new VellaraApiError("The API returned an empty response.", "INVALID_RESPONSE", response.headers.get("x-request-id"), response.status);
    }
    return { data: payload as T, requestId: response.headers.get("x-request-id") };
  }

  return {
    resolvePublicProperty: (organizationSlug, propertySlug) =>
      request<PublicPropertyResponse>(`/public/properties/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(propertySlug)}`),
    checkAvailability: (organizationSlug, propertySlug, input) =>
      request<AvailabilityQuote>(`/public/properties/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(propertySlug)}/availability`, {
        method: "POST", body: JSON.stringify(input),
      }),
    createHold: (organizationSlug, propertySlug, input, idempotencyKey) =>
      request<HoldResponse>(`/public/properties/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(propertySlug)}/holds`, {
        method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify(input),
      }),
    createPaymentAttempt: (holdId, idempotencyKey) =>
      request<PaymentAttemptResponse>(`/public/holds/${encodeURIComponent(holdId)}/payment-attempts`, {
        method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify({}),
      }),
    publishProperty: (propertyId) =>
      request<OwnerPropertyResponse>(`/owner/properties/${encodeURIComponent(propertyId)}/publish`, { method: "POST" }),
  };
}
