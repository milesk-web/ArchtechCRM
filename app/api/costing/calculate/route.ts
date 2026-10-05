/**
 * POST /api/costing/calculate
 *
 * Body: QuoteInput (see lib/costing/types.ts)
 * Returns: QuoteResult + meta about loaded catalogue
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

async function loadSnapshot(): Promise<CatalogueSnapshot> {
  const [
    { data: profiles },
    { data: profileOptions },
    { data: materials },
    { data: colours },
    { data: materialRates },
    { data: flashingTypes },
    { data: flashingBands },
    { data: flashingRates },
    { data: flashingSurcharges },
    { data: underlays },
    { data: labourRates },
    { data: labourFactors },
    { data: accessories },
    { data: pricingRules },
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("*").eq("active", true),
    supabaseAdmin.from("profile_options").select("*").eq("active", true),
    supabaseAdmin.from("materials").select("*").eq("active", true),
    supabaseAdmin.from("material_colours").select("*").eq("active", true),
    supabaseAdmin.from("material_rates").select("*").eq("active", true),
    supabaseAdmin.from("flashing_types").select("*").eq("active", true),
    supabaseAdmin.from("flashing_girth_bands").select("*").eq("active", true),
    supabaseAdmin.from("flashing_rates").select("*").eq("active", true),
    supabaseAdmin.from("flashing_surcharges").select("*").eq("active", true),
    supabaseAdmin.from("underlays").select("*").eq("active", true),
    supabaseAdmin.from("labour_rates").select("*").eq("active", true),
    supabaseAdmin.from("labour_factors").select("*").eq("active", true),
    supabaseAdmin.from("accessories").select("*").eq("active", true),
    supabaseAdmin.from("pricing_rules").select("*").eq("active", true),
  ]);

  return {
    profiles: (profiles ?? []).map(
      (r): Profile => ({
        id: r.id,
        name: r.name,
        section: r.section,
        measurementType: r.measurement_type ?? "gauge",
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    profileOptions: (profileOptions ?? []).map(
      (r): ProfileOption => ({
        id: r.id,
        profileId: r.profile_id,
        value: r.value,
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    materials: (materials ?? []).map(
      (r): Material => ({
        id: r.id,
        name: r.name,
        family: r.family ?? undefined,
        densityKgPerM2: r.density_kg_per_m2 ?? null,
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    colours: (colours ?? []).map(
      (r): MaterialColour => ({
        id: r.id,
        materialId: r.material_id,
        name: r.name,
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    materialRates: (materialRates ?? []).map(
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
    flashingTypes: (flashingTypes ?? []).map(
      (r): FlashingType => ({
        id: r.id,
        name: r.name,
        typicalGirthMm: r.typical_girth_mm ?? null,
        unit: r.unit ?? "lm",
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    flashingBands: (flashingBands ?? []).map(
      (r): FlashingGirthBand => ({
        id: r.id,
        minGirth: Number(r.min_girth),
        maxGirth: Number(r.max_girth),
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    flashingRates: (flashingRates ?? []).map(
      (r): FlashingRate => ({
        id: r.id,
        flashingTypeId: r.flashing_type_id,
        girthBandId: r.girth_band_id,
        materialId: r.material_id,
        unitCost: Number(r.unit_cost),
      }),
    ),
    flashingSurcharges: (flashingSurcharges ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      matchPattern: r.match_pattern,
      unitCostPerLm: Number(r.unit_cost_per_lm),
    })),
    underlays: (underlays ?? []).map(
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
    labourRates: (labourRates ?? []).map(
      (r): LabourRate => ({
        id: r.id,
        name: r.name,
        section: r.section,
        unit: r.unit ?? "m2",
        baseRate: Number(r.base_rate),
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    labourFactors: (labourFactors ?? []).map(
      (r): LabourFactor => ({
        id: r.id,
        name: r.name,
        factorType: r.factor_type,
        matchValue: r.match_value,
        multiplier: Number(r.multiplier),
      }),
    ),
    accessories: (accessories ?? []).map(
      (r): Accessory => ({
        id: r.id,
        name: r.name,
        unit: r.unit ?? "each",
        unitCost: r.unit_cost != null ? Number(r.unit_cost) : null,
        packQty: r.pack_qty != null ? Number(r.pack_qty) : null,
        sortOrder: r.sort_order ?? 0,
      }),
    ),
    pricingRules: (pricingRules ?? []).map(
      (r): PricingRule => ({
        id: r.id,
        name: r.name,
        section: r.section,
        ruleType: r.rule_type,
        value: Number(r.value),
      }),
    ),
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
