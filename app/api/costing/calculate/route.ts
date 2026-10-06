/**
 * POST /api/costing/calculate
 * Body: QuoteInput → QuoteResult
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { calculateQuote } from "@/lib/costing/engine";
import type {
  CatalogueSnapshot,
  QuoteInput,
  MaterialRate,
  FlashingGirthBand,
  FlashingRate,
  LabourRate,
  LabourFactor,
  PricingRule,
  Profile,
  ProfileOption,
  Material,
  MaterialColour,
  Underlay,
  FlashingType,
  Accessory,
} from "@/lib/costing/types";

export const dynamic = "force-dynamic";

const DEFAULT_PRICING_RULES: PricingRule[] = [
  { id: "def-mr", name: "Roof material markup", section: "Roofing", ruleType: "material_markup", value: 0.15 },
  { id: "def-lr", name: "Roof labour markup", section: "Roofing", ruleType: "labour_markup", value: 0.15 },
  { id: "def-mw", name: "Wall material markup", section: "Wall Cladding", ruleType: "material_markup", value: 0.3 },
  { id: "def-lw", name: "Wall labour markup", section: "Wall Cladding", ruleType: "labour_markup", value: 0.3 },
  { id: "def-sj", name: "Small job fee", section: null, ruleType: "small_job_fee", value: 350 },
  { id: "def-me", name: "Measure fee", section: null, ruleType: "measure_fee", value: 1500 },
  { id: "def-dk", name: "Distance per km", section: null, ruleType: "distance_rate_per_km", value: 1.5 },
];

async function safeSelect(table: string) {
  const { data, error } = await supabaseAdmin.from(table).select("*").eq("active", true);
  if (error) {
    console.warn(`loadSnapshot: ${table}:`, error.message);
    return [];
  }
  return data ?? [];
}

async function loadSnapshot(): Promise<CatalogueSnapshot> {
  const [
    profiles,
    profileOptions,
    materials,
    colours,
    materialRates,
    flashingTypes,
    flashingBands,
    flashingRates,
    flashingSurcharges,
    underlays,
    labourRates,
    labourFactors,
    accessories,
  ] = await Promise.all([
    safeSelect("profiles"),
    safeSelect("profile_options"),
    safeSelect("materials"),
    safeSelect("material_colours"),
    safeSelect("material_rates"),
    safeSelect("flashing_types"),
    safeSelect("flashing_girth_bands"),
    safeSelect("flashing_rates"),
    safeSelect("flashing_surcharges"),
    safeSelect("underlays"),
    safeSelect("labour_rates"),
    safeSelect("labour_factors"),
    safeSelect("accessories"),
  ]);

  return {
    profiles: profiles.map(
      (r): Profile => ({
        id: r.id,
        name: r.name,
        section: r.section,
        measurementType: r.measurement_type ?? "gauge",
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    profileOptions: profileOptions.map(
      (r): ProfileOption => ({
        id: r.id,
        profileId: r.profile_id,
        value: r.value,
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    materials: materials.map(
      (r): Material => ({
        id: r.id,
        name: r.name,
        family: r.family ?? undefined,
        densityKgPerM2: r.density_kg_per_m2 ?? null,
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    colours: colours.map(
      (r): MaterialColour => ({
        id: r.id,
        materialId: r.material_id,
        name: r.name,
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    materialRates: materialRates.map(
      (r): MaterialRate => ({
        id: r.id,
        materialId: r.material_id,
        profileId: r.profile_id,
        profileOptionId: r.profile_option_id,
        colourId: r.colour_id,
        unit: r.unit === "lm" ? "lm" : "m2",
        unitCost: Number(r.unit_cost),
      }),
    ),
    flashingTypes: flashingTypes.map(
      (r): FlashingType => ({
        id: r.id,
        name: r.name,
        typicalGirthMm: r.typical_girth_mm ?? null,
        unit: r.unit ?? "lm",
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    flashingBands: flashingBands.map(
      (r): FlashingGirthBand => ({
        id: r.id,
        minGirth: Number(r.min_girth),
        maxGirth: Number(r.max_girth),
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    flashingRates: flashingRates.map(
      (r): FlashingRate => ({
        id: r.id,
        flashingTypeId: r.flashing_type_id,
        girthBandId: r.girth_band_id,
        materialId: r.material_id,
        unitCost: Number(r.unit_cost),
      }),
    ),
    flashingSurcharges: flashingSurcharges.map((r) => ({
      id: r.id,
      name: r.name,
      matchPattern: r.match_pattern,
      unitCostPerLm: Number(r.unit_cost_per_lm),
    })),
    underlays: underlays.map(
      (r): Underlay => ({
        id: r.id,
        name: r.name,
        brand: r.brand ?? undefined,
        unit: r.unit ?? "m2",
        unitCost: r.unit_cost != null ? Number(r.unit_cost) : null,
        effectiveM2Factor:
          r.effective_m2_factor != null ? Number(r.effective_m2_factor) : 1,
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    labourRates: labourRates.map(
      (r): LabourRate => ({
        id: r.id,
        name: r.name,
        section: r.section,
        unit: r.unit ?? "m2",
        baseRate: Number(r.base_rate),
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    labourFactors: labourFactors.map(
      (r): LabourFactor => ({
        id: r.id,
        name: r.name,
        factorType: r.factor_type,
        matchValue: r.match_value,
        multiplier: Number(r.multiplier),
      }),
    ),
    accessories: accessories.map(
      (r): Accessory => ({
        id: r.id,
        name: r.name,
        unit: r.unit ?? "each",
        unitCost: r.unit_cost != null ? Number(r.unit_cost) : null,
        packQty: r.pack_qty != null ? Number(r.pack_qty) : null,
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    // Existing pricing_rules table has a different schema — use defaults
    pricingRules: DEFAULT_PRICING_RULES,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QuoteInput;
    const catalogue = await loadSnapshot();
    const result = calculateQuote(body, catalogue);

    return NextResponse.json({
      result,
      meta: {
        ratesLoaded: catalogue.materialRates.length,
        bandsLoaded: catalogue.flashingBands.length,
        labourRatesLoaded: catalogue.labourRates.length,
        rulesLoaded: catalogue.pricingRules.length,
        profilesLoaded: catalogue.profiles.length,
        materialsLoaded: catalogue.materials.length,
      },
    });
  } catch (error) {
    console.error("costing/calculate error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Costing calculation failed",
      },
      { status: 500 },
    );
  }
}
