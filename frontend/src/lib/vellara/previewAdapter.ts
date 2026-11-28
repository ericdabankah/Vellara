import type { ApiResult, AvailabilityRequest, InventoryHold, PaymentAttempt, PropertySummary, Quote, RoomTypeSummary } from "./contracts";
import type { VellaraApi } from "./api";

// Explicitly for the isolated /preview experience. Never use as a production fallback.
const property: PropertySummary = {
  id: "preview-property-001",
  organizationId: "preview-organization",
  organizationSlug: "sample-hospitality",
  propertySlug: "the-palm-residence",
  name: "The Palm Residence",
  vertical: "hospitality",
  operationalStatus: "active",
  publicationStatus: "draft",
  city: "Accra",
  region: "Greater Accra",
  countryCode: "GH",
  currency: "GHS",
  timezone: "Africa/Accra",
  coverImageUrl: null,
};
const roomType: RoomTypeSummary = {
  id: "preview-room-type-001",
  propertyId: property.id,
  name: "Deluxe King Room",
  description: "A sample room type for interface demonstrations.",
  capacity: 2,
  amenities: ["Wi-Fi", "Air conditioning", "Breakfast"],
  nightlyRateMinor: 85000,
  currency: "GHS",
  isBookable: true,
};
const result = <T,>(data: T): ApiResult<T> => ({ data, requestId: "preview-only" });

export function createPreviewVellaraApi(): VellaraApi {
  return {
    async listProperties() { return result([property]); },
    async resolvePublicProperty() { return result(property); },
    async createQuote(input: AvailabilityRequest) {
      const nights = Math.max(1, Math.round((Date.parse(input.departureDate) - Date.parse(input.arrivalDate)) / 86_400_000));
      const total = (roomType.nightlyRateMinor ?? 0) * nights * input.quantity;
      const quote: Quote = {
        id: "preview-quote-001",
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        subtotalMinor: total, taxesMinor: 0, feesMinor: 0, totalMinor: total,
        currency: roomType.currency,
        options: [{ roomType, availableQuantity: 2, nightlyRateMinor: roomType.nightlyRateMinor ?? 0, totalMinor: total, currency: roomType.currency }],
      };
      return result(quote);
    },
    async createHold(quoteId) {
      const hold: InventoryHold = { id: "preview-hold-001", quoteId, status: "active", expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() };
      return result(hold);
    },
    async createPaymentAttempt(holdId) {
      const attempt: PaymentAttempt = { id: "preview-payment-001", holdId, status: "created", checkoutUrl: null, currency: property.currency, amountMinor: 85000 };
      return result(attempt);
    },
    async publishProperty() { return result({ ...property, publicationStatus: "published" }); },
  };
}
