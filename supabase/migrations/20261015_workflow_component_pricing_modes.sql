-- Upgrade the shipped default workflow so core work is explicitly priced by
-- the existing costing engine. Unpriced custom components must declare a mode.
do $upgrade_quote_workflow$
declare
  current_row quote_workflow_versions%rowtype;
  upgraded_definition jsonb;
begin
  select * into current_row
  from quote_workflow_versions
  where workflow_key = 'roofing-cladding' and status = 'published'
  order by version desc
  limit 1
  for update;

  if found
    and current_row.version = 1
    and not exists (
      select 1 from quote_workflow_versions
      where workflow_key = 'roofing-cladding' and version > 1
    )
  then
    upgraded_definition := jsonb_set(current_row.definition, '{version}', '2'::jsonb, true);

    select jsonb_set(
      upgraded_definition,
      '{components}',
      (
        select jsonb_agg(
          case
            when component ->> 'id' in ('roof-sheets', 'roof-labour', 'wall-sheets', 'wall-labour')
              then component || '{"pricingMode":"costing_engine"}'::jsonb
            else component
          end
          order by ordinal
        )
        from jsonb_array_elements(upgraded_definition -> 'components')
          with ordinality as items(component, ordinal)
      ),
      true
    )
    into upgraded_definition;

    update quote_workflow_versions
    set status = 'archived'
    where id = current_row.id and status = 'published';

    insert into quote_workflow_versions (
      workflow_key, name, version, status, definition, created_by, published_at
    )
    values (
      current_row.workflow_key,
      current_row.name,
      2,
      'published',
      upgraded_definition,
      current_row.created_by,
      now()
    );
  end if;
end;
$upgrade_quote_workflow$;
