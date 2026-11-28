export type PropertyVertical = "hospitality" | "real_estate";
export type PropertyPublicationStatus = "draft" | "published" | "unpublished";

export interface PublicProperty {
  id: string;
  organization_slug: string;
  property_slug: string;
  vertical: PropertyVertical;
  display_name: string;
  description: string | null;
  location: { city: string | null; region: string | null; country_code: string };
  timezone: string;
  currency: string;
  published_at: string;
  media: Array<{ id: string; url: string; alt_text: string | null }>;
}
export interface PublicPropertyResponse { property: PublicProperty }
export interface AvailabilityRequest {
  arrival_date: string;
  departure_date: string;
  guests: { adults: number; children: number };
  room_types: Array<{ room_type_id: string; quantity: number }>;
}
export interface AvailabilityQuote {
  property_id: string;
  currency: string;
  arrival_date: string;
  departure_date: string;
  night_count: number;
  items: Array<{
    room_type_id: string;
    name: string;
    quantity: number;
    available_quantity: number;
    unit_nightly_rate_minor: number;
    line_subtotal_minor: number;
    tax_total_minor: number;
    line_total_minor: number;
  }>;
  total_amount_minor: number;
  quote_expires_at: string;
}
export interface CreateHoldRequest {
  arrival_date: string;
  departure_date: string;
  guest: { full_name: string; phone_e164: string; email?: string | null };
  items: Array<{ room_type_id: string; quantity: number }>;
  quote_reference: string;
}
export interface HoldResponse {
  hold: { id: string; status: "active" | "expired" | "converted" | "released"; expires_at: string };
  currency: string;
  items: Array<{ room_type_id: string; quantity: number; unit_nightly_rate_minor: number; line_total_minor: number }>;
  total_amount_minor: number;
  payment: { required: boolean; next_action: "create_payment_attempt" | string };
}
export interface PaymentAttemptResponse {
  id: string;
  status: "created" | "pending" | "succeeded" | "failed" | "canceled";
  checkout_url: string | null;
  amount_minor: number;
  currency: string;
}
export interface OwnerPropertyResponse {
  id: string;
  publication_status: PropertyPublicationStatus;
}
export interface ApiErrorBody {
  error: { code: string; message: string; request_id: string };
}
export interface ApiResult<T> {
  data: T;
  requestId: string | null;
}
