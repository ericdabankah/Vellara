# VELLARA Module Ownership

Status: Initial team agreement; confirm individual developer identities before assigning GitHub CODEOWNERS.

| Area | Accountable owner | Responsibilities | Required collaborators |
|---|---|---|---|
| Design system and frontend shell | Frontend lead | Tokens, components, navigation, responsive UI, accessibility, motion | Backend for auth/API; database for data contracts |
| Owner Desk modules | Frontend lead | Overview, calls, conversations, Guest Box, properties, reservations, payments, staff UI | Backend and database |
| Customer mini-website | Frontend lead | Storefront presentation, browsing and checkout UI | Backend and database |
| API and business services | Backend/AI lead | API, authorization enforcement, business rules, integrations | Frontend and database |
| AI and channel orchestration | Backend/AI lead | Telephone, WhatsApp, web channels, tools and escalation | Frontend and database |
| Payment and reservation services | Backend/AI lead | Provider verification, holds, confirmation, idempotency | Database and frontend |
| Schema and migrations | Database/security lead | Tables, relationships, constraints, migrations and indexes | Backend and frontend |
| RLS and storage security | Database/security lead | Tenant isolation, access policies, storage rules | Backend and frontend |
| Shared contracts | Joint approval | API, event, entity, permission and status definitions | All affected owners |
| Production release | Joint approval | Release readiness, migration order, rollback and smoke tests | All three leads |

## Change boundaries

- Frontend may define presentation models but cannot redefine authoritative backend or database fields.
- Backend may propose data needs but cannot silently alter the database schema.
- Database may define persistence constraints but cannot silently change API semantics or frontend workflows.
- Any shared contract change requires an ADR or updated module contract and approval from affected owners.
- If ownership is unclear, pause the change and agree on an owner before implementation.

## Required review by change type

| Change | Required review |
|---|---|
| Design tokens/shared UI components | Frontend lead |
| API request/response change | Backend + frontend |
| Database schema/RLS/migration | Database + backend; frontend if consumed |
| Event schema or call states | Backend + frontend |
| Payment/reservation business rules | Backend + database + product |
| Authentication/permissions | All three |
| Deployment/secrets/runtime config | Backend + relevant deployment owner |

Do not add CODEOWNERS entries until the actual GitHub usernames of all three developers have been confirmed.
