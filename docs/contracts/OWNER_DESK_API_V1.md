# VELLARA Owner Desk API v1

Status: implementation baseline for the initial identity/tenant milestone.

Base path: `/v1`

## Authentication

Every route except `GET /health` requires:

```
Authorization: Bearer <Supabase access token>
```

The API verifies the token against Supabase Auth. The verified user ID comes only from the Auth response. Browser-supplied user IDs and organization roles are never trusted.

## Response envelope

Success responses use JSON objects. Errors use:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Your session is invalid or has expired.",
    "request_id": "server-generated-or-validated-id"
  }
}
```

Stable initial error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `METHOD_NOT_ALLOWED`, `UPSTREAM_ERROR`, `INTERNAL_ERROR`.

## Routes

### GET /health

Public liveness endpoint. Returns service status only. Must not expose environment variables, database details or secrets.

### GET /v1/me

Returns verified Auth identity and the caller's own profile.

### GET /v1/organizations

Returns active organization memberships visible to the authenticated caller, with organization and business-profile summary. Database RLS is authoritative.

### POST /v1/organizations

Creates an organization, business profile and initial owner membership atomically through `public.create_organization`.

Request:

```json
{
  "name": "Example Hotel",
  "business_type": "hotel",
  "timezone": "Africa/Accra",
  "currency": "GHS"
}
```

Allowed business types: `hotel`, `real_estate`, `other`.

Response: HTTP 201 with `organization_id`.

The caller cannot submit organization ID, user ID, owner role, membership status or created_by. Those values are established by the database function using the verified auth context.

## Tenant authorization

No route accepts a free-form organization ID for this initial slice. Future tenant-scoped routes must resolve the requested organization through active membership before domain work. RLS must independently enforce row access.

## Phone number registration and verification

Phone registration, ownership verification, and channel activation are specified separately in [PHONE_NUMBER_VERIFICATION_V1.md](./PHONE_NUMBER_VERIFICATION_V1.md). That document records the approved provider direction: Retell AI for voice, Meta WhatsApp Cloud API for WhatsApp, and OpenAI as the shared intelligence engine. It remains a design contract until provider-specific requirements, credentials, webhook security and isolated-database tests are complete. The current API does not expose phone routes, and no number can be activated through this API yet.

## Compatibility

This contract remains deliberately narrow. Inventory, reservations, payments, staff PINs, mini-website publishing, AI tool calls and QR check-in require separate state machines and contracts before implementation.
