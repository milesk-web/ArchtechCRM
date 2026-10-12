-- Link each immutable quote calculation to the exact published workflow version.
alter table quote_calculation_snapshots
  add column if not exists workflow_id uuid references quote_workflow_versions(id) on delete restrict;

alter table quote_calculation_snapshots
  add column if not exists workflow_version integer;

create index if not exists quote_calculation_snapshots_workflow_version_idx
  on quote_calculation_snapshots (workflow_id, workflow_version);
