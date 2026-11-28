export type PropertyVertical = "hospitality" | "real_estate";
export type PropertyPublicationStatus = "draft" | "published" | "unpublished";
export type ReservationStatus = "inquiry" | "pending" | "confirmed" | "checked_in" | "checked_out" | "canceled" | "no_show";

export interface PropertySummary {
  id: string;
  organizationId: string;
  organizationSlug: string;
  propertySlug: string;
  name: string;
  vertical: PropertyVertical;
  operationalStatus: "active" | "inactive" | "archived";
  publicationStatus: PropertyPublicationStatus;
  city: string | null;
  region: string | null;
  countryCode: string;
  currency: string;
  timezone: string;
  coverImageUrl: string | null;
}
export interface RoomTypeSummary {
  id: string;
  propertyId: string;
  name: string;
  description: string | null;
  capacity: number;
  amenities: string[];
  nightlyRateMinor: number | null;
  currency: string;
  isBookable: boolean;
}
export interface AvailabilityRequest {
  propertyId: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  roomTypeId?: string;
  quantity: number;
}
export interface AvailabilityOption {
  roomType: RoomTypeSummary;
  availableQuantity: number;
  nightlyRateMinor: number;
  totalMinor: number;
  currency: string;
}
export interface Quote {
  id: string;
  expiresAt: string;
  subtotalMinor: number;
  taxesMinor: number;
  feesMinor: number;
  totalMinor: number;
  currency: string;
  options: AvailabilityOption[];
}
export interface InventoryHold {
  id: string;
  quoteId: string;
  status: "active" | "expired" | "converted" | "released";
  expiresAt: string;
}
export interface PaymentAttempt {
  id: string;
  holdId: string;
  status: "created" | "pending" | "succeeded" | "failed" | "canceled";
  checkoutUrl: string | null;
  currency: string;
  amountMinor: number;
}
export interface ApiErrorBody {
  error: { code: string; message: string; request_id: string };
}
export interface ApiResult<T> {
  data: T;
  requestId: string | null;
}
