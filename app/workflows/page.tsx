"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type WorkflowVersion = {
  id: string;
  workflow_key: string;
  name: string;
  version: number;
  status: "draft" | "published" | "archived";
  definition: Record<string, unknown>;
  published_at: string | null;
  created_at: string;
};

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || `Request failed (${response.status})`);
  }
}

export default function WorkflowBuilderPage() {
  const [published, setPublished] = useState<WorkflowVersion | null>(null);
  const [draft, setDraft] = useState<WorkflowVersion | null>(null);
  const [definitionText, setDefinitionText] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/workflows?key=roofing-cladding", { cache: "no-store" });
        const json = await readJson(response);
        if (!response.ok) throw new Error(json.error || "Unable to load workflow.");
        setCanEdit(json.canEdit === true);
        setPublished(json.published ?? null);
        setDraft(json.draft ?? null);
        const active = json.draft ?? json.published;
        setDefinitionText(active ? JSON.stringify(active.definition, null, 2) : "");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load workflow.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function parseDefinition(): Record<string, unknown> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(definitionText);
    } catch (cause) {
      throw new Error(cause instanceof Error ? `Workflow JSON is invalid: ${cause.message}` : "Workflow JSON is invalid.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Workflow definition must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  }

  async function saveDraft(): Promise<WorkflowVersion> {
    const definition = parseDefinition();
    const response = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveDraft", workflowKey: "roofing-cladding", definition }),
    });
    const json = await readJson(response);
    if (!response.ok) {
      const details = Array.isArray(json.details) ? `\n${json.details.join("\n")}` : "";
      throw new Error((json.error || "Unable to save workflow draft.") + details);
    }
    setDraft(json.draft);
    setDefinitionText(JSON.stringify(json.draft.definition, null, 2));
    return json.draft as WorkflowVersion;
  }

  async function onSaveDraft() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await saveDraft();
      setNotice(`Saved workflow version ${saved.version} as a draft. The live quote flow is unchanged until you publish it.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save workflow draft.");
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await saveDraft();
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", draftId: saved.id }),
      });
      const json = await readJson(response);
      if (!response.ok) throw new Error(json.error || "Unable to publish workflow.");
      setPublished(json.published);
      setDraft(null);
      setDefinitionText(JSON.stringify(json.published.definition, null, 2));
      setNotice(`Workflow version ${json.published.version} is published. Earlier versions remain archived for historical reproducibility.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to publish workflow.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-400">Archtech CRM · Workflow configuration</p>
            <h1 className="mt-1 text-2xl font-semibold">Quote workflow builder</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
              Configure conditional questions, required fields, and generated work components in a versioned workflow definition.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/pricing" className="text-blue-700 hover:underline">Pricing</Link>
            <Link href="/costing-rules" className="text-blue-700 hover:underline">Costing rules</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-5 py-7">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Published workflow</p>
            <p className="mt-1 text-lg font-semibold">{published ? `v${published.version} · ${published.name}` : "No published workflow"}</p>
            <p className="mt-1 text-sm text-zinc-500">{published?.published_at ? `Published ${new Date(published.published_at).toLocaleString()}` : "Apply the workflow migration to initialise a definition."}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Working draft</p>
            <p className="mt-1 text-lg font-semibold">{draft ? `v${draft.version}` : "Not created yet"}</p>
            <p className="mt-1 text-sm text-zinc-500">Draft edits do not change the published workflow until published.</p>
          </div>
        </section>

        {!canEdit && !loading && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Read-only: add your admin email to COSTING_ADMIN_EMAILS to save and publish workflow versions.</div>}
        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 whitespace-pre-wrap">{error}</div>}
        {notice && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}

        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-500">Loading workflow…</div>
        ) : (
          <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h2 className="font-medium">Workflow definition (JSON)</h2>
              <p className="mt-1 text-xs text-zinc-500">The workflow key is fixed to <code>roofing-cladding</code>. Saving validates the schema and condition/formula operators before a version can be published.</p>
            </div>
            <textarea
              aria-label="Workflow definition JSON"
              value={definitionText}
              disabled={!canEdit}
              onChange={(event) => { setDefinitionText(event.target.value); setNotice(""); }}
              spellCheck={false}
              rows={28}
              className="w-full resize-y border-0 bg-zinc-950 p-4 font-mono text-xs leading-5 text-zinc-100 outline-none disabled:opacity-70"
            />
            <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-4">
              <button type="button" onClick={onSaveDraft} disabled={!canEdit || saving || !definitionText.trim()} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? "Saving…" : "Save draft"}
              </button>
              <button type="button" onClick={onPublish} disabled={!canEdit || saving || !definitionText.trim()} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {saving ? "Publishing…" : "Publish workflow"}
              </button>
            </div>
          </section>
        )}

        <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          <h2 className="font-medium">Definition guide</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-zinc-600">
            <li>Question types: <code>text</code>, <code>number</code>, <code>boolean</code>, <code>select</code>, and <code>multiselect</code>.</li>
            <li>Conditions support <code>equals</code>, <code>not_equals</code>, numeric comparisons, <code>contains</code>, <code>is_set</code>, <code>is_not_set</code>, plus nested <code>all</code>, <code>any</code>, and <code>not</code>.</li>
            <li>Generated work quantities can be constant or derived from an answer field using a multiplier and addend. To add a priced line, set `pricing` with `unitCost`, `section`, and optional `markupRuleType` (`material_markup`, `labour_markup`, or `none`). Material/labour markups use the selected published costing rule. Otherwise declare `pricingMode: "costing_engine"` for work priced by the existing roof/wall engine, or `pricingMode: "informational"` for a preview-only component. A component with neither a price nor a mode blocks quote issuance.</li>
            <li>Published versions are immutable. Apply <code>supabase/migrations/20261013_versioned_quote_workflows.sql</code> before using this page.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
