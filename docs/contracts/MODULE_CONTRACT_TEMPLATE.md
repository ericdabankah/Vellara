# Module Contract: <module name>

Status: Draft | In review | Approved | Deprecated  
Version: 0.1.0  
Owner: <developer/module owner>  
Reviewers: <affected owners>  
Last updated: YYYY-MM-DD

## 1. Purpose
What responsibility does this module own?

## 2. Non-goals
What must this module explicitly not own or decide?

## 3. User journeys and business rules
List user-visible flows and authoritative business rules.

## 4. Ownership and dependencies
- Responsible owner:
- Collaborating owners:
- Upstream dependencies:
- Downstream consumers:

## 5. Data contract
For each entity:
- Entity/table:
- Tenant scope:
- Fields read:
- Fields written:
- Source of truth:
- Retention/deletion:
- Constraints and indexes:

Do not assume table or field names until the database owner approves them.

## 6. API contract
For every operation:
- Operation name:
- Method and path:
- Authentication:
- Permission:
- Request schema:
- Response schema:
- Error codes:
- Idempotency behaviour:
- Pagination/filtering:
- Rate limits:

Use exact JSON examples and define nullable/optional fields. Do not document guessed endpoints as implemented endpoints.

## 7. Event contract
For every consumed or emitted event:
- Event name:
- Producer:
- Consumers:
- Schema version:
- Tenant scope:
- Entity reference:
- Duplicate handling:
- Ordering/staleness handling:
- Retry/replay behaviour:

## 8. Security and privacy
- Authentication requirements:
- Authorization checks:
- Tenant isolation:
- Sensitive fields:
- Audit events:
- Abuse/rate-limit considerations:

## 9. Failure and recovery
Describe timeouts, provider failures, stale data, retries, duplicate requests, reconnection and user-facing recovery.

## 10. Observability
Define logs, metrics, traces, correlation/request IDs and alerts. Never log secrets or unnecessary personal data.

## 11. Tests
- Unit tests:
- Integration tests:
- Contract tests:
- Security tests:
- Concurrency/idempotency tests:
- Accessibility/responsive tests, if UI:

## 12. Acceptance criteria
Write verifiable statements that can be tested.

## 13. Rollout and compatibility
Describe migration order, feature flags if needed, backward compatibility, rollback and dependent releases.

## 14. Approval
- Frontend owner:
- Backend owner:
- Database/security owner:
- Product decision owner:
- Approval date:
