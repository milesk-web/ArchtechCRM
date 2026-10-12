-- Versioned, conditional quote workflows.
-- Workflow definitions are global to this installation until organisation scoping
-- is added to the CRM's tenancy model.

create table if not exists quote_workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_key text not null,
  name text not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  created_by text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (workflow_key, version)
);

create unique index if not exists quote_workflow_one_published_idx
  on quote_workflow_versions (workflow_key)
  where status = 'published';

create index if not exists quote_workflow_status_version_idx
  on quote_workflow_versions (workflow_key, status, version desc);

create or replace function prevent_published_workflow_edits()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('published', 'archived') and (
    new.workflow_key is distinct from old.workflow_key or
    new.name is distinct from old.name or
    new.version is distinct from old.version or
    new.definition is distinct from old.definition or
    new.created_by is distinct from old.created_by or
    new.created_at is distinct from old.created_at or
    new.published_at is distinct from old.published_at
  ) then
    raise exception 'Published workflow versions are immutable; create a new version instead';
  end if;
  return new;
end;
$$;

drop trigger if exists quote_workflow_versions_immutable on quote_workflow_versions;
create trigger quote_workflow_versions_immutable
  before update on quote_workflow_versions
  for each row execute function prevent_published_workflow_edits();

-- Atomic publication keeps one published version per workflow key.
create or replace function publish_quote_workflow(p_draft_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $publish_quote_workflow$
declare
  draft_row quote_workflow_versions%rowtype;
begin
  select * into draft_row
  from quote_workflow_versions
  where id = p_draft_id
  for update;

  if not found or draft_row.status <> 'draft' then
    raise exception 'Only a draft workflow can be published';
  end if;

  perform pg_advisory_xact_lock(hashtext('quote-workflow'), hashtext(draft_row.workflow_key));

  update quote_workflow_versions
  set status = 'archived'
  where workflow_key = draft_row.workflow_key and status = 'published';

  update quote_workflow_versions
  set status = 'published', published_at = now()
  where id = p_draft_id and status = 'draft';

  return p_draft_id;
end;
$publish_quote_workflow$;

revoke all on function publish_quote_workflow(uuid) from public;
grant execute on function publish_quote_workflow(uuid) to service_role;

alter table quote_workflow_versions enable row level security;
drop policy if exists "authenticated read quote_workflow_versions" on quote_workflow_versions;

insert into quote_workflow_versions (workflow_key, name, version, status, definition, published_at)
select
  'roofing-cladding',
  'Roofing & Wall Cladding',
  1,
  'published',
  '{
    "key": "roofing-cladding",
    "name": "Roofing & Wall Cladding",
    "version": 1,
    "fields": [
      {"id":"includeRoof","label":"Include roofing","type":"boolean","defaultValue":true},
      {"id":"roof.areaM2","label":"Roof area (m²)","type":"number","required":true,"visibleWhen":{"field":"includeRoof","operator":"equals","value":true}},
      {"id":"includeWall","label":"Include wall cladding","type":"boolean","defaultValue":false},
      {"id":"wall.areaM2","label":"Wall cladding area (m²)","type":"number","required":true,"visibleWhen":{"field":"includeWall","operator":"equals","value":true}},
      {"id":"measureRequired","label":"Measurement visit required","type":"boolean","defaultValue":false},
      {"id":"isSmallJob","label":"Small job fee applies","type":"boolean","defaultValue":false}
    ],
    "components": [
      {"id":"roof-sheets","name":"Roof profile material","category":"Material","unit":"m²","quantity":{"kind":"field","field":"roof.areaM2"},"when":{"field":"includeRoof","operator":"equals","value":true}},
      {"id":"roof-labour","name":"Roof installation labour","category":"Labour","unit":"m²","quantity":{"kind":"field","field":"roof.areaM2"},"when":{"field":"includeRoof","operator":"equals","value":true}},
      {"id":"wall-sheets","name":"Wall profile material","category":"Material","unit":"m²","quantity":{"kind":"field","field":"wall.areaM2"},"when":{"field":"includeWall","operator":"equals","value":true}},
      {"id":"wall-labour","name":"Wall installation labour","category":"Labour","unit":"m²","quantity":{"kind":"field","field":"wall.areaM2"},"when":{"field":"includeWall","operator":"equals","value":true}}
    ]
  }'::jsonb,
  now()
where not exists (
  select 1 from quote_workflow_versions
  where workflow_key = 'roofing-cladding' and status = 'published'
);
