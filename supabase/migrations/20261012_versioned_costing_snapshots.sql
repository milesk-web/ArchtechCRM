-- Versioned costing rules and immutable calculation snapshots.
-- The initial release uses a single global published rule set. Organisation-scoped
-- rule sets can be introduced once the application's tenancy model is established.

create table if not exists costing_rule_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  rules jsonb not null check (jsonb_typeof(rules) = 'array'),
  created_by text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (name, version)
);

create unique index if not exists costing_rule_sets_one_published_idx
  on costing_rule_sets (status)
  where status = 'published';

create index if not exists costing_rule_sets_status_version_idx
  on costing_rule_sets (status, version desc);

-- Publish a draft and archive the prior published version in one transaction.
create or replace function publish_costing_rule_set(p_draft_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $
declare
  draft_row costing_rule_sets%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('publish_costing_rule_set'));

  select * into draft_row
  from costing_rule_sets
  where id = p_draft_id
  for update;

  if not found or draft_row.status <> 'draft' then
    raise exception 'Only a draft costing rule set can be published';
  end if;

  update costing_rule_sets
  set status = 'archived'
  where status = 'published';

  update costing_rule_sets
  set status = 'published', published_at = now()
  where id = p_draft_id and status = 'draft';

  return p_draft_id;
end;
$;

revoke all on function publish_costing_rule_set(uuid) from public;
grant execute on function publish_costing_rule_set(uuid) to service_role;

create or replace function prevent_published_costing_rule_edits()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('published', 'archived') and (
    new.name is distinct from old.name or
    new.version is distinct from old.version or
    new.rules is distinct from old.rules or
    new.created_by is distinct from old.created_by or
    new.created_at is distinct from old.created_at or
    new.published_at is distinct from old.published_at
  ) then
    raise exception 'Published costing rule versions are immutable; create a new version instead';
  end if;
  return new;
end;
$;

drop trigger if exists costing_rule_sets_immutable_rules on costing_rule_sets;
create trigger costing_rule_sets_immutable_rules
  before update on costing_rule_sets
  for each row execute function prevent_published_costing_rule_edits();

alter table costing_rule_sets enable row level security;
drop policy if exists "authenticated read costing_rule_sets" on costing_rule_sets;
create policy "authenticated read costing_rule_sets"
  on costing_rule_sets for select to authenticated using (true);

insert into costing_rule_sets (name, version, status, rules, published_at)
select
  'Default costing rules',
  1,
  'published',
  '[
    {"id":"def-mr","name":"Roof material markup","section":"Roofing","ruleType":"material_markup","value":0.15},
    {"id":"def-lr","name":"Roof labour markup","section":"Roofing","ruleType":"labour_markup","value":0.15},
    {"id":"def-mw","name":"Wall material markup","section":"Wall Cladding","ruleType":"material_markup","value":0.30},
    {"id":"def-lw","name":"Wall labour markup","section":"Wall Cladding","ruleType":"labour_markup","value":0.30},
    {"id":"def-sj","name":"Small job fee","section":null,"ruleType":"small_job_fee","value":350},
    {"id":"def-me","name":"Measure fee","section":null,"ruleType":"measure_fee","value":1500},
    {"id":"def-dk","name":"Distance per km","section":null,"ruleType":"distance_rate_per_km","value":1.5}
  ]'::jsonb,
  now()
where not exists (
  select 1 from costing_rule_sets where status = 'published'
);

create table if not exists quote_calculation_snapshots (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  rule_set_id uuid not null references costing_rule_sets(id) on delete restrict,
  rule_set_version integer not null,
  engine_version text not null,
  input_snapshot jsonb not null,
  catalogue_snapshot jsonb not null,
  result_snapshot jsonb not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists quote_calculation_snapshots_quote_created_idx
  on quote_calculation_snapshots (quote_id, created_at desc);

alter table quote_calculation_snapshots enable row level security;
drop policy if exists "authenticated read quote_calculation_snapshots" on quote_calculation_snapshots;
create policy "authenticated read quote_calculation_snapshots"
  on quote_calculation_snapshots for select to authenticated using (true);
