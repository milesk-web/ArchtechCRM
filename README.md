# ArchtechCRM

ArchtechCRM is a Next.js CRM and quoting application for roofing and wall-cladding work. Quoting uses a pure deterministic costing engine; published costing rules and quote calculation snapshots are versioned separately from the user interface.

## Development

```bash
npm ci
npm run dev
npm test
```

## Deployment configuration

Configure these environment variables in the deployment environment:

- `AUTH_SECRET`: required, at least 32 characters, used to encrypt application sessions.
- `COSTING_SEED_SECRET`: bearer token required by `POST /api/costing/seed`.
- `COSTING_ADMIN_EMAILS`: comma-separated email addresses permitted to save and publish costing rules and quote workflows. Other authenticated users have read-only access to these configuration screens.

Never commit secret values to the repository.

## Supabase schema

Before enabling the versioned quote features, verify which schema migrations have already been applied in the target Supabase project. Apply any missing migrations in dependency order:

1. The legacy quote-builder schema in `supabase/migrations/quote_builder.sql.txt` (this legacy file has a non-standard extension and must be applied manually if it has not already been run).
2. `supabase/migrations/20261006_costing_engine.sql`.
3. `supabase/migrations/20261012_versioned_costing_snapshots.sql`.
4. `supabase/migrations/20261013_versioned_quote_workflows.sql`.

Do not blindly re-run legacy SQL that creates policies without checking whether those policies already exist.

## Versioned configuration

- `/costing-rules` edits a draft costing rule set and publishes an immutable version. Only the published version is used for new calculations.
- `/workflows` edits the conditional question and generated-work definition for the `roofing-cladding` workflow. Conditions support nested `all`, `any`, and `not`, plus equality, numeric comparisons, contains, and set/unset operators.
- Each calculation associated with a quote stores its input, catalogue snapshot, result, costing rule-set ID/version, and engine version in `quote_calculation_snapshots`.
- The issue-quote endpoint requires a ready calculation snapshot and verifies that the saved quote lines still match it.

The current costing rule sets and workflow definitions are global to this installation. Organisation-scoped pricing and workflow configuration should be added only alongside an explicit tenancy and permission model.

## Quality checks

The GitHub Actions workflow runs the costing and workflow regression tests with `npm test`. The existing repository-wide ESLint command currently reports pre-existing issues in several legacy pages and scripts; those are tracked separately from the focused regression-test workflow.
