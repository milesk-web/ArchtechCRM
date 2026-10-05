/**
 * POST /api/costing/seed
 * One-click seed of costing data. Idempotent.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import profileRates from "@/seed/profile-rates.json";
import pricingRules from "@/seed/pricing-rules.json";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MATERIALS = [
  "KiwiColour Vitor+",
  "KiwiColour Vitor ZX",
  "KiwiColour VitorMG",
  "KiwiColour LUX",
  "Duralume",
  "Euramax",
  "Copper",
  "ColorCote",
  "Colorsteel",
  "Aluminium",
  "Corten",
];

const ROOF_PROFILES: { name: string; measurementType: "gauge" | "width"; options: string[] }[] = [
  { name: "Super Seam", measurementType: "width", options: ["250", "450"] },
  { name: "Standing Seam", measurementType: "width", options: ["300", "500"] },
  { name: "Interlocking Panels", measurementType: "width", options: ["192", "193-295"] },
  { name: "Corrugated", measurementType: "gauge", options: ["0.4", "0.55"] },
  { name: "TRS5", measurementType: "gauge", options: ["0.4", "0.55"] },
  { name: "TRS6", measurementType: "gauge", options: ["0.4", "0.55"] },
  { name: "TRS7", measurementType: "gauge", options: ["0.55"] },
  { name: "TRS9", measurementType: "gauge", options: ["0.55"] },
];

const WALL_PROFILES = ROOF_PROFILES.filter((p) => p.name !== "TRS7");

const FLASHING_TYPES = [
  { name: "Apron", typicalGirthMm: 425 },
  { name: "Apron Head", typicalGirthMm: 375 },
  { name: "Barge", typicalGirthMm: 425 },
  { name: "Barge Head", typicalGirthMm: 375 },
  { name: "Drip", typicalGirthMm: 225 },
  { name: "Parapet Cap", typicalGirthMm: 625 },
  { name: "Ridge", typicalGirthMm: 575 },
  { name: "Ridge Hip", typicalGirthMm: 575 },
  { name: "Roll Top Ridge", typicalGirthMm: 200 },
  { name: "Roll Top Hip", typicalGirthMm: 200 },
  { name: "Valley", typicalGirthMm: 525 },
  { name: "Soaker", typicalGirthMm: 175 },
];

const GIRTH_BANDS = [
  [1, 50], [51, 100], [101, 150], [151, 200], [201, 250], [251, 300],
  [301, 350], [351, 400], [401, 450], [451, 500], [501, 550], [551, 600],
  [601, 650], [651, 700], [701, 750], [751, 800], [801, 850], [851, 900],
  [901, 950], [951, 1000], [1001, 1050], [1051, 1100], [1101, 1150], [1151, 1200],
];

const LABOUR_RATES = [
  { name: "Longrun", section: "Roofing", unit: "m2", baseRate: 16 },
  { name: "Tray / Architectural", section: "Roofing", unit: "m2", baseRate: 25 },
  { name: "Longrun", section: "Wall Cladding", unit: "m2", baseRate: 22 },
  { name: "Tray / Architectural", section: "Wall Cladding", unit: "m2", baseRate: 42 },
];

const LABOUR_FACTORS = [
  { name: "Pitch 21-30", factorType: "pitch", matchValue: "21-30", multiplier: 1.15 },
  { name: "Pitch 31-40", factorType: "pitch", matchValue: "31-40", multiplier: 1.3 },
  { name: "Pitch 40+", factorType: "pitch", matchValue: "40+", multiplier: 1.5 },
];

async function ensureMaterial(name: string, sort: number): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("materials").select("id").eq("name", name).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabaseAdmin
    .from("materials")
    .insert({ name, active: true, sort_order: sort })
    .select("id").single();
  if (error) throw new Error(`material ${name}: ${error.message}`);
  return data.id;
}

async function ensureProfile(
  name: string, section: string, measurementType: string, sort: number,
): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("profiles").select("id").eq("name", name).eq("section", section).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .insert({ name, section, measurement_type: measurementType, active: true, sort_order: sort })
    .select("id").single();
  if (error) throw new Error(`profile ${name}: ${error.message}`);
  return data.id;
}

async function ensureOption(profileId: string, value: string, sort: number): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("profile_options").select("id")
    .eq("profile_id", profileId).eq("value", value).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabaseAdmin
    .from("profile_options")
    .insert({ profile_id: profileId, value, active: true, sort_order: sort })
    .select("id").single();
  if (error) throw new Error(`option ${value}: ${error.message}`);
  return data.id;
}

export async function POST() {
  try {
    const summary: string[] = [];

    const materialIds = new Map<string, string>();
    for (const [i, name] of MATERIALS.entries()) {
      materialIds.set(name, await ensureMaterial(name, i));
    }
    summary.push(`${materialIds.size} materials`);

    const profileIds = new Map<string, string>();
    for (const [section, list] of [
      ["Roofing", ROOF_PROFILES],
      ["Wall Cladding", WALL_PROFILES],
    ] as const) {
      for (const [i, p] of list.entries()) {
        const id = await ensureProfile(p.name, section, p.measurementType, i);
        profileIds.set(`${section}::${p.name}`, id);
        for (const [oi, opt] of p.options.entries()) {
          await ensureOption(id, opt, oi);
        }
      }
    }
    summary.push(`${profileIds.size} profiles`);

    let rateCount = 0;
    for (const row of profileRates as any[]) {
      const profileId =
        profileIds.get(`Roofing::${row.profile}`) ??
        profileIds.get(`Wall Cladding::${row.profile}`);
      const materialId = materialIds.get(row.material);
      if (!profileId || !materialId) continue;

      const { data: option } = await supabaseAdmin
        .from("profile_options").select("id")
        .eq("profile_id", profileId).eq("value", row.option).maybeSingle();
      if (!option) continue;

      const { data: existing } = await supabaseAdmin
        .from("material_rates").select("id")
        .eq("material_id", materialId).eq("profile_id", profileId)
        .eq("profile_option_id", option.id).is("colour_id", null).maybeSingle();
      if (existing) continue;

      const { error } = await supabaseAdmin.from("material_rates").insert({
        material_id: materialId,
        profile_id: profileId,
        profile_option_id: option.id,
        colour_id: null,
        unit: row.unit ?? "m2",
        unit_cost: row.unit_cost,
        active: true,
      });
      if (!error) rateCount++;
    }
    summary.push(`${rateCount} new rates`);

    let ftCount = 0;
    for (const [i, f] of FLASHING_TYPES.entries()) {
      const { data: existing } = await supabaseAdmin
        .from("flashing_types").select("id").eq("name", f.name).maybeSingle();
      if (existing) continue;
      const { error } = await supabaseAdmin.from("flashing_types").insert({
        name: f.name,
        typical_girth_mm: f.typicalGirthMm,
        unit: "lm",
        unit_cost: null,
        active: true,
        sort_order: i,
      });
      if (!error) ftCount++;
    }
    summary.push(`${ftCount} flashing types`);

    let bandCount = 0;
    for (const [i, [min, max]] of GIRTH_BANDS.entries()) {
      const { data: existing } = await supabaseAdmin
        .from("flashing_girth_bands").select("id")
        .eq("min_girth", min).eq("max_girth", max).maybeSingle();
      if (existing) continue;
      const { error } = await supabaseAdmin.from("flashing_girth_bands").insert({
        min_girth: min, max_girth: max, sort_order: i, active: true,
      });
      if (!error) bandCount++;
    }
    summary.push(`${bandCount} girth bands`);

    for (const r of LABOUR_RATES) {
      const { data: existing } = await supabaseAdmin
        .from("labour_rates").select("id")
        .eq("name", r.name).eq("section", r.section).maybeSingle();
      if (existing) continue;
      await supabaseAdmin.from("labour_rates").insert({
        name: r.name, section: r.section, unit: r.unit, base_rate: r.baseRate, active: true,
      });
    }

    for (const f of LABOUR_FACTORS) {
      const { data: existing } = await supabaseAdmin
        .from("labour_factors").select("id")
        .eq("factor_type", f.factorType).eq("match_value", f.matchValue).maybeSingle();
      if (existing) continue;
      await supabaseAdmin.from("labour_factors").insert({
        name: f.name, factor_type: f.factorType, match_value: f.matchValue,
        multiplier: f.multiplier, active: true,
      });
    }

    for (const r of pricingRules as any[]) {
      const { data: existing } = await supabaseAdmin
        .from("pricing_rules").select("id")
        .eq("rule_type", r.rule_type).eq("section", r.section).maybeSingle();
      if (existing) continue;
      await supabaseAdmin.from("pricing_rules").insert({
        name: r.name, section: r.section, rule_type: r.rule_type, value: r.value, active: true,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Seed complete: ${summary.join(", ")}.`,
    });
  } catch (error) {
    console.error("seed error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 },
    );
  }
}
