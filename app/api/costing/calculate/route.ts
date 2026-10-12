/**
 * POST /api/costing/calculate
 * Body: QuoteInput → QuoteResult
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
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

const ALLOWED_RULE_TYPES = new Set<PricingRule["ruleType"]>([
  "material_markup",
  "labour_markup",
  "small_job_fee",
  "measure_fee",
  "travel_rate_per_hour",
  "distance_rate_per_km",
  "meal_allowance",
  "accommodation_per_week",
]);

function parsePublishedRules(value: unknown): PricingRule[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("The published costing rule set is empty or invalid.");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Published costing rule ${index + 1} is invalid.`);
    }
    const rule = item as Record<string, unknown>;
    const section = rule.section;
    if (
      typeof rule.id !== "string" ||
      typeof rule.name !== "string" ||
      (section !== null && section !== "Roofing" && section !== "Wall Cladding") ||
      typeof rule.ruleType !== "string" ||
      !ALLOWED_RULE_TYPES.has(rule.ruleType as PricingRule["ruleType"]) ||
      typeof rule.value !== "number" ||
      !Number.isFinite(rule.value) ||
      rule.value < 0
    ) {
      throw new Error(`Published costing rule ${index + 1} has invalid fields.`);
    }
    if (
      (rule.ruleType === "material_markup" || rule.ruleType === "labour_markup") &&
      rule.value > 5
    ) {
      throw new Error(`Published markup rule "${rule.name}" exceeds the 500% safety limit.`);
    }
    return {
      id: rule.id,
      name: rule.name,
      section: section as PricingRule["section"],
      ruleType: rule.ruleType as PricingRule["ruleType"],
      value: rule.value,
    };
  });
}


async function safeSelect(table: string) {
  const { data, error } = await supabaseAdmin.from(table).select("*").eq("active", true);
  if (error) {
    throw new Error(`Unable to load costing catalogue table "${table}": ${error.message}`);
  }
  return data ?? [];
}

async function loadSnapshot(pricingRules: PricingRule[]): Promise<CatalogueSnapshot> {
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
    pricingRules,
  };
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const requestBody = (await request.json()) as QuoteInput & { quoteId?: unknown };
    if (!requestBody || typeof requestBody !== "object" || Array.isArray(requestBody)) {
      return NextResponse.json({ error: "Request body must be a quote input object" }, { status: 400 });
    }
    const { quoteId: rawQuoteId, ...body } = requestBody;
    if (rawQuoteId != null && (typeof rawQuoteId !== "string" || !rawQuoteId.trim())) {
      return NextResponse.json({ error: "quoteId must be a non-empty string." }, { status: 400 });
    }

    let quoteId: string | null = null;
    if (typeof rawQuoteId === "string") {
      quoteId = rawQuoteId;
      const { data: quote, error: quoteError } = await supabaseAdmin
        .from("quotes")
        .select("id, status")
        .eq("id", quoteId)
        .maybeSingle();
      if (quoteError) throw new Error(`Unable to verify quote: ${quoteError.message}`);
      if (!quote) return NextResponse.json({ error: "Quote not found." }, { status: 404 });
      if (quote.status !== "Draft") {
        return NextResponse.json({ error: "Only draft quotes can be recalculated." }, { status: 409 });
      }
    }

    const { data: ruleSet, error: ruleSetError } = await supabaseAdmin
      .from("costing_rule_sets")
      .select("id, name, version, rules")
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ruleSetError) {
      throw new Error(`Unable to load published costing rules. Apply the versioned costing migration first: ${ruleSetError.message}`);
    }
    if (!ruleSet) {
      throw new Error("No published costing rule set exists. Publish a costing rule set before calculating quotes.");
    }

    const pricingRules = parsePublishedRules(ruleSet.rules);
    const catalogue = await loadSnapshot(pricingRules);
    const result = calculateQuote(body as QuoteInput, catalogue);

    let snapshotId: string | null = null;
    if (quoteId) {
      const { data: snapshot, error: snapshotError } = await supabaseAdmin
        .from("quote_calculation_snapshots")
        .insert({
          quote_id: quoteId,
          rule_set_id: ruleSet.id,
          rule_set_version: ruleSet.version,
          engine_version: "1",
          input_snapshot: body,
          catalogue_snapshot: catalogue,
          result_snapshot: result,
          created_by: session.user.id,
        })
        .select("id")
        .single();
      if (snapshotError) {
        throw new Error(`Unable to preserve calculation snapshot. Apply the versioned costing migration first: ${snapshotError.message}`);
      }
      snapshotId = snapshot.id;
    }

    return NextResponse.json({
      result,
      meta: {
        ratesLoaded: catalogue.materialRates.length,
        bandsLoaded: catalogue.flashingBands.length,
        labourRatesLoaded: catalogue.labourRates.length,
        rulesLoaded: catalogue.pricingRules.length,
        ruleSetId: ruleSet.id,
        ruleSetName: ruleSet.name,
        ruleSetVersion: ruleSet.version,
        snapshotId,
        profilesLoaded: catalogue.profiles.length,
        materialsLoaded: catalogue.materials.length,
      },
    });
  } catch (error) {
    console.error("costing/calculate error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof SyntaxError
            ? "Request body must be valid JSON"
            : error instanceof Error
              ? error.message
              : "Costing calculation failed",
      },
      { status: error instanceof SyntaxError ? 400 : 500 },
    );
  }
}
