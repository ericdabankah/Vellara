# VELLARA Owner Desk Prototype Specification

## Design source and decisions

The uploaded `reference/owner-desk-original.html` is the visual source of truth. Preserve its Owner Desk composition, original navigation hierarchy, forest-green hero, warm-ivory workspace, Fraunces/Inter typography, Needs You column and Happening Now column. Extend and refine that design; do not replace it with a generic dashboard template.

Confirmed design decisions:

- Hero experience: transform the existing hero stage.
- Accent: pepper coral `#F07850`.
- Motion: expressive premium, with purposeful rather than decorative movement.

Core palette:

| Token | Value | Purpose |
|---|---|---|
| Forest | `#0F2B23` | Brand and hero foundation |
| Deep forest | `#17382E` | Hero depth and surfaces |
| Ivory | `#F4F1EA` | Workspace canvas |
| Ink | `#14201C` | Primary text |
| Action green | `#1F5C4A` | Primary actions |
| Sage | `#6FBF9C` | Positive activity |
| Mint | `#B4E5CC` | AI activity and waveform |
| Gold | `#E0A93B` | Important highlights |
| Pepper coral | `#F07850` | Incoming attention and call transitions |

Coral is an accent, not the global error colour. Reserve red for genuine errors and destructive actions.

## Screen scope

Phase 1 is the Owner Desk only:

1. Command Centre
2. AI Calls & Records
3. Guest Inbox
4. Bookings
5. Properties
6. AI Activity Centre
7. Staff Operations
8. Payments
9. Settings & Intelligence

The mini-website and receipts/QR verification frontends are explicitly outside this prototype phase.

## Transforming hero lifecycle

The hero stays in its original position and the rest of the dashboard remains accessible. Its content, ambient lighting, waveform, status and controls transform by call state:

- Idle: calm forest/ivory identity, operational status and a demo call trigger.
- Incoming: coral glow and ring pulse, caller details, answer and decline.
- Connecting: focused gold/green transition and connection status.
- AI speaking: mint/green waveform and call timer.
- Customer speaking: distinguishable waveform state and caller identity.
- On hold: settled waveform, paused status and resume action.
- Human takeover: AI handling visibly pauses and the assigned staff member is identified.
- Ended: completion state and summary action.
- Missed/failed: explicit missed outcome and follow-up state.

A compact call dock remains available while navigating. The prototype includes two sample call lanes and lets the user switch the focused call. Each call has its own displayed caller/line identity.

## Motion rules

| Interaction | Target |
|---|---:|
| Incoming hero transformation | 450ms |
| Ring pulse | 1.5s cycle |
| Connecting animation | 1.2s |
| Hero state transition | 350ms |
| Navigation | 220–280ms |
| Card hover | 180–220ms |
| Button press | 100–140ms |
| Notification | 250ms |
| Activity insertion | 300ms |
| Modal opening | 250–300ms |
| Page transition | 250–350ms |

Use transform and opacity where possible, avoid layout jumps, support keyboard focus, and respect `prefers-reduced-motion`.

## Interaction expectations

Every visible navigation item, call control, menu, filter, modal, form, table action and primary button must have a meaningful prototype behaviour. Demo interactions must be visibly presented as local simulated behaviour. No simulated call, reservation or payment may be represented as production activity.

## Production boundary

The prototype is deliberately disconnected from backend services. When production integration begins:

- Backend/voice-provider events are authoritative for call state.
- The frontend must not trust browser-supplied tenant, user or role identifiers.
- Human takeover must stop conflicting AI handling.
- A reservation request is not a confirmed reservation until the backend confirms it.
- A payment is not verified until the backend verifies the provider transaction.
- Provider credentials and service-role keys must never enter browser code.