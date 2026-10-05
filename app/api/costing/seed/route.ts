/**
 * POST /api/costing/seed
 * Fast, batched seed. Idempotent.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROFILE_RATES = [
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

const MATERIALS = [
  "KiwiColour Vitor+", "KiwiColour Vitor ZX", "KiwiColour VitorMG",
  "KiwiColour LUX", "Duralume", "Euramax", "Copper",
];

const PROFILE_DEFS: { name: string; section: string; mt: string; options: string[] }[] = [
  { name: "Super Seam", section: "Roofing", mt: "width", options: ["250", "450"] },
  { name: "Standing Seam", section: "Roofing", mt: "width", options: ["300", "500"] },
  { name: "Interlocking Panels", section: "Roofing", mt: "width", options: ["192", "193-295"] },
  { name: "Corrugated", section: "Roofing", mt: "gauge", options: ["0.4", "0.55"] },
  { name: "TRS5", section: "Roofing", mt: "gauge", options: ["0.4", "0.55"] },
  { name: "TRS6", section: "Roofing", mt: "gauge", options: ["0.4", "0.55"] },
  { name: "TRS7", section: "Roofing", mt: "gauge", options: ["0.55"] },
  { name: "TRS9", section: "Roofing", mt: "gauge", options: ["0.55"] },
  { name: "Super Seam", section: "Wall Cladding", mt: "width", options: ["250", "450"] },
  { name: "Standing Seam", section: "Wall Cladding", mt: "width", options: ["300", "500"] },
  { name: "Interlocking Panels", section: "Wall Cladding", mt: "width", options: ["192", "193-295"] },
  { name: "Corrugated", section: "Wall Cladding", mt: "gauge", options: ["0.4", "0.55"] },
  { name: "TRS5", section: "Wall Cladding", mt: "gauge", options: ["0.4", "0.55"] },
  { name: "TRS6", section: "Wall Cladding", mt: "gauge", options: ["0.4", "0.55"] },
  { name: "TRS9", section: "Wall Cladding", mt: "gauge", options: ["0.55"] },
];

const FLASHING_TYPES = [
  "Apron", "Apron Head", "Barge", "Barge Head", "Drip", "Parapet Cap",
  "Ridge", "Ridge Hip", "Roll Top Ridge", "Roll Top Hip", "Valley", "Soaker",
];

const GIRTH_BANDS = [
  [1, 50], [51, 100], [101, 150], [151, 200], [201, 250], [251, 300],
  [301, 350], [351, 400], [401, 450], [451, 500], [501, 550], [551, 600],
  [601, 650], [651, 700], [701, 750], [751, 800], [801, 850], [851, 900],
];

export async function POST() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY on Vercel" }, { status: 500 });
    }

    const summary: string[] = [];

    // ---- Materials (batch) ----
    const { data: existingMats, error: matSelErr } = await supabaseAdmin
      .from("materials").select("id, name");
    if (matSelErr) throw new Error(`materials: ${matSelErr.message}`);
    const matByName = new Map((existingMats ?? []).map((m) => [m.name, m.id]));
    const matsToInsert = MATERIALS.filter((n) => !matByName.has(n)).map((name, i) => ({
      name, active: true, sort_order: i,
    }));
    if (matsToInsert.length) {
      const { data: inserted, error } = await supabaseAdmin
        .from("materials").insert(matsToInsert).select("id, name");
      if (error) throw new Error(`materials insert: ${error.message}`);
      for (const m of inserted ?? []) matByName.set(m.name, m.id);
    }
    summary.push(`${matByName.size} materials`);

    // ---- Profiles (batch) ----
    const { data: existingProfiles, error: profSelErr } = await supabaseAdmin
      .from("profiles").select("id, name, section");
    if (profSelErr) throw new Error(`profiles: ${profSelErr.message}`);
    const profKey = (n: string, s: string) => `${s}::${n}`;
    const profByKey = new Map(
      (existingProfiles ?? []).map((p) => [profKey(p.name, p.section), p.id]),
    );
    const profsToInsert = PROFILE_DEFS.filter(
      (p) => !profByKey.has(profKey(p.name, p.section)),
    ).map((p, i) => ({
      name: p.name,
      section: p.section,
      measurement_type: p.mt,
      active: true,
      sort_order: i,
    }));
    if (profsToInsert.length) {
      const { data: inserted, error } = await supabaseAdmin
        .from("profiles").insert(profsToInsert).select("id, name, section");
      if (error) throw new Error(`profiles insert: ${error.message}`);
      for (const p of inserted ?? []) profByKey.set(profKey(p.name, p.section), p.id);
    }
    summary.push(`${profByKey.size} profiles`);

    // ---- Profile options (batch) ----
    const { data: existingOpts } = await supabaseAdmin
      .from("profile_options").select("id, profile_id, value");
    const optKey = (pid: string, v: string) => `${pid}::${v}`;
    const optByKey = new Map(
      (existingOpts ?? []).map((o) => [optKey(o.profile_id, o.value), o.id]),
    );
    const optsToInsert: { profile_id: string; value: string; active: boolean; sort_order: number }[] = [];
    for (const p of PROFILE_DEFS) {
      const pid = profByKey.get(profKey(p.name, p.section));
      if (!pid) continue;
      p.options.forEach((value, oi) => {
        if (!optByKey.has(optKey(pid, value))) {
          optsToInsert.push({ profile_id: pid, value, active: true, sort_order: oi });
        }
      });
    }
    if (optsToInsert.length) {
      const { data: inserted, error } = await supabaseAdmin
        .from("profile_options").insert(optsToInsert).select("id, profile_id, value");
      if (error) throw new Error(`profile_options insert: ${error.message}`);
      for (const o of inserted ?? []) optByKey.set(optKey(o.profile_id, o.value), o.id);
    }
    summary.push(`${optByKey.size} options`);

    // ---- Material rates (batch) ----
    const { data: existingRates, error: rateSelErr } = await supabaseAdmin
      .from("material_rates")
      .select("id, material_id, profile_id, profile_option_id");
    if (rateSelErr) {
      throw new Error(
        `material_rates: ${rateSelErr.message}. Run migration 20261006_costing_engine.sql in Supabase SQL editor.`,
      );
    }
    const rateKey = (m: string, p: string, o: string) => `${m}|${p}|${o}`;
    const rateSet = new Set(
      (existingRates ?? []).map((r) =>
        rateKey(r.material_id, r.profile_id, r.profile_option_id ?? ""),
      ),
    );
    const ratesToInsert: Record<string, unknown>[] = [];
    for (const row of PROFILE_RATES) {
      const profileId =
        profByKey.get(profKey(row.profile, "Roofing")) ??
        profByKey.get(profKey(row.profile, "Wall Cladding"));
      const materialId = matByName.get(row.material);
      if (!profileId || !materialId) continue;
      const optionId = optByKey.get(optKey(profileId, row.option));
      if (!optionId) continue;
      const k = rateKey(materialId, profileId, optionId);
      if (rateSet.has(k)) continue;
      rateSet.add(k);
      ratesToInsert.push({
        material_id: materialId,
        profile_id: profileId,
        profile_option_id: optionId,
        colour_id: null,
        unit: row.unit,
        unit_cost: row.unit_cost,
        active: true,
      });
    }
    if (ratesToInsert.length) {
      const { error } = await supabaseAdmin.from("material_rates").insert(ratesToInsert);
      if (error) throw new Error(`material_rates insert: ${error.message}`);
    }
    summary.push(`${ratesToInsert.length} new rates`);

    // ---- Flashing types (batch) ----
    const { data: existingFt } = await supabaseAdmin.from("flashing_types").select("id, name");
    const ftNames = new Set((existingFt ?? []).map((f) => f.name));
    const ftInsert = FLASHING_TYPES.filter((n) => !ftNames.has(n)).map((name, i) => ({
      name, unit: "lm", unit_cost: null, active: true, sort_order: i,
    }));
    if (ftInsert.length) {
      const { error } = await supabaseAdmin.from("flashing_types").insert(ftInsert);
      if (error) throw new Error(`flashing_types: ${error.message}`);
    }
    summary.push(`${ftInsert.length} flashings`);

    // ---- Girth bands (batch) ----
    const { data: existingBands, error: bandSelErr } = await supabaseAdmin
      .from("flashing_girth_bands").select("id, min_girth, max_girth");
    if (bandSelErr) {
      throw new Error(
        `flashing_girth_bands: ${bandSelErr.message}. Run migration 20261006_costing_engine.sql.`,
      );
    }
    const bandSet = new Set(
      (existingBands ?? []).map((b) => `${b.min_girth}-${b.max_girth}`),
    );
    const bandsInsert = GIRTH_BANDS.filter(([min, max]) => !bandSet.has(`${min}-${max}`)).map(
      ([min, max], i) => ({ min_girth: min, max_girth: max, sort_order: i, active: true }),
    );
    if (bandsInsert.length) {
      const { error } = await supabaseAdmin.from("flashing_girth_bands").insert(bandsInsert);
      if (error) throw new Error(`girth bands: ${error.message}`);
    }
    summary.push(`${bandsInsert.length} bands`);

    // ---- Labour rates (batch) ----
    const labourDefs = [
      { name: "Longrun", section: "Roofing", unit: "m2", base_rate: 16 },
      { name: "Tray / Architectural", section: "Roofing", unit: "m2", base_rate: 25 },
      { name: "Longrun", section: "Wall Cladding", unit: "m2", base_rate: 22 },
      { name: "Tray / Architectural", section: "Wall Cladding", unit: "m2", base_rate: 42 },
    ];
    const { data: existingLr, error: lrErr } = await supabaseAdmin
      .from("labour_rates").select("id, name, section");
    if (lrErr) {
      throw new Error(`labour_rates: ${lrErr.message}. Run migration 20261006_costing_engine.sql.`);
    }
    const lrSet = new Set((existingLr ?? []).map((r) => `${r.section}::${r.name}`));
    const lrInsert = labourDefs
      .filter((r) => !lrSet.has(`${r.section}::${r.name}`))
      .map((r) => ({ ...r, active: true }));
    if (lrInsert.length) {
      const { error } = await supabaseAdmin.from("labour_rates").insert(lrInsert);
      if (error) throw new Error(`labour_rates insert: ${error.message}`);
    }

    // ---- Labour factors ----
    const factorDefs = [
      { name: "Pitch 21-30", factor_type: "pitch", match_value: "21-30", multiplier: 1.15 },
      { name: "Pitch 31-40", factor_type: "pitch", match_value: "31-40", multiplier: 1.3 },
      { name: "Pitch 40+", factor_type: "pitch", match_value: "40+", multiplier: 1.5 },
    ];
    const { data: existingLf } = await supabaseAdmin.from("labour_factors").select("id, match_value");
    const lfSet = new Set((existingLf ?? []).map((f) => f.match_value));
    const lfInsert = factorDefs.filter((f) => !lfSet.has(f.match_value)).map((f) => ({ ...f, active: true }));
    if (lfInsert.length) {
      const { error } = await supabaseAdmin.from("labour_factors").insert(lfInsert);
      if (error) throw new Error(`labour_factors: ${error.message}`);
    }

    // ---- Pricing rules ----
    const ruleDefs = [
      { name: "Roof material markup", section: "Roofing", rule_type: "material_markup", value: 0.15 },
      { name: "Roof labour markup", section: "Roofing", rule_type: "labour_markup", value: 0.15 },
      { name: "Wall material markup", section: "Wall Cladding", rule_type: "material_markup", value: 0.3 },
      { name: "Wall labour markup", section: "Wall Cladding", rule_type: "labour_markup", value: 0.3 },
      { name: "Small job fee", section: null, rule_type: "small_job_fee", value: 350 },
      { name: "Measure fee", section: null, rule_type: "measure_fee", value: 1500 },
      { name: "Distance per km", section: null, rule_type: "distance_rate_per_km", value: 1.5 },
    ];
    const { data: existingRules } = await supabaseAdmin
      .from("pricing_rules").select("id, rule_type, section");
    const ruleSet = new Set(
      (existingRules ?? []).map((r) => `${r.rule_type}::${r.section ?? "null"}`),
    );
    const rulesInsert = ruleDefs
      .filter((r) => !ruleSet.has(`${r.rule_type}::${r.section ?? "null"}`))
      .map((r) => ({ ...r, active: true }));
    if (rulesInsert.length) {
      const { error } = await supabaseAdmin.from("pricing_rules").insert(rulesInsert);
      if (error) throw new Error(`pricing_rules: ${error.message}`);
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
