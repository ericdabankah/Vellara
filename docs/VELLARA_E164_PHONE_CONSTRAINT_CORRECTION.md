# E.164 phone constraint correction

## Finding

Read-only inspection of the connected production Supabase database on 2026-11-27 found that the check constraints `profiles_phone_e164_format` and `business_profiles_contact_phone_format` used an over-escaped leading-plus expression.

A PostgreSQL expression test confirmed that the live pattern rejected a valid number such as `+233501234567` and accepted a value beginning with a backslash instead.

The affected production columns currently contain zero non-null phone values, so no existing phone records require remediation.

## Correction

The forward migration `20261127190000_correct_e164_phone_constraints.sql` replaces both checks with the unambiguous expression:

```sql
'^[+][1-9][0-9]{7,14}$'
```

This requires a leading plus, a non-zero country-code digit, and 7 to 14 further digits.

## Safety and verification status

- The production database was inspected read-only.
- No production SQL was executed to change schema, constraints, permissions, or data.
- The migration has not been applied to production.
- The corrected regex was evaluated with a read-only PostgreSQL expression test: the valid Ghana E.164 example matched; the over-escaped historical expression did not.
- The live columns were checked and currently have zero non-null phone values.
- The migration still requires replay in an isolated PostgreSQL/Supabase environment and CI verification before merge or deployment.

## Release gate

Do not merge or apply this migration until isolated migration replay succeeds and the constraint tests cover valid E.164 values, missing plus signs, backslashes, invalid country-code prefixes, and lengths outside the permitted range.
