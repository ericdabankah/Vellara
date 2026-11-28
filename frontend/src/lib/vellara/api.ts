import type { ApiErrorBody, ApiResult, AvailabilityRequest, InventoryHold, PaymentAttempt, PropertySummary, Quote } from "./contracts";

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
  listProperties(): Promise<ApiResult<PropertySummary[]>>;
  resolvePublicProperty(organizationSlug: string, propertySlug: string): Promise<ApiResult<PropertySummary>>;
  createQuote(input: AvailabilityRequest): Promise<ApiResult<Quote>>;
  createHold(quoteId: string): Promise<ApiResult<InventoryHold>>;
  createPaymentAttempt(holdId: string): Promise<ApiResult<PaymentAttempt>>;
  publishProperty(propertyId: string): Promise<ApiResult<PropertySummary>>;
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
    // VELLARA's agreed API convention is a direct JSON success object, not a data envelope.
    return { data: payload as T, requestId: response.headers.get("x-request-id") };
  }
  return {
    listProperties: () => request<PropertySummary[]>("/owner/properties"),
    resolvePublicProperty: (organizationSlug, propertySlug) =>
      request<PropertySummary>(`/public/properties/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(propertySlug)}`),
    createQuote: (input) => request<Quote>("/hospitality/quotes", { method: "POST", body: JSON.stringify(input) }),
    createHold: (quoteId) => request<InventoryHold>("/hospitality/holds", { method: "POST", body: JSON.stringify({ quoteId }) }),
    createPaymentAttempt: (holdId) => request<PaymentAttempt>("/payments/attempts", { method: "POST", body: JSON.stringify({ holdId }) }),
    publishProperty: (propertyId) => request<PropertySummary>(`/owner/properties/${encodeURIComponent(propertyId)}/publish`, { method: "POST" }),
  };
}
