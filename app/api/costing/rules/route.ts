import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCostingAdmin } from "@/lib/auth/costing-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

const RULE_TYPES = new Set([
  "material_markup",
  "labour_markup",
  "small_job_fee",
  "measure_fee",
  "travel_rate_per_hour",
  "distance_rate_per_km",
  "meal_allowance",
  "accommodation_per_week",
]);
const SECTIONS = new Set(["Roofing", "Wall Cladding"]);

type Rule = {
  id: string;
  name: string;
  section: "Roofing" | "Wall Cladding" | null;
  ruleType: string;
  value: number;
};

function validateRules(value: unknown): { rules?: Rule[]; errors: string[] } {
  if (!Array.isArray(value) || value.length === 0) {
    return { errors: ["Provide at least one costing rule."] };
  }

  const errors: string[] = [];
  const rules: Rule[] = [];
  const keys = new Set<string>();

  for (const [index, raw] of value.entries()) {
    if (!raw || typeof raw !== "object") {
      errors.push(`Rule ${index + 1} is invalid.`);
      continue;
    }
    const row = raw as Record<string, unknown>;
    const section = row.section;
    const ruleType = row.ruleType;
    const key = `${String(ruleType)}::${String(section)}`;

    if (
      typeof row.id !== "string" || !row.id.trim() ||
      typeof row.name !== "string" || !row.name.trim() ||
      (section !== null && (typeof section !== "string" || !SECTIONS.has(section))) ||
      typeof ruleType !== "string" || !RULE_TYPES.has(ruleType) ||
      typeof row.value !== "number" || !Number.isFinite(row.value) || row.value < 0
    ) {
      errors.push(`Rule ${index + 1} has invalid fields or a negative/non-finite value.`);
      continue;
    }
    if (keys.has(key)) {
      errors.push(`Only one rule is allowed for ${ruleType} / ${section ?? "All sections"}.`);
      continue;
    }
    keys.add(key);

    if ((ruleType === "material_markup" || ruleType === "labour_markup") &&
        (section == null || row.value > 5)) {
      errors.push(`Markup rule "${row.name}" must target a section and cannot exceed 500%.`);
      continue;
    }
    if (!["material_markup", "labour_markup"].includes(ruleType) && section !== null) {
      errors.push(`Fee/rate rule "${row.name}" must be global (no section).`);
      continue;
    }

    rules.push({
      id: row.id.trim(),
      name: row.name.trim(),
      section: section as Rule["section"],
      ruleType,
      value: row.value,
    });
  }

  for (const required of [
    "material_markup::Roofing",
    "labour_markup::Roofing",
    "material_markup::Wall Cladding",
    "labour_markup::Wall Cladding",
  ]) {
    if (!keys.has(required)) errors.push(`Required markup rule is missing: ${required.replace("::", " / ")}.`);
  }

  return errors.length ? { errors } : { rules, errors };
}

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = isCostingAdmin(session.user.email);
  try {
    const [publishedResult, draftResult] = await Promise.all([
      supabaseAdmin
        .from("costing_rule_sets")
        .select("id, name, version, status, rules, published_at, created_at")
        .eq("status", "published")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      canEdit
        ? supabaseAdmin
            .from("costing_rule_sets")
            .select("id, name, version, status, rules, published_at, created_at")
            .eq("status", "draft")
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (publishedResult.error || draftResult.error) {
      throw new Error(
        publishedResult.error?.message ?? draftResult.error?.message ?? "Unable to load costing rule sets.",
      );
    }

    return NextResponse.json({
      published: publishedResult.data,
      draft: draftResult.data,
      canEdit,
    });
  } catch (error) {
    console.error("costing/rules GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load costing rules." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isCostingAdmin(session.user.email)) {
    return NextResponse.json(
      { error: "Costing rule changes require an authorised email in COSTING_ADMIN_EMAILS." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
    }

    if (body.action === "saveDraft") {
      const validation = validateRules(body.rules);
      if (!validation.rules) {
        return NextResponse.json({ error: "Costing rules are invalid.", details: validation.errors }, { status: 422 });
      }

      const { data: draft, error: draftError } = await supabaseAdmin
        .from("costing_rule_sets")
        .select("id, name, version")
        .eq("status", "draft")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (draftError) throw new Error(`Unable to find draft rules: ${draftError.message}`);

      if (draft) {
        const { data, error } = await supabaseAdmin
          .from("costing_rule_sets")
          .update({ rules: validation.rules, created_by: session.user.id })
          .eq("id", draft.id)
          .eq("status", "draft")
          .select("id, name, version, status, rules, published_at, created_at")
          .single();
        if (error) throw new Error(`Unable to save draft rules: ${error.message}`);
        return NextResponse.json({ draft: data });
      }

      const { data: latest, error: latestError } = await supabaseAdmin
        .from("costing_rule_sets")
        .select("version, name")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw new Error(`Unable to determine next rule version: ${latestError.message}`);

      const { data, error } = await supabaseAdmin
        .from("costing_rule_sets")
        .insert({
          name: latest?.name ?? "Default costing rules",
          version: (latest?.version ?? 0) + 1,
          status: "draft",
          rules: validation.rules,
          created_by: session.user.id,
        })
        .select("id, name, version, status, rules, published_at, created_at")
        .single();
      if (error) throw new Error(`Unable to create draft rules: ${error.message}`);
      return NextResponse.json({ draft: data }, { status: 201 });
    }

    if (body.action === "publish") {
      if (typeof body.draftId !== "string" || !body.draftId.trim()) {
        return NextResponse.json({ error: "draftId is required to publish." }, { status: 400 });
      }

      const { data: draft, error: draftError } = await supabaseAdmin
        .from("costing_rule_sets")
        .select("id, status")
        .eq("id", body.draftId)
        .maybeSingle();
      if (draftError) throw new Error(`Unable to load draft rules: ${draftError.message}`);
      if (!draft || draft.status !== "draft") {
        return NextResponse.json({ error: "Only an existing draft rule set can be published." }, { status: 409 });
      }

      const { data: publishedId, error: publishError } = await supabaseAdmin
        .rpc("publish_costing_rule_set", { p_draft_id: body.draftId });

      if (publishError || !publishedId) {
        throw new Error(publishError?.message ?? "Draft could not be published.");
      }

      const { data, error } = await supabaseAdmin
        .from("costing_rule_sets")
        .select("id, name, version, status, rules, published_at, created_at")
        .eq("id", publishedId)
        .single();
      if (error) throw new Error(`Published, but unable to reload rule set: ${error.message}`);

      return NextResponse.json({ published: data });
    }

    return NextResponse.json({ error: "Unsupported action. Use saveDraft or publish." }, { status: 400 });
  } catch (error) {
    console.error("costing/rules POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save costing rules." },
      { status: 500 },
    );
  }
}
