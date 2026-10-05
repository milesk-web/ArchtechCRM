/**
 * POST /api/costing/seed
 * One-click seed of costing data. Idempotent.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Inline rates so we never depend on JSON module resolution at runtime
const PROFILE_RATES: {
  profile: string;
  option: string;
  material: string;
  unit: string;
  unit_cost: number;
}[] = [
  { profile: "Super Seam", option: "250", material: "KiwiColour Vitor+", unit: "m2", unit_cost: 13.3322 },
  { profile: "Super Seam", option: "250", material: "KiwiColour Vitor ZX", unit: "m2", unit_cost: 15.59 },
  { profile: "Super Seam", option: "250", material: "KiwiColour LUX", unit: "m2", unit_cost: 17.869 },
  { profile: "Super Seam", option: "450", material: "KiwiColour Vitor+", unit: "m2", unit_cost: 17.869 },
  { profile: "Super Seam", option: "450", material: "KiwiColour Vitor ZX", unit: "m2", unit_cost: 20.7045 },
  { profile: "Super Seam", option: "450", material: "KiwiColour LUX", unit: "m2", unit_cost: 23.54 },
  { profile: "Standing Seam", option: "300", material: "KiwiColour Vitor+", unit: "m2", unit_cost: 13.3322 },
  { profile: "Standing Seam", option: "300", material: "KiwiColour Vitor ZX", unit: "m2", unit_cost: 15.59 },
  { profile: "Standing Seam", option: "500", material: "KiwiColour Vitor+", unit: "m2", unit_cost: 17.869 },
  { profile: "Standing Seam", option: "500", material: "KiwiColour Vitor ZX", unit: "m2", unit_cost: 20.7045 },
  { profile: "Interlocking Panels", option: "192", material: "KiwiColour Vitor+", unit: "m2", unit_cost: 9.9296 },
  { profile: "Interlocking Panels", option: "193-295", material: "KiwiColour Vitor+", unit: "m2", unit_cost: 13.3322 },
  { profile: "Corrugated", option: "0.4", material: "KiwiColour Vitor+", unit: "m2", unit_cost: 14.7446 },
  { profile: "Corrugated", option: "0.4", material: "Duralume", unit: "m2", unit_cost: 10.35 },
  { profile: "Corrugated", option: "0.55", material: "KiwiColour Vitor+", unit: "m2", unit_cost: 17.89 },
  { profile: "Corrugated", option: "0.55", material: "Duralume", unit: "m2", unit_cost: 14.01 },
  { profile: "Corrugated", option: "0.55", material: "KiwiColour LUX", unit: "m2", unit_cost: 29.15 },
  { profile: "TRS5", option: "0.4", material: "KiwiColour Vitor+", unit: "m2", unit_cost: 14.7446 },
  { profile: "TRS5", option: "0.4", material: "Duralume", unit: "m2", unit_cost: 10.35 },
  { profile: "TRS5", option: "0.55", material: "KiwiColour Vitor+", unit: "m2", unit_cost: 17.89 },
  { profile: "TRS5", option: "0.55", material: "KiwiColour Vitor ZX", unit: "m2", unit_cost: 21.64 },
  { profile: "TRS5", option: "0.55", material: "Duralume", unit: "m2", unit_cost: 14.01 },
  { profile: "TRS5", option: "0.55", material: "KiwiColour LUX", unit: "m2", unit_cost: 29.1468 },
  { profile: "TRS6", option: "0.55", material: "KiwiColour Vitor+", unit: "m2", unit_cost: 17.89 },
  { profile: "TRS7", option: "0.55", material: "KiwiColour Vitor+", unit: "m2", unit_cost: 23.5935 },
  { profile: "TRS9", option: "0.55", material: "KiwiColour Vitor+", unit: "m2", unit_cost: 22.12 },
];

const PRICING_RULES = [
  { name: "Roof material markup", section: "Roofing", rule_type: "material_markup", value: 0.15 },
  { name: "Roof labour markup", section: "Roofing", rule_type: "labour_markup", value: 0.15 },
  { name: "Wall material markup", section: "Wall Cladding", rule_type: "material_markup", value: 0.3 },
  { name: "Wall labour markup", section: "Wall Cladding", rule_type: "labour_markup", value: 0.3 },
  { name: "Small job fee", section: null as string | null, rule_type: "small_job_fee", value: 350 },
  { name: "Measure fee", section: null as string | null, rule_type: "measure_fee", value: 1500 },
  { name: "Distance per km", section: null as string | null, rule_type: "distance_rate_per_km", value: 1.5 },
];

const MATERIALS = [
  "KiwiColour Vitor+",
  "KiwiColour Vitor ZX",
  "KiwiColour VitorMG",
  "KiwiColour LUX",
  "Duralume",
  "Euramax",
  "Copper",
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
  "Apron", "Apron Head", "Barge", "Barge Head", "Drip", "Parapet Cap",
  "Ridge", "Ridge Hip", "Roll Top Ridge", "Roll Top Hip", "Valley", "Soaker",
];

const GIRTH_BANDS = [
  [1, 50], [51, 100], [101, 150], [151, 200], [201, 250], [251, 300],
  [301, 350], [351, 400], [401, 450], [451, 500], [501, 550], [551, 600],
  [601, 650], [651, 700], [701, 750], [751, 800], [801, 850], [851, 900],
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
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("materials").select("id").eq("name", name).maybeSingle();
  if (selErr) throw new Error(`materials table: ${selErr.message}`);
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
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("profiles").select("id").eq("name", name).eq("section", section).maybeSingle();
  if (selErr) throw new Error(`profiles table: ${selErr.message}`);
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
    // Fail fast with a clear message if env is missing
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL on the server." },
        { status: 500 },
      );
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY on the server (Vercel env)." },
        { status: 500 },
      );
    }

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

    // material_rates – may not exist if migration not run
    let rateCount = 0;
    let rateErrors = 0;
    for (const row of PROFILE_RATES) {
      const profileId =
        profileIds.get(`Roofing::${row.profile}`) ??
        profileIds.get(`Wall Cladding::${row.profile}`);
      const materialId = materialIds.get(row.material);
      if (!profileId || !materialId) continue;

      const { data: option } = await supabaseAdmin
        .from("profile_options").select("id")
        .eq("profile_id", profileId).eq("value", row.option).maybeSingle();
      if (!option) continue;

      const { data: existing, error: existErr } = await supabaseAdmin
        .from("material_rates").select("id")
        .eq("material_id", materialId).eq("profile_id", profileId)
        .eq("profile_option_id", option.id).is("colour_id", null).maybeSingle();

      if (existErr) {
        return NextResponse.json(
          {
            error:
              `material_rates table error: ${existErr.message}. ` +
              "Did you run the costing migration (20261006_costing_engine.sql) in Supabase?",
          },
          { status: 500 },
        );
      }
      if (existing) continue;

      const { error } = await supabaseAdmin.from("material_rates").insert({
        material_id: materialId,
        profile_id: profileId,
        profile_option_id: option.id,
        colour_id: null,
        unit: row.unit,
        unit_cost: row.unit_cost,
        active: true,
      });
      if (error) rateErrors++;
      else rateCount++;
    }
    summary.push(`${rateCount} rates (${rateErrors} skipped)`);

    // Flashing types (no typical_girth_mm required)
    let ftCount = 0;
    for (const [i, name] of FLASHING_TYPES.entries()) {
      const { data: existing } = await supabaseAdmin
        .from("flashing_types").select("id").eq("name", name).maybeSingle();
      if (existing) continue;
      const { error } = await supabaseAdmin.from("flashing_types").insert({
        name,
        unit: "lm",
        unit_cost: null,
        active: true,
        sort_order: i,
      });
      if (!error) ftCount++;
    }
    summary.push(`${ftCount} flashings`);

    // Girth bands
    let bandCount = 0;
    for (const [i, [min, max]] of GIRTH_BANDS.entries()) {
      const { data: existing, error: bandSelErr } = await supabaseAdmin
        .from("flashing_girth_bands").select("id")
        .eq("min_girth", min).eq("max_girth", max).maybeSingle();
      if (bandSelErr) {
        return NextResponse.json(
          {
            error:
              `flashing_girth_bands: ${bandSelErr.message}. ` +
              "Run the costing migration in Supabase SQL editor.",
          },
          { status: 500 },
        );
      }
      if (existing) continue;
      const { error } = await supabaseAdmin.from("flashing_girth_bands").insert({
        min_girth: min, max_girth: max, sort_order: i, active: true,
      });
      if (!error) bandCount++;
    }
    summary.push(`${bandCount} bands`);

    // Labour rates
    for (const r of LABOUR_RATES) {
      const { data: existing, error: lrErr } = await supabaseAdmin
        .from("labour_rates").select("id")
        .eq("name", r.name).eq("section", r.section).maybeSingle();
      if (lrErr) {
        return NextResponse.json(
          {
            error:
              `labour_rates: ${lrErr.message}. Run the costing migration in Supabase.`,
          },
          { status: 500 },
        );
      }
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

    for (const r of PRICING_RULES) {
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
