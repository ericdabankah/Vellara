# VELLARA

AI-first business front-office and operations platform.

## Start here

Before changing or implementing any module, read:

1. [Engineering governance](docs/engineering/DEVELOPMENT_GOVERNANCE.md)
2. [Module ownership](docs/engineering/MODULE_OWNERSHIP.md)
3. [Integration contracts](docs/contracts/INTEGRATION_CONTRACTS.md)
4. [Module contract template](docs/contracts/MODULE_CONTRACT_TEMPLATE.md)
5. [Architecture decision record template](docs/architecture/DECISION_RECORD_TEMPLATE.md)
6. [Pull request template](.github/pull_request_template.md)

## Important

The repository's existing application architecture must be inspected before introducing frameworks, restructuring folders, adding dependencies, creating database schema or changing deployment configuration.

The documents currently establish a proposed engineering baseline. They do not assert that an API, database schema, event transport or provider integration has already been implemented.

## Team

- Frontend lead: Owner Desk, customer-facing experience, design system and client integrations.
- Backend/AI lead: APIs, orchestration, channel integrations and authoritative business services.
- Database/security lead: schema, migrations, tenant isolation, RLS and data integrity.

All shared contracts require review by affected module owners.
