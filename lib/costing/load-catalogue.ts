/**
 * Load a CatalogueSnapshot for the pure costing engine.
 */

import type { CatalogueSnapshot } from "./types";

type AnyRow = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchTable(
  table: string,
  params?: Record<string, string>,
): Promise<AnyRow[]> {
  const search = new URLSearchParams({ table });
  if (params) {
    for (const [k, v] of Object.entries(params)) search.set(k, v);
  }
  const res = await fetch(`/api/catalogue?${search.toString()}`, {
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || `Failed to load ${table} (${res.status})`);
  }
  return json?.data ?? [];
}

export async function loadCatalogueSnapshot(): Promise<CatalogueSnapshot> {
  const [
    profilesRaw,
    materialsRaw,
    underlaysRaw,
    flashingTypesRaw,
    labourTypesRaw,
    accessoriesRaw,
  ] = await Promise.all([
    fetchTable("profiles"),
    fetchTable("materials"),
    fetchTable("underlays"),
    fetchTable("flashing_types"),
    fetchTable("labour_types").catch(() => []),
    fetchTable("accessories").catch(() => []),
  ]);

  const materialRatesRaw = await fetchTable("material_rates").catch(() =>
    fetchTable("material_prices").catch(() => []),
  );
  const flashingBandsRaw = await fetchTable("flashing_girth_bands").catch(() => []);
  const flashingPricesRaw = await fetchTable("flashing_rates").catch(() =>
    fetchTable("flashing_prices").catch(() => []),
  );
  const labourRatesRaw = await fetchTable("labour_rates").catch(() => labourTypesRaw);
  const labourFactorsRaw = await fetchTable("labour_factors").catch(() => []);
  const pricingRulesRaw = await fetchTable("pricing_rules").catch(() => []);

  const profiles = profilesRaw.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    section: r.section as "Roofing" | "Wall Cladding",
    measurementType: (r.measurement_type as "gauge" | "width") ?? "gauge",
    sortOrder: Number(r.sort_order ?? 0),
  }));

  const materials = materialsRaw.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    family: r.family != null ? String(r.family) : undefined,
    densityKgPerM2: num(r.density_kg_per_m2),
    sortOrder: Number(r.sort_order ?? 0),
  }));

  const underlays = underlaysRaw.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    brand: r.brand != null ? String(r.brand) : undefined,
    unit: String(r.unit ?? "m2"),
    unitCost: num(r.unit_cost),
    effectiveM2Factor: num(r.effective_m2_factor) ?? 1,
    sortOrder: Number(r.sort_order ?? 0),
  }));

  const flashingTypes = flashingTypesRaw.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    typicalGirthMm: num(r.typical_girth_mm) ?? num(r.typical_girth),
    unit: String(r.unit ?? "lm"),
    sortOrder: Number(r.sort_order ?? 0),
  }));

  const flashingBands = flashingBandsRaw.map((r) => ({
    id: String(r.id),
    minGirth: Number(r.min_girth),
    maxGirth: Number(r.max_girth),
    sortOrder: Number(r.sort_order ?? 0),
  }));

  const materialRates = materialRatesRaw.map((r) => ({
    id: String(r.id),
    materialId: String(r.material_id),
    profileId: String(r.profile_id),
    profileOptionId: r.profile_option_id != null ? String(r.profile_option_id) : null,
    colourId: r.colour_id != null ? String(r.colour_id) : null,
    unit: ((r.unit as string) === "lm" ? "lm" : "m2") as "m2" | "lm",
    unitCost: Number(r.unit_cost),
  }));

  const flashingRates = flashingPricesRaw.map((r) => ({
    id: String(r.id),
    flashingTypeId: r.flashing_type_id != null ? String(r.flashing_type_id) : null,
    girthBandId: String(r.girth_band_id ?? r.flashing_girth_band_id),
    materialId: String(r.material_id),
    unitCost: Number(r.unit_cost),
  }));

  const labourRates = labourRatesRaw.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    section: (r.section as any) ?? null,
    unit: (r.unit as any) ?? "m2",
    baseRate: num(r.base_rate) ?? num(r.rate) ?? 0,
    sortOrder: Number(r.sort_order ?? 0),
  }));

  const labourFactors = labourFactorsRaw.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    factorType: r.factor_type as "pitch" | "complexity" | "profile",
    matchValue: String(r.match_value),
    multiplier: Number(r.multiplier),
  }));

  const accessories = accessoriesRaw.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    unit: String(r.unit ?? "each"),
    unitCost: num(r.unit_cost),
    packQty: num(r.pack_qty),
    sortOrder: Number(r.sort_order ?? 0),
  }));

  const pricingRules =
    pricingRulesRaw.length > 0
      ? pricingRulesRaw.map((r) => ({
          id: String(r.id),
          name: String(r.name),
          section: (r.section as any) ?? null,
          ruleType: r.rule_type as any,
          value: Number(r.value),
        }))
      : [
          { id: "def-mr", name: "Roof material markup", section: "Roofing" as const, ruleType: "material_markup" as const, value: 0.15 },
          { id: "def-lr", name: "Roof labour markup", section: "Roofing" as const, ruleType: "labour_markup" as const, value: 0.15 },
          { id: "def-mw", name: "Wall material markup", section: "Wall Cladding" as const, ruleType: "material_markup" as const, value: 0.3 },
          { id: "def-lw", name: "Wall labour markup", section: "Wall Cladding" as const, ruleType: "labour_markup" as const, value: 0.3 },
          { id: "def-sj", name: "Small job fee", section: null, ruleType: "small_job_fee" as const, value: 350 },
          { id: "def-me", name: "Measure fee", section: null, ruleType: "measure_fee" as const, value: 1500 },
          { id: "def-dk", name: "Distance per km", section: null, ruleType: "distance_rate_per_km" as const, value: 1.5 },
        ];

  return {
    profiles,
    profileOptions: [],
    materials,
    colours: [],
    materialRates,
    flashingTypes,
    flashingBands,
    flashingRates,
    flashingSurcharges: [],
    underlays,
    labourRates,
    labourFactors,
    accessories,
    pricingRules,
  };
}
