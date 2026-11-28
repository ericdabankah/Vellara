# VELLARA Property and Hospitality API Contract v1

**Status:** Proposed contract for backend-owner review. Routes and payloads are not yet approved or implemented.

**API convention:** Preserve the repository's established `/v1` convention and JSON response envelope:
- Success: direct JSON object.
- Error: `{ "error": { "code": "...", "message": "...", "request_id": "..." } }`.

This contract keeps the Owner Desk, public mini-sites, voice and WhatsApp channels on the same VELLARA business rules. Frontends and AI channels must not write privileged Supabase tables directly.

## 1. Boundary rules

- Retell and Meta handle communication delivery.
- OpenAI supplies reasoning and language intelligence.
- VELLARA validates tenant scope, property permissions, availability, bookings, price snapshots, payment state, receipts and audit.
- The backend owns all authoritative operations and database transactions.
- Public slugs identify published property content, not a tenant authorization context.
- All monetary values are integer minor units plus ISO currency.
- All date-only stay periods use local property dates and half-open intervals: arrival inclusive, departure exclusive.
- All mutating requests require an idempotency key.
- The server returns a `request_id` for support/audit correlation.

## 2. Public property discovery

### GET `/v1/public/properties/{organizationSlug}/{propertySlug}`

Purpose: resolve a published property mini-site.

Response:
```json
{
  "property": {
    "id": "uuid",
    "organization_slug": "coastal-hotel-group",
    "property_slug": "coastal-hotel",
    "vertical": "hospitality",
    "display_name": "Coastal Hotel",
    "description": "…",
    "location": {
      "city": "Accra",
      "region": "Greater Accra",
      "country_code": "GH"
    },
    "timezone": "Africa/Accra",
    "currency": "GHS",
    "published_at": "2026-11-28T10:00:00Z",
    "media": [
      {
        "id": "uuid",
        "url": "short-lived-or-cacheable-approved-public-url",
        "alt_text": "Exterior view"
      }
    ]
  }
}
```

Rules:
- Only active organizations and active, published properties resolve.
- Return curated public fields only.
- Do not return internal staff, guest, reservation, phone-routing, payment or private asset metadata.
- For unpublished/inactive/unknown slugs, return the same public not-found response to avoid disclosing tenant existence.
- Media URLs are returned only for explicitly published assets.

## 3. Public hospitality availability and quote

### POST `/v1/public/properties/{organizationSlug}/{propertySlug}/availability`

Purpose: return availability and a server-calculated quote without reserving inventory.

Request:
```json
{
  "arrival_date": "2026-12-12",
  "departure_date": "2026-12-15",
  "guests": {
    "adults": 2,
    "children": 0
  },
  "room_types": [
    {
      "room_type_id": "uuid",
      "quantity": 2
    }
  ]
}
```

Response:
```json
{
  "property_id": "uuid",
  "currency": "GHS",
  "arrival_date": "2026-12-12",
  "departure_date": "2026-12-15",
  "night_count": 3,
  "items": [
    {
      "room_type_id": "uuid",
      "name": "Deluxe",
      "quantity": 2,
      "available_quantity": 3,
      "unit_nightly_rate_minor": 45000,
      "line_subtotal_minor": 270000,
      "tax_total_minor": 0,
      "line_total_minor": 270000
    }
  ],
  "total_amount_minor": 270000,
  "quote_expires_at": "2026-11-28T10:15:00Z"
}
```

Rules:
- Availability is indicative only. This request does not hold inventory.
- The backend calculates all prices, tax and totals. Ignore any client-supplied price.
- The response must clearly distinguish unavailable room types from invalid requests.
- The quote has a bounded validity period; final hold creation recalculates and validates availability and price.

## 4. Create an inventory hold

### POST `/v1/public/properties/{organizationSlug}/{propertySlug}/holds`

Headers:
- `Idempotency-Key: <unique-client-generated-key>`

Request:
```json
{
  "arrival_date": "2026-12-12",
  "departure_date": "2026-12-15",
  "guest": {
    "full_name": "Guest Name",
    "phone_e164": "+233200000000",
    "email": "guest@example.com"
  },
  "items": [
    {
      "room_type_id": "uuid",
      "quantity": 2
    }
  ],
  "quote_reference": "opaque-server-issued-reference"
}
```

Response:
```json
{
  "hold": {
    "id": "uuid",
    "status": "active",
    "expires_at": "2026-11-28T10:15:00Z"
  },
  "currency": "GHS",
  "items": [
    {
      "room_type_id": "uuid",
      "quantity": 2,
      "unit_nightly_rate_minor": 45000,
      "line_total_minor": 270000
    }
  ],
  "total_amount_minor": 270000,
  "payment": {
    "required": true,
    "next_action": "create_payment_attempt"
  }
}
```

Rules:
- The backend locks and rechecks all requested room types in one transaction.
- A multi-room-type request succeeds completely or fails completely.
- Hold expiry is server-controlled; clients cannot choose an arbitrary expiry.
- Duplicate idempotency keys return the original result.
- The response does not mean payment is verified or a reservation confirmed.
- If the guest identity is incomplete, the backend may create a short-lived guest lead or return a validation requirement. Do not create duplicate guest records for the same organization/identity.

## 5. Payment attempt and reservation confirmation

Payment attempt creation and provider verification are not yet fully specified in the booking-money ledger. Proposed operations:

### POST `/v1/public/holds/{holdId}/payment-attempts`

- Requires active, unexpired hold.
- Server creates the payment reference and amount/currency from the hold.
- Returns provider-specific checkout instructions.
- Client cannot choose the amount, currency, tenant or booking reference.

### POST `/v1/webhooks/payments/{provider}`

- Server verifies provider signature and event authenticity.
- Event is stored in an idempotent provider inbox.
- Server fetches/verifies transaction facts with provider where supported.
- Amount, currency, payment reference, tenant and hold must match.
- Only verified payment can trigger confirmation under the configured payment policy.

### GET `/v1/public/holds/{holdId}`

Returns safe hold/payment progress for the booking client. Never expose provider secrets or internal reconciliation data.

Do not let the browser call a generic `confirm-payment` endpoint with a success flag. The authoritative transition is driven by verified provider evidence or an explicitly permitted offline-payment workflow.

## 6. Owner Desk operations

### POST `/v1/owner/properties/{propertyId}/publish`

- Requires owner/manager publication permission.
- Backend validates required public fields, vertical setup and approved media.
- Writes publication state and audit event atomically.
- Does not publish private assets or expose unpublished records by default.

### POST `/v1/owner/reservations/{reservationId}/allocations`

Request:
```json
{
  "allocations": [
    {
      "reservation_item_id": "uuid",
      "room_id": "uuid"
    }
  ]
}
```

Rules:
- Requires property-scoped allocation permission.
- Backend verifies property, room type, date range, room status, allocation quantity and overlap.
- Multi-room allocation is all-or-nothing.
- Reassignment releases the old allocation and creates the new one atomically.
- Every allocation/reassignment produces an audit event.

### GET `/v1/owner/properties/{propertyId}/availability`

Returns property-scoped availability and operational blocks for the selected date range. Requires property-level access and must not expose other tenants' data.

## 7. Channel-neutral internal operations

Voice and WhatsApp should call the same internal business operations as the web channel:
- Resolve property and published content.
- Get availability and quote.
- Create/extend/release hold.
- Create payment attempt.
- Verify payment event.
- Convert hold to reservation.
- Assign/reassign physical room.
- Send receipt after authoritative payment/booking transition.

AI may collect information and propose a tool action. The backend validates every action against the authenticated business/channel identity and property permissions. Do not treat model output, a phone number, a WhatsApp sender ID or a public property slug as authorization by itself.

## 8. Error codes

Recommended stable codes:
- `PROPERTY_NOT_FOUND`
- `PROPERTY_NOT_PUBLISHED`
- `PROPERTY_NOT_BOOKABLE`
- `INVALID_STAY_DATES`
- `ROOM_TYPE_UNAVAILABLE`
- `INSUFFICIENT_INVENTORY`
- `QUOTE_EXPIRED`
- `HOLD_EXPIRED`
- `HOLD_ALREADY_CONVERTED`
- `IDEMPOTENCY_CONFLICT`
- `PAYMENT_NOT_VERIFIED`
- `PAYMENT_AMOUNT_MISMATCH`
- `PAYMENT_CURRENCY_MISMATCH`
- `ROOM_ALLOCATION_CONFLICT`
- `PROPERTY_PERMISSION_DENIED`
- `VALIDATION_ERROR`

Return 401 for missing/invalid owner sessions, 403 for authenticated owner actions lacking permission, 404 for non-resolvable public properties, 409 for inventory/idempotency/state conflicts, and 422 for validly parsed but semantically invalid input. Avoid returning raw database errors.

## 9. Backend owner approval checklist

Before frontend integration, the backend owner should confirm:
1. Route names and API versioning.
2. Hold expiry and whether one extension is allowed.
3. Exact `pending` reservation semantics and the payment transition.
4. Quote expiry and whether price changes invalidate a quote.
5. Guest identity matching/deduplication rules.
6. Owner/manager/operations permissions for publish and room allocation.
7. Payment providers and offline-payment policy.
8. Whether the public resolver is served by the existing API or a separate edge endpoint.

Until approved, frontend code should consume typed mock adapters that mirror this contract, not call guessed routes or write directly to Supabase.
