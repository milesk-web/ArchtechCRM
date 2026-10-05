/**
 * Seed costing data into Supabase.
 *
 * Usage (from project root, with env vars set):
 *   npx tsx scripts/seed-costing.ts
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import profileRates from "../seed/profile-rates.json";
import pricingRules from "../seed/pricing-rules.json";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

const WALL_PROFILES: { name: string; measurementType: "gauge" | "width"; options: string[] }[] = [
  { name: "Super Seam", measurementType: "width", options: ["250", "450"] },
  { name: "Standing Seam", measurementType: "width", options: ["300", "500"] },
  { name: "Interlocking Panels", measurementType: "width", options: ["192", "193-295"] },
  { name: "Corrugated", measurementType: "gauge", options: ["0.4", "0.55"] },
  { name: "TRS5", measurementType: "gauge", options: ["0.4", "0.55"] },
  { name: "TRS6", measurementType: "gauge", options: ["0.4", "0.55"] },
  { name: "TRS9", measurementType: "gauge", options: ["0.55"] },
];

const FLASHING_TYPES = [
  { name: "Apron", typicalGirthMm: 425 },
  { name: "Apron Head", typicalGirthMm: 375 },
  { name: "Apron Head SE", typicalGirthMm: 375 },
  { name: "Apron Side", typicalGirthMm: 425 },
  { name: "Apron Under", typicalGirthMm: 425 },
  { name: "Back Tray", typicalGirthMm: 675 },
  { name: "Barge", typicalGirthMm: 425 },
  { name: "Barge Head", typicalGirthMm: 375 },
  { name: "Barge Head SE", typicalGirthMm: 375 },
  { name: "Barge Head Under", typicalGirthMm: 175 },
  { name: "Barge Under", typicalGirthMm: 375 },
  { name: "Drip", typicalGirthMm: 225 },
  { name: "Parapet Cap", typicalGirthMm: 625 },
  { name: "Parapet Cap Under", typicalGirthMm: 625 },
  { name: "Ridge", typicalGirthMm: 575 },
  { name: 'Ridge "J" Under', typicalGirthMm: 225 },
  { name: "Ridge Full Under", typicalGirthMm: 625 },
  { name: "Ridge Hip", typicalGirthMm: 575 },
  { name: "Ridge Box Top SE", typicalGirthMm: 525 },
  { name: "Roll Top Ridge", typicalGirthMm: 200 },
  { name: "Roll Top Hip", typicalGirthMm: 200 },
  { name: "Valley", typicalGirthMm: 525 },
  { name: "Tek Under", typicalGirthMm: 275 },
  { name: "Soaker", typicalGirthMm: 175 },
];

const GIRTH_BANDS = [
  { min: 1, max: 50 }, { min: 51, max: 100 }, { min: 101, max: 150 },
  { min: 151, max: 200 }, { min: 201, max: 250 }, { min: 251, max: 300 },
  { min: 301, max: 350 }, { min: 351, max: 400 }, { min: 401, max: 450 },
  { min: 451, max: 500 }, { min: 501, max: 550 }, { min: 551, max: 600 },
  { min: 601, max: 650 }, { min: 651, max: 700 }, { min: 701, max: 750 },
  { min: 751, max: 800 }, { min: 801, max: 850 }, { min: 851, max: 900 },
  { min: 901, max: 950 }, { min: 951, max: 1000 }, { min: 1001, max: 1050 },
  { min: 1051, max: 1100 }, { min: 1101, max: 1150 }, { min: 1151, max: 1200 },
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

const UNDERLAYS = [
  { name: "Synthetic", unit: "m2", unitCost: null, effectiveM2Factor: 1.0 },
  { name: "Covertek 407", unit: "m2", unitCost: null, effectiveM2Factor: 1.12 },
  { name: "FRU 36", unit: "m2", unitCost: null, effectiveM2Factor: 1.12 },
  { name: "Ventia Iron", unit: "m2", unitCost: null, effectiveM2Factor: 1.0 },
];

async function upsertByName(
  table: string,
  rows: Record<string, unknown>[],
  nameKey = "name",
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data: existing, error: loadErr } = await sb.from(table).select(`id, ${nameKey}`);
  if (loadErr) throw loadErr;
  for (const row of existing ?? []) {
    map.set(String((row as any)[nameKey]), (row as any).id);
  }
  for (const row of rows) {
    const name = String(row[nameKey]);
    if (map.has(name)) continue;
    const { data, error } = await sb.from(table).insert(row).select("id").single();
    if (error) {
      console.error(`Failed to insert into ${table}:`, name, error.message);
      continue;
    }
    map.set(name, data.id);
  }
  return map;
}

async function main() {
  console.log("Seeding costing data...\n");

  console.log("Materials...");
  const materialIds = await upsertByName(
    "materials",
    MATERIALS.map((name, i) => ({ name, active: true, sort_order: i })),
  );
  console.log(`  ${materialIds.size} materials`);

  console.log("Profiles...");
  const profileIds = new Map<string, string>();
  for (const [section, list] of [
    ["Roofing", ROOF_PROFILES],
    ["Wall Cladding", WALL_PROFILES],
  ] as const) {
    for (const [i, p] of list.entries()) {
      const { data: existing } = await sb
        .from("profiles")
        .select("id")
        .eq("name", p.name)
        .eq("section", section)
        .maybeSingle();
      let profileId: string;
      if (existing) {
        profileId = existing.id;
      } else {
        const { data, error } = await sb
          .from("profiles")
          .insert({
            name: p.name,
            section,
            measurement_type: p.measurementType,
            active: true,
            sort_order: i,
          })
          .select("id")
          .single();
        if (error) {
          console.error("Profile insert failed:", p.name, error.message);
          continue;
        }
        profileId = data.id;
      }
      profileIds.set(`${section}::${p.name}`, profileId);
      for (const [oi, opt] of p.options.entries()) {
        const { data: optExisting } = await sb
          .from("profile_options")
          .select("id")
          .eq("profile_id", profileId)
          .eq("value", opt)
          .maybeSingle();
        if (!optExisting) {
          await sb.from("profile_options").insert({
            profile_id: profileId,
            value: opt,
            active: true,
            sort_order: oi,
          });
        }
      }
    }
  }
  console.log(`  ${profileIds.size} profiles`);

  console.log("Material rates...");
  let rateCount = 0;
  for (const row of profileRates as any[]) {
    let profileId =
      profileIds.get(`Roofing::${row.profile}`) ??
      profileIds.get(`Wall Cladding::${row.profile}`);
    if (!profileId) {
      console.warn(`  skip – profile not found: ${row.profile}`);
      continue;
    }
    const materialId = materialIds.get(row.material);
    if (!materialId) {
      console.warn(`  skip – material not found: ${row.material}`);
      continue;
    }
    const { data: option } = await sb
      .from("profile_options")
      .select("id")
      .eq("profile_id", profileId)
      .eq("value", row.option)
      .maybeSingle();
    if (!option) {
      console.warn(`  skip – option not found: ${row.profile} ${row.option}`);
      continue;
    }
    const { data: existingRate } = await sb
      .from("material_rates")
      .select("id")
      .eq("material_id", materialId)
      .eq("profile_id", profileId)
      .eq("profile_option_id", option.id)
      .is("colour_id", null)
      .maybeSingle();
    if (existingRate) continue;
    const { error } = await sb.from("material_rates").insert({
      material_id: materialId,
      profile_id: profileId,
      profile_option_id: option.id,
      colour_id: null,
      unit: row.unit ?? "m2",
      unit_cost: row.unit_cost,
      active: true,
    });
    if (error) console.error("  rate insert failed:", error.message);
    else rateCount++;
  }
  console.log(`  ${rateCount} material rates inserted`);

  console.log("Flashing types...");
  const flashingTypeIds = await upsertByName(
    "flashing_types",
    FLASHING_TYPES.map((f, i) => ({
      name: f.name,
      typical_girth_mm: f.typicalGirthMm,
      unit: "lm",
      unit_cost: null,
      active: true,
      sort_order: i,
    })),
  );
  console.log(`  ${flashingTypeIds.size} flashing types`);

  console.log("Girth bands...");
  let bandCount = 0;
  for (const [i, b] of GIRTH_BANDS.entries()) {
    const { data: existing } = await sb
      .from("flashing_girth_bands")
      .select("id")
      .eq("min_girth", b.min)
      .eq("max_girth", b.max)
      .maybeSingle();
    if (existing) continue;
    const { error } = await sb.from("flashing_girth_bands").insert({
      min_girth: b.min,
      max_girth: b.max,
      sort_order: i,
      active: true,
    });
    if (!error) bandCount++;
  }
  console.log(`  ${bandCount} girth bands inserted`);

  console.log("Labour rates...");
  for (const r of LABOUR_RATES) {
    const { data: existing } = await sb
      .from("labour_rates")
      .select("id")
      .eq("name", r.name)
      .eq("section", r.section)
      .maybeSingle();
    if (existing) continue;
    await sb.from("labour_rates").insert({
      name: r.name,
      section: r.section,
      unit: r.unit,
      base_rate: r.baseRate,
      active: true,
    });
  }
  console.log("  done");

  console.log("Labour factors...");
  for (const f of LABOUR_FACTORS) {
    const { data: existing } = await sb
      .from("labour_factors")
      .select("id")
      .eq("factor_type", f.factorType)
      .eq("match_value", f.matchValue)
      .maybeSingle();
    if (existing) continue;
    await sb.from("labour_factors").insert({
      name: f.name,
      factor_type: f.factorType,
      match_value: f.matchValue,
      multiplier: f.multiplier,
      active: true,
    });
  }
  console.log("  done");

  console.log("Pricing rules...");
  for (const r of pricingRules as any[]) {
    const { data: existing } = await sb
      .from("pricing_rules")
      .select("id")
      .eq("rule_type", r.rule_type)
      .eq("section", r.section)
      .maybeSingle();
    if (existing) continue;
    await sb.from("pricing_rules").insert({
      name: r.name,
      section: r.section,
      rule_type: r.rule_type,
      value: r.value,
      active: true,
    });
  }
  console.log("  done");

  console.log("Underlays...");
  for (const [i, u] of UNDERLAYS.entries()) {
    const { data: existing } = await sb
      .from("underlays")
      .select("id")
      .eq("name", u.name)
      .maybeSingle();
    if (existing) continue;
    await sb.from("underlays").insert({
      name: u.name,
      unit: u.unit,
      unit_cost: u.unitCost,
      effective_m2_factor: u.effectiveM2Factor,
      active: true,
      sort_order: i,
    });
  }
  console.log("  done");

  console.log("\nSeed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
