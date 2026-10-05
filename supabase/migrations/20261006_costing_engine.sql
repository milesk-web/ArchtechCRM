-- Costing engine schema extensions
-- Compatible with existing quote_builder tables.
-- Run after the existing quote_builder migration.

-- ============================================================
-- Enhance materials if needed
-- ============================================================
alter table if exists materials
  add column if not exists family text,
  add column if not exists density_kg_per_m2 numeric;

-- ============================================================
-- Material rates (multi-dimensional lookup)
-- ============================================================
create table if not exists material_rates (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  profile_option_id uuid references profile_options(id) on delete set null,
  colour_id uuid references material_colours(id) on delete set null,
  unit text not null default 'm2' check (unit in ('m2', 'lm')),
  unit_cost numeric not null,
  effective_from date not null default current_date,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists material_rates_lookup_idx
  on material_rates (material_id, profile_id, profile_option_id, colour_id)
  where active = true;

-- ============================================================
-- Flashing enhancements
-- ============================================================
alter table if exists flashing_types
  add column if not exists typical_girth_mm numeric;

create table if not exists flashing_girth_bands (
  id uuid primary key default gen_random_uuid(),
  min_girth numeric not null,
  max_girth numeric not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists flashing_rates (
  id uuid primary key default gen_random_uuid(),
  flashing_type_id uuid references flashing_types(id) on delete cascade,
  girth_band_id uuid not null references flashing_girth_bands(id) on delete cascade,
  material_id uuid not null references materials(id) on delete cascade,
  unit_cost numeric not null,
  effective_from date not null default current_date,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists flashing_rates_lookup_idx
  on flashing_rates (girth_band_id, material_id, flashing_type_id)
  where active = true;

create table if not exists flashing_surcharges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  match_pattern text not null,
  unit_cost_per_lm numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Labour rates & factors
-- ============================================================
create table if not exists labour_rates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  section text check (section in ('Roofing', 'Wall Cladding', 'Spouting') or section is null),
  unit text not null default 'm2' check (unit in ('m2', 'lm', 'hour', 'each')),
  base_rate numeric not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists labour_factors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  factor_type text not null check (factor_type in ('pitch', 'complexity', 'profile')),
  match_value text not null,
  multiplier numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Pricing rules (mark-ups, fees)
-- ============================================================
create table if not exists pricing_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  section text check (section in ('Roofing', 'Wall Cladding') or section is null),
  rule_type text not null check (rule_type in (
    'material_markup', 'labour_markup',
    'small_job_fee', 'measure_fee',
    'travel_rate_per_hour', 'distance_rate_per_km',
    'meal_allowance', 'accommodation_per_week'
  )),
  value numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Underlay enhancements
-- ============================================================
alter table if exists underlays
  add column if not exists brand text,
  add column if not exists effective_m2_factor numeric default 1.0;

-- ============================================================
-- RLS (permissive authenticated – adjust later for multi-tenant)
-- ============================================================
alter table material_rates enable row level security;
alter table flashing_girth_bands enable row level security;
alter table flashing_rates enable row level security;
alter table flashing_surcharges enable row level security;
alter table labour_rates enable row level security;
alter table labour_factors enable row level security;
alter table pricing_rules enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'authenticated read material_rates') then
    create policy "authenticated read material_rates" on material_rates for select to authenticated using (true);
    create policy "authenticated write material_rates" on material_rates for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'authenticated read flashing_girth_bands') then
    create policy "authenticated read flashing_girth_bands" on flashing_girth_bands for select to authenticated using (true);
    create policy "authenticated write flashing_girth_bands" on flashing_girth_bands for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'authenticated read flashing_rates') then
    create policy "authenticated read flashing_rates" on flashing_rates for select to authenticated using (true);
    create policy "authenticated write flashing_rates" on flashing_rates for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'authenticated read flashing_surcharges') then
    create policy "authenticated read flashing_surcharges" on flashing_surcharges for select to authenticated using (true);
    create policy "authenticated write flashing_surcharges" on flashing_surcharges for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'authenticated read labour_rates') then
    create policy "authenticated read labour_rates" on labour_rates for select to authenticated using (true);
    create policy "authenticated write labour_rates" on labour_rates for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'authenticated read labour_factors') then
    create policy "authenticated read labour_factors" on labour_factors for select to authenticated using (true);
    create policy "authenticated write labour_factors" on labour_factors for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'authenticated read pricing_rules') then
    create policy "authenticated read pricing_rules" on pricing_rules for select to authenticated using (true);
    create policy "authenticated write pricing_rules" on pricing_rules for all to authenticated using (true) with check (true);
  end if;
end $$;
