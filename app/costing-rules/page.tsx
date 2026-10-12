"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RuleType =
  | "material_markup"
  | "labour_markup"
  | "small_job_fee"
  | "measure_fee"
  | "travel_rate_per_hour"
  | "distance_rate_per_km"
  | "meal_allowance"
  | "accommodation_per_week";

type CostingRule = {
  id: string;
  name: string;
  section: "Roofing" | "Wall Cladding" | null;
  ruleType: RuleType;
  value: number;
};

type RuleSet = {
  id: string;
  name: string;
  version: number;
  status: "draft" | "published" | "archived";
  rules: CostingRule[];
  published_at: string | null;
  created_at: string;
};

const RULE_TYPES: Array<{ value: RuleType; label: string; unit: string }> = [
  { value: "material_markup", label: "Material markup", unit: "%" },
  { value: "labour_markup", label: "Labour markup", unit: "%" },
  { value: "small_job_fee", label: "Small job fee", unit: "NZD" },
  { value: "measure_fee", label: "Measure fee", unit: "NZD" },
  { value: "distance_rate_per_km", label: "Distance rate per km", unit: "NZD/km" },
  { value: "travel_rate_per_hour", label: "Travel rate per hour", unit: "NZD/hour" },
  { value: "meal_allowance", label: "Meal allowance", unit: "NZD" },
  { value: "accommodation_per_week", label: "Accommodation per week", unit: "NZD" },
];

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || `Request failed (${response.status})`);
  }
}

export default function CostingRulesPage() {
  const [published, setPublished] = useState<RuleSet | null>(null);
  const [draft, setDraft] = useState<RuleSet | null>(null);
  const [rules, setRules] = useState<CostingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/costing/rules", { cache: "no-store" });
        const json = await readJson(response);
        if (!response.ok) throw new Error(json.error || "Unable to load costing rules.");
        setPublished(json.published ?? null);
        setDraft(json.draft ?? null);
        setRules((json.draft ?? json.published)?.rules ?? []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load costing rules.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function updateRule(index: number, updates: Partial<CostingRule>) {
    setRules((current) => current.map((rule, i) => i === index ? { ...rule, ...updates } : rule));
    setNotice("");
  }

  function addRule() {
    setRules((current) => [
      ...current,
      { id: crypto.randomUUID(), name: "New rule", section: null, ruleType: "small_job_fee", value: 0 },
    ]);
    setNotice("");
  }

  function removeRule(index: number) {
    setRules((current) => current.filter((_, i) => i !== index));
    setNotice("");
  }

  async function saveDraft(): Promise<RuleSet> {
    const response = await fetch("/api/costing/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveDraft", rules }),
    });
    const json = await readJson(response);
    if (!response.ok) {
      const details = Array.isArray(json.details) ? ` ${json.details.join(" ")}` : "";
      throw new Error((json.error || "Unable to save draft.") + details);
    }
    setDraft(json.draft);
    setRules(json.draft.rules);
    return json.draft as RuleSet;
  }

  async function onSaveDraft() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await saveDraft();
      setNotice(`Saved costing rule version ${saved.version} as a draft. It is not active until published.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save draft.");
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const savedDraft = await saveDraft();
      const response = await fetch("/api/costing/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", draftId: savedDraft.id }),
      });
      const json = await readJson(response);
      if (!response.ok) throw new Error(json.error || "Unable to publish costing rules.");
      setPublished(json.published);
      setDraft(null);
      setRules(json.published.rules);
      setNotice(`Costing rule version ${json.published.version} is now published. New calculations will use it; existing snapshots remain unchanged.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to publish costing rules.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-400">Archtech CRM · Pricing</p>
            <h1 className="mt-1 text-2xl font-semibold">Costing rules</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
              Version and publish the markups and job fees used by quote calculations.
            </p>
          </div>
          <Link href="/pricing" className="text-sm text-blue-700 hover:underline">Back to pricing</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-5 py-7">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Published version</p>
            <p className="mt-1 text-lg font-semibold">{published ? `v${published.version} · ${published.name}` : "No published version"}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {published?.published_at ? `Published ${new Date(published.published_at).toLocaleString()}` : "Apply the versioned costing migration to initialise rules."}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Working draft</p>
            <p className="mt-1 text-lg font-semibold">{draft ? `v${draft.version}` : "Not created yet"}</p>
            <p className="mt-1 text-sm text-zinc-500">Draft changes do not affect new quotes until published.</p>
          </div>
        </section>

        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {notice && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}

        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-500">Loading costing rules…</div>
        ) : (
          <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h2 className="font-medium">Rule set editor</h2>
                <p className="text-xs text-zinc-500">Markup values are entered as percentages; fees and rates are entered in NZ dollars.</p>
              </div>
              <button type="button" onClick={addRule} className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">Add rule</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Rule name</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Section</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule, index) => {
                    const type = RULE_TYPES.find((item) => item.value === rule.ruleType);
                    const isMarkup = rule.ruleType === "material_markup" || rule.ruleType === "labour_markup";
                    return (
                      <tr key={rule.id} className="border-t border-zinc-100">
                        <td className="px-4 py-2">
                          <input aria-label="Rule name" value={rule.name} onChange={(e) => updateRule(index, { name: e.target.value })} className="w-full rounded border border-zinc-200 px-2 py-2" />
                        </td>
                        <td className="px-4 py-2">
                          <select aria-label="Rule type" value={rule.ruleType} onChange={(e) => updateRule(index, { ruleType: e.target.value as RuleType, section: e.target.value === "material_markup" || e.target.value === "labour_markup" ? (rule.section ?? "Roofing") : null })} className="w-full rounded border border-zinc-200 px-2 py-2">
                            {RULE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <select aria-label="Rule section" value={rule.section ?? ""} disabled={!isMarkup} onChange={(e) => updateRule(index, { section: e.target.value ? e.target.value as CostingRule["section"] : null })} className="w-full rounded border border-zinc-200 px-2 py-2 disabled:bg-zinc-100">
                            <option value="">Global</option>
                            <option value="Roofing">Roofing</option>
                            <option value="Wall Cladding">Wall Cladding</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input aria-label="Rule value" type="number" min="0" max={isMarkup ? 500 : undefined} step={isMarkup ? 0.5 : 0.01} value={isMarkup ? Number((rule.value * 100).toFixed(4)) : rule.value} onChange={(e) => updateRule(index, { value: (Number(e.target.value) || 0) / (isMarkup ? 100 : 1) })} className="w-28 rounded border border-zinc-200 px-2 py-2" />
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-500">{type?.unit ?? "NZD"}</td>
                        <td className="px-4 py-2">
                          <button type="button" onClick={() => removeRule(index)} className="text-xs text-red-700 hover:underline">Remove</button>
                        </td>
                      </tr>
                    );
                  })}
                  {rules.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No rules. Add the required markup rules to continue.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-4">
              <button type="button" onClick={onSaveDraft} disabled={saving || rules.length === 0} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? "Saving…" : "Save draft"}
              </button>
              <button type="button" onClick={onPublish} disabled={saving || rules.length === 0} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {saving ? "Publishing…" : "Publish version"}
              </button>
            </div>
          </section>
        )}

        <p className="text-xs leading-5 text-zinc-500">
          Published versions are immutable and each quote calculation stores the selected rule version plus its input, catalogue, and result snapshots. The current rules are global to this installation; organisation-specific rules require a separate tenancy and permissions pass.
        </p>
      </main>
    </div>
  );
}
