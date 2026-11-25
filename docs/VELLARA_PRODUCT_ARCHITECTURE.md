# VELLARA Product Architecture and Phase 1 Scope

**Status:** Product direction agreed; implementation specification
**Date:** 2026-11-25

## 1. Product definition

VELLARA is a multi-tenant AI-powered digital employee and business operations platform. It gives each subscribing business a configurable AI receptionist, shared business knowledge, customer context, communication channels, operational records, and a human-operated Owner Desk.

The first production release is focused on hotels, serviced apartments, short-stay apartments, and B&Bs. The architecture should remain extensible to real-estate sales and other business categories without forcing those workflows into the first release.

VELLARA is not only a call-answering tool and not merely a property-management dashboard. It coordinates customer engagement and business operations across channels.

## 2. Agreed implementation boundaries

- Frontend: React, Vite, TypeScript.
- Database and authentication: Supabase.
- Frontend hosting: Cloudflare Pages.
- Backend/API execution: Cloudflare Workers, owned by the backend implementation workstream. This repository work must not modify Worker code.
- Voice provider: Retell AI is planned; integration is not yet complete.
- Shared intelligence: the VELLARA/OpenAI engine is intended to supply reasoning. Its actual interface and integration must be inspected and contracted before claiming it is connected.
- Initial market context: Ghana, default business timezone Africa/Accra, default currency GHS.
- No production deployment, PR merge, real customer account creation, or test business seeding without explicit approval.

## 3. Customer channels and shared context

Phase 1 customer touchpoints: phone calls, WhatsApp messages, SMS, and each business's branded mini-website, including enquiry and booking/checkout journeys.

A customer may move between channels without losing relevant context. The system should associate channel identities, customer profiles, conversations, enquiries, and resulting bookings or purchases. A secure handoff link from a conversation to a website journey must use scoped, expiring tokens; public URLs must not expose private conversation content.

The Owner Desk should present a unified inbox for supported text channels and call activity. Staff can take over a conversation; the AI must stop sending replies while staff control is active, and handback must be explicit and auditable.

## 4. Shared AI and tenant isolation

There is one shared intelligence capability, not a separate fine-tuned model per business. Each tenant supplies its own business profile and operating instructions; services, inventory, prices, policies, opening hours and FAQs; availability and transaction records; authorized actions and approval rules; and conversation history and customer context.

Tenant data and actions must be isolated. The AI may only use the current tenant's knowledge and tools, and may only execute actions allowed by that tenant's configuration and the acting workflow. Important actions such as refunds, price overrides, destructive changes, and sensitive account operations require appropriate human permissions or explicit approval.

The AI must not invent availability, prices, payment success, bookings, or property facts. It must retrieve authoritative records and report uncertainty when records are unavailable.

## 5. Phase 1 business workflows

### 5.1 Enquiry and lead handling
- Capture inbound enquiries from supported channels.
- Match or create a customer profile without unnecessary duplicates.
- Preserve channel identity and conversation history.
- Capture intent, dates, budget, guest count, preferences, and requested property/room.
- Track lead status and conversion outcome.
- Allow staff to review, assign, and take over enquiries.

### 5.2 Accommodation inventory and availability
- Manage properties, rooms/units, room types, capacity, pricing, amenities, photos, and operational status.
- Support short-stay and serviced-apartment use cases, including B2B apartment operators.
- Availability must be based on authoritative inventory and reservation records.
- Prevent overlapping confirmed reservations and unsafe overbooking.
- Price and availability changes in Owner Desk must propagate to the business mini-website through the agreed backend/data contract.

### 5.3 Reservations and checkout
- AI can answer questions, search suitable available options, create permitted reservation holds or bookings, and share a contextual website link.
- Website visitors can view the relevant listings, filter options, select dates, and complete the approved booking flow.
- The website and Owner Desk use the same source of truth.
- Reservation lifecycle, expiry, cancellation, amendments, check-in and checkout must be explicit and auditable.

### 5.4 Walk-ins in Phase 1
Walk-in guests are handled by a human employee, not by an autonomous kiosk or self-service terminal. The Owner Desk should provide a simple guided workflow for an authorized employee to assess the guest, check actual availability, register the customer, create the reservation, record the payment state, and issue the receipt. Do not build autonomous walk-in assessment, self-service booking terminals, or unattended physical reception in Phase 1.

### 5.5 Payments
- Payment attempts and transactions must be distinct from reservations.
- Payment success is established only from a verified payment-provider event or another explicitly approved authoritative reconciliation process.
- Never treat screenshots, customer claims, or AI-generated statements as proof of payment.
- Support idempotent webhook processing, duplicate-event protection, refunds/reversals, and clear pending/failed/successful states.
- Provider selection and final commercial terms remain pending.

### 5.6 Receipts and QR verification
Every finalized receipt must have a unique receipt number and a QR code linked to a secure, unguessable receipt identifier or verification token. The QR must not encode private customer or payment data.

An authenticated and authorized staff member can scan the QR with a desktop camera or supported scanner. VELLARA resolves the identifier server-side and retrieves the canonical receipt record. The verification screen should clearly show validity and current payment status; receipt number and transaction reference; business and customer identity subject to staff permissions; amount, currency, payment method and timestamp; related reservation/order and relevant stay dates; and refund, cancellation, reversal, or previous-use status where relevant.

QR scanning is a lookup and verification mechanism, not proof by itself that a payment succeeded. A receipt must reflect the authoritative transaction state. Sensitive details are only returned after authorization. QR tokens should be revocable/rotatable where necessary and must not permit cross-tenant access.

### 5.7 Follow-ups and notifications
- Follow-up timing and message templates are configurable per tenant.
- Stop reminders after payment, cancellation, opt-out, or staff takeover.
- Use channel consent and provider capabilities appropriately.
- Log outbound messages and delivery outcomes.

### 5.8 Human operations and staff permissions
The Owner Desk should be task-oriented and easy for a first-time junior operator to learn. It should use plain language, guided steps, sensible defaults, clear validation, visible status, and confirmations for consequential actions.

Role-based access must distinguish owner, manager, operations, and verification duties. A simple interface must not imply unrestricted permissions. Refunds, pricing overrides, access to sensitive records, staff management, and tenant configuration must be protected and audited.

## 6. Owner Desk information architecture

- Home / Overview
- Inbox
- Customers & Leads
- Reservations
- Rooms & Properties
- Payments
- Receipts & QR Verification
- Calls
- AI Receptionist
- Website
- Numbers & Channels
- Automations
- Staff & Permissions
- Plans & Subscription
- Business Settings

Navigation labels and order may be refined through usability work, but the workflows above must remain discoverable. Avoid technical terms in ordinary staff-facing screens.

## 7. Phase 1 exclusions

Explicitly deferred: autonomous walk-in assessment and booking; self-service guest check-in/check-out kiosks; custom VELLARA hardware manufacturing; smart locks, digital keys, and automatic room access issuance; fully unattended physical reception; full real-estate sales transaction/closing workflow; unapproved payment, SMS, WhatsApp, or voice-provider integrations; and subscription pricing and plan limits that have not been approved.

The architecture may reserve clean extension points for future self-service reception, access devices, and property sales, but these must not delay the first reliable release.

## 8. Future expansion: autonomous reception

After Phase 1 is proven with real businesses, a later release may introduce mobile self-check-in and checkout; staff-assisted or guest-operated QR kiosks; dedicated touchscreen Smart Desk hardware; identity verification integrations; smart-lock/access-control adapters and time-limited credentials; device monitoring, offline recovery, emergency procedures, and access audit logs.

This future system must be designed around safe access issuance, verified booking/payment/identity state, expiry and revocation, and human emergency escalation. It is not part of Phase 1 implementation.

## 9. Architecture domains to audit against Supabase

The current database is a foundation, not a complete implementation of this product. Audit existing schema and migrations before proposing changes. Expected domains include:

1. Tenant identity, memberships, staff roles and permissions.
2. Subscription plans, entitlements, billing and usage.
3. Phone numbers, channels and receptionist instances.
4. Customers, channel identities, conversations, participants and messages.
5. Call records, provider events, transcripts and summaries subject to consent/retention rules.
6. Tenant knowledge, AI instructions, approved tools and action audit.
7. Properties, units/rooms, amenities, media, pricing and availability.
8. Reservations, holds, amendments, cancellations and stay events.
9. Payment attempts, verified transactions, refunds and provider webhook events.
10. Receipts, QR verification identifiers and receipt delivery.
11. Website configuration, listings, domain mapping and secure conversation handoff.
12. Automations, scheduled follow-ups, notification attempts and opt-outs.
13. Staff task workflows, manual walk-in registration, check-in/out and activity audit.
14. Reporting and operational metrics.

All tenant-owned records need tenant-safe foreign keys, RLS policies, appropriate database constraints, and server-side authorization for privileged operations. Do not expose provider secrets, private webhook payloads, payment internals, or cross-tenant identifiers to browser roles.

## 10. Required implementation sequence

1. Audit the current GitHub branch, open PR, Supabase schema, migrations, RLS policies, functions, and frontend.
2. Produce a schema gap analysis and a canonical migration reconciliation plan. The existing production migrations must be reproducible from repository files before further schema expansion.
3. Define the full data model and backend API/event contracts with the backend workstream.
4. Implement missing database domains in small, reviewed migrations with RLS, constraints, indexes, and verification.
5. Build the task-first Owner Desk and unified workflows against real data.
6. Integrate the shared AI engine and communication/payment providers only against confirmed contracts.
7. Test end-to-end journeys, tenant isolation, payment idempotency, QR receipt verification, staff permissions, and failure handling.
8. Keep production deployment and PR merge behind explicit approval.

## 11. Non-negotiable product quality rules

- No fake data, fake metrics, or nonfunctional buttons presented as working.
- No payment success without authoritative verification.
- No QR lookup that leaks data or bypasses staff authorization.
- No cross-tenant data exposure.
- No AI action outside configured permissions.
- No duplicate customer or payment records from repeated provider events.
- No walk-in kiosk or unattended check-in in Phase 1.
- No Worker/backend code changes in the frontend/database workstream.
- No production deployment or PR merge without explicit approval.