# VELLARA Owner Desk Prototype

A desktop-first, interactive visual prototype built directly from the supplied **Vellara Owner Desk – Owner Desk, desktop (1).html** reference.

## Run locally

No build system or package installation is required. Open `index.html` in a modern browser, or serve this directory locally:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Source of truth

- `reference/owner-desk-original.html` is the untouched uploaded HTML reference.
- `index.html` is the runnable, self-contained prototype. It retains the reference dashboard composition and embedded typography, then adds the approved transforming hero, interactive screens, responsive styling and local demo interactions.
- `docs/prototype/OWNER_DESK_PROTOTYPE.md` records the approved design and interaction rules.

## Included screens

Command Centre, AI Calls & Records, Guest Inbox, Bookings, Properties, AI Activity Centre, Staff Operations, Payments, and Settings & Intelligence.

The transforming hero demonstrates incoming, connecting, AI speaking, customer speaking, on-hold, human takeover, ended and missed call states. A compact call dock remains visible while navigating, and the prototype demonstrates switching between two sample call lanes.

## Important boundary

All records, calls, payments, notifications, approvals and staff actions are local demonstration data. This prototype does not connect to Supabase, a telephone provider, WhatsApp, a payment provider, or production APIs. It does not create real reservations, move money, place calls or send messages. Production integrations must use the authenticated backend contracts and authoritative server-side state.