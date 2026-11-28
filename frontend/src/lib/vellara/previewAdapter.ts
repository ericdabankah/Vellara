import type {
  ApiResult,
  AvailabilityQuote,
  AvailabilityRequest,
  CreateHoldRequest,
  HoldResponse,
  OwnerPropertyResponse,
  PaymentAttemptResponse,
  PublicPropertyResponse,
} from "./contracts";
import type { VellaraApi } from "./api";

// Explicitly for the isolated /preview experience. Never use as a production fallback.
const property: PublicPropertyResponse = {
  property: {
    id: "preview-property-001",
    organization_slug: "sample-hospitality",
    property_slug: "the-palm-residence",
    vertical: "hospitality",
    display_name: "The Palm Residence",
    description: "Sample hospitality property used to demonstrate the VELLARA booking journey.",
    location: { city: "Accra", region: "Greater Accra", country_code: "GH" },
    timezone: "Africa/Accra",
    currency: "GHS",
    published_at: new Date(0).toISOString(),
    media: [],
  },
};
const result = <T,>(data: T): ApiResult<T> => ({ data, requestId: "preview-only" });

export function createPreviewVellaraApi(): VellaraApi {
  return {
    async resolvePublicProperty() {
      return result(property);
    },
    async checkAvailability(_organizationSlug: string, _propertySlug: string, input: AvailabilityRequest) {
      const arrival = Date.parse(input.arrival_date);
      const departure = Date.parse(input.departure_date);
      const nights = Number.isFinite(arrival) && Number.isFinite(departure) && departure > arrival
        ? Math.round((departure - arrival) / 86_400_000)
        : 0;
      const items = input.room_types.map((item) => ({
        room_type_id: item.room_type_id,
        name: "Deluxe King Room",
        quantity: item.quantity,
        available_quantity: 2,
        unit_nightly_rate_minor: 85000,
        line_subtotal_minor: 85000 * nights * item.quantity,
        tax_total_minor: 0,
        line_total_minor: 85000 * nights * item.quantity,
      }));
      const quote: AvailabilityQuote = {
        property_id: property.property.id,
        currency: property.property.currency,
        arrival_date: input.arrival_date,
        departure_date: input.departure_date,
        night_count: nights,
        items,
        total_amount_minor: items.reduce((sum, item) => sum + item.line_total_minor, 0),
        quote_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      };
      return result(quote);
    },
    async createHold(_organizationSlug: string, _propertySlug: string, input: CreateHoldRequest, _idempotencyKey: string) {
      const hold: HoldResponse = {
        hold: { id: "preview-hold-001", status: "active", expires_at: new Date(Date.now() + 15 * 60_000).toISOString() },
        currency: property.property.currency,
        items: input.items.map((item) => ({
          room_type_id: item.room_type_id,
          quantity: item.quantity,
          unit_nightly_rate_minor: 85000,
          line_total_minor: 85000 * item.quantity,
        })),
        total_amount_minor: 85000 * input.items.reduce((sum, item) => sum + item.quantity, 0),
        payment: { required: true, next_action: "create_payment_attempt" },
      };
      return result(hold);
    },
    async createPaymentAttempt(holdId: string, _idempotencyKey: string) {
      const attempt: PaymentAttemptResponse = {
        id: "preview-payment-001",
        status: "created",
        checkout_url: null,
        amount_minor: 85000,
        currency: property.property.currency,
      };
      void holdId;
      return result(attempt);
    },
    async publishProperty() {
      const published: OwnerPropertyResponse = { id: property.property.id, publication_status: "published" };
      return result(published);
    },
  };
}
