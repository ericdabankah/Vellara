## Summary
<!-- What changed and why? -->

## Module and owner
- Module:
- Responsible owner:
- Related issue/contract:

## Change classification
- [ ] New module
- [ ] Existing module change
- [ ] Shared contract change
- [ ] Database migration
- [ ] Security/permission change
- [ ] Dependency/tooling change
- [ ] UI/design/motion change
- [ ] Deployment/configuration change

## Contract and integration
- [ ] I inspected the existing implementation before changing it.
- [ ] The module contract is documented and approved.
- [ ] API schemas and error behaviour match the approved contract.
- [ ] Database changes include migrations and RLS/constraint review.
- [ ] Event names and payloads match the approved event contract.
- [ ] All affected module owners were consulted for shared changes.
- [ ] No guessed endpoints, fields, statuses or permissions were introduced.

## Security and reliability
- [ ] No secrets, tokens or private customer data are included.
- [ ] Tenant isolation and authorization are enforced server-side.
- [ ] Retry/idempotency and duplicate delivery were considered.
- [ ] Failure, timeout and recovery behaviour were tested.
- [ ] Sensitive actions are audited.
- [ ] No client-side value is treated as authoritative for money, inventory or payment.

## Quality
- [ ] Relevant tests were added or updated.
- [ ] Tests and checks pass.
- [ ] Loading, empty, error and success states are handled where relevant.
- [ ] Accessibility and responsive behaviour were checked for UI changes.
- [ ] Reduced-motion behaviour was checked for animated UI.
- [ ] Documentation and environment-variable examples are updated.
- [ ] No unrelated changes are included.

## Evidence
<!-- Add screenshots, test output, API examples, migration notes, or deployment preview. -->

## Rollout / rollback
<!-- Describe migration order, compatibility concerns, feature flags and rollback. -->

## Reviewer approvals
- [ ] Frontend owner (when affected)
- [ ] Backend owner (when affected)
- [ ] Database/security owner (when affected)
- [ ] Product owner for business-rule changes

> Pull requests missing required contract, test, security or owner-review information are not ready to merge.
