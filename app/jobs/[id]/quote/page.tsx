"use client";

/**
 * Quote flow — process-led, engine-backed.
 * Excel is a guide for intent, not a formula clone.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getJob, type Job } from "@/lib/jobs";
import { evaluateWorkflow, type WorkflowAnswers, type WorkflowDefinition } from "@/lib/workflows/engine";
import {
  getQuoteForJob,
  createQuote,
  getQuoteLines,
  saveQuoteLines,
  type Quote,
  type QuoteLine,
} from "@/lib/quotes";

type Opt = { id: string; name?: string; value?: string; section?: string };

type FlashingRow = {
  id: string;
  name: string;
  girthMm: number;
  lengthM: number;
  quantity: number;
};

type SectionForm = {
  areaM2: number;
  profileId: string;
  profileOptionId: string;
  materialId: string;
  pitchDegrees: number;
  flashings: FlashingRow[];
};

const emptySection = (): SectionForm => ({
  areaM2: 0,
  profileId: "",
  profileOptionId: "",
  materialId: "",
  pitchDegrees: 20,
  flashings: [],
});

function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${Number(n).toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function sameSavedCalculation(
  resultLines: Array<{
    id?: string;
    section: string;
    category: string;
    description: string;
    quantity: number;
    unit: string;
    unitCost: number | null;
    sellPrice: number | null;
    sortOrder: number;
    metadata?: Record<string, unknown>;
  }>,
  savedLines: QuoteLine[],
): boolean {
  if (resultLines.length === 0 || resultLines.length !== savedLines.length) return false;
  return resultLines.every((line) => {
    const saved = savedLines.find((candidate) => candidate.id === line.id);
    return Boolean(
      saved &&
      saved.section === line.section &&
      saved.category === line.category &&
      saved.description === line.description &&
      saved.quantity === line.quantity &&
      saved.unit === line.unit &&
      saved.unitCost === line.unitCost &&
      saved.sellPrice === line.sellPrice &&
      saved.sortOrder === line.sortOrder &&
      JSON.stringify(saved.metadata ?? {}) === JSON.stringify(line.metadata ?? {}),
    );
  });
}

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 280) || `HTTP ${res.status}`);
  }
}

export default function QuotePage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [profiles, setProfiles] = useState<Opt[]>([]);
  const [materials, setMaterials] = useState<Opt[]>([]);
  const [optionsByProfile, setOptionsByProfile] = useState<
    Record<string, Opt[]>
  >({});

  const [roof, setRoof] = useState<SectionForm>(emptySection);
  const [wall, setWall] = useState<SectionForm>(emptySection);
  const [includeRoof, setIncludeRoof] = useState(true);
  const [includeWall, setIncludeWall] = useState(false);
  const [measureRequired, setMeasureRequired] = useState(false);
  const [isSmallJob, setIsSmallJob] = useState(false);

  const [engineResult, setEngineResult] = useState<any>(null);
  const [savedLines, setSavedLines] = useState<QuoteLine[]>([]);
  const [workflowDefinition, setWorkflowDefinition] = useState<WorkflowDefinition | null>(null);
  const [workflowVersion, setWorkflowVersion] = useState<number | null>(null);
  const [workflowExtraAnswers, setWorkflowExtraAnswers] = useState<WorkflowAnswers>({});
  const [workflowError, setWorkflowError] = useState("");

  const loadOptions = useCallback(
    async (profileId: string) => {
      if (!profileId || optionsByProfile[profileId]) return;
      const res = await fetch(
        `/api/catalogue?table=profile_options&profile_id=${profileId}`,
      );
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Options failed");
      setOptionsByProfile((c) => ({ ...c, [profileId]: json.data ?? [] }));
    },
    [optionsByProfile],
  );

  useEffect(() => {
    async function init() {
      try {
        const jobResult = await getJob(jobId);
        if (!jobResult) {
          router.replace("/jobs");
          return;
        }
        let quoteResult = await getQuoteForJob(jobId);
        if (!quoteResult) {
          quoteResult = await createQuote(jobId, jobResult.jobNumber);
        }

        const [pRes, mRes, lines, workflowRes] = await Promise.all([
          fetch("/api/catalogue?table=profiles").then(readJson),
          fetch("/api/catalogue?table=materials").then(readJson),
          getQuoteLines(quoteResult.id),
          fetch("/api/workflows?key=roofing-cladding")
            .then(async (response) => {
              const json = await readJson(response);
              return response.ok ? json : { error: json.error || "Unable to load quote workflow." };
            })
            .catch((cause) => ({ error: cause instanceof Error ? cause.message : "Unable to load quote workflow." })),
        ]);

        setJob(jobResult);
        setQuote(quoteResult);
        setProfiles(pRes.data ?? []);
        setMaterials(mRes.data ?? []);
        setSavedLines(lines);
        if (workflowRes?.published?.definition) {
          setWorkflowDefinition(workflowRes.published.definition as WorkflowDefinition);
          setWorkflowVersion(Number(workflowRes.published.version));
          setWorkflowError("");
        } else {
          setWorkflowError(workflowRes?.error || "No published quote workflow was found.");
        }

        const roofMat = lines.find(
          (l) =>
            l.section === "Roofing" &&
            l.category === "Material" &&
            l.metadata?.kind === "profile",
        );
        if (roofMat?.metadata) {
          const m = roofMat.metadata as Record<string, unknown>;
          setRoof((r) => ({
            ...r,
            areaM2: Number(m.area ?? roofMat.quantity) || 0,
            profileId: String(m.profileId ?? ""),
            profileOptionId: String(m.profileOptionId ?? ""),
            materialId: String(m.materialId ?? ""),
          }));
          if (m.profileId) loadOptions(String(m.profileId));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load quote");
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, router]);

  function updateSection(which: "roof" | "wall", patch: Partial<SectionForm>) {
    const setter = which === "roof" ? setRoof : setWall;
    setter((cur) => {
      const next = { ...cur, ...patch };
      if (patch.profileId !== undefined) {
        next.profileOptionId = "";
        if (patch.profileId) loadOptions(patch.profileId).catch(() => {});
      }
      return next;
    });
    setEngineResult(null);
  }

  function addFlashing(which: "roof" | "wall") {
    const row: FlashingRow = {
      id: crypto.randomUUID(),
      name: "",
      girthMm: 400,
      lengthM: 0,
      quantity: 1,
    };
    if (which === "roof") {
      setRoof((c) => ({ ...c, flashings: [...c.flashings, row] }));
    } else {
      setWall((c) => ({ ...c, flashings: [...c.flashings, row] }));
    }
    setEngineResult(null);
  }

  function getWorkflowAnswers(): WorkflowAnswers {
    return {
      includeRoof,
      "roof.areaM2": roof.areaM2,
      includeWall,
      "wall.areaM2": wall.areaM2,
      measureRequired,
      isSmallJob,
      ...workflowExtraAnswers,
    };
  }

  function sectionPayload(s: SectionForm) {
    return {
      areaM2: s.areaM2,
      linealMetres: s.areaM2,
      profileId: s.profileId,
      profileOptionId: s.profileOptionId,
      materialId: s.materialId,
      pitchDegrees: s.pitchDegrees,
      flashings: s.flashings
        .filter((f) => f.lengthM > 0)
        .map((f) => ({
          id: f.id,
          flashingTypeId: null,
          customName: f.name || "Flashing",
          girthMm: f.girthMm,
          materialId: s.materialId,
          lengthM: f.lengthM,
          quantity: f.quantity,
        })),
    };
  }

  async function runCalculate() {
    setCalculating(true);
    setError("");
    setStatus("");
    try {
      if (!quote) throw new Error("The quote is still loading. Try again in a moment.");
      const body: Record<string, unknown> = {
        quoteId: quote.id,
        jobContext: { measureRequired, isSmallJob },
        workflowAnswers: getWorkflowAnswers(),
        workflowVersion,
      };
      if (
        includeRoof &&
        roof.profileId &&
        roof.materialId &&
        roof.profileOptionId
      ) {
        body.roof = sectionPayload(roof);
      }
      if (
        includeWall &&
        wall.profileId &&
        wall.materialId &&
        wall.profileOptionId
      ) {
        body.wall = sectionPayload(wall);
      }
      if (!body.roof && !body.wall) {
        throw new Error(
          "Enable Roof and/or Wall and select profile, option, and material.",
        );
      }

      const res = await fetch("/api/costing/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Calculate failed");
      setEngineResult(json);
      setStatus(
        `Calculated with costing rules v${json.meta?.ruleSetVersion ?? "?"} and workflow v${json.meta?.workflowVersion ?? "?"} — review totals, then save.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Calculate failed");
    } finally {
      setCalculating(false);
    }
  }

  async function runSave() {
    if (!quote || !engineResult?.result?.lines) {
      setError("Calculate first, then save.");
      return;
    }
    const readyToIssue = engineResult.result.readyToIssue === true && workflowEvaluation?.ready === true;
    setSaving(true);
    setError("");
    try {
      const lines: QuoteLine[] = engineResult.result.lines.map(
        (line: any, i: number) => ({
          id: line.id || crypto.randomUUID(),
          quoteId: quote.id,
          section: line.section,
          category: line.category,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitCost: line.unitCost,
          sellPrice: line.sellPrice,
          sortOrder: line.sortOrder ?? i,
          metadata: line.metadata ?? {},
        }),
      );
      const saved = await saveQuoteLines(quote.id, lines);
      setSavedLines(saved);

      const sellTotal = engineResult.result?.sell?.total;
      const totalLabel =
        sellTotal != null ? ` · sell ${money(sellTotal)}` : "";
      setStatus(
        readyToIssue
          ? `Saved ${saved.length} priced line(s)${totalLabel}. Review the quote, then use Issue quote when it is ready to send.`
          : `Saved ${saved.length} line(s) as a draft${totalLabel}. The job has not been marked Quoted because pricing or workflow questions are incomplete; resolve the notes below and recalculate.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function runIssue() {
    if (!quote || !engineResult?.result?.readyToIssue || workflowEvaluation?.ready !== true || !sameSavedCalculation(engineResult.result.lines, savedLines)) {
      setError("Save the current fully priced calculation before issuing this quote.");
      return;
    }

    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/quotes/${encodeURIComponent(quote.id)}/issue`, {
        method: "POST",
      });
      const json = await readJson(response);
      if (!response.ok) {
        const details = Array.isArray(json.details) ? ` ${json.details.join(" ")}` : "";
        throw new Error((json.error || "Unable to issue quote.") + details);
      }

      setQuote({ ...quote, status: "Issued" });
      if (job && json.jobStatus === "Quoted" && job.status === "Opportunity") {
        const today = new Date().toISOString().slice(0, 10);
        setJob({ ...job, status: "Quoted", dates: { ...job.dates, quoted: today } });
      }
      setStatus("Quote issued successfully. The issue status was confirmed by the server.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to issue quote.");
    } finally {
      setSaving(false);
    }
  }

  function uniqueByName(list: Opt[]) {
    const seen = new Set<string>();
    return list.filter((p) => {
      const key = (p.name ?? "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const roofProfiles = uniqueByName(
    profiles.filter((p) => p.section === "Roofing"),
  );
  const wallProfiles = uniqueByName(
    profiles.filter((p) => p.section === "Wall Cladding"),
  );

  function SectionEditor({
    title,
    which,
    form,
    profileList,
    enabled,
    onEnabled,
  }: {
    title: string;
    which: "roof" | "wall";
    form: SectionForm;
    profileList: Opt[];
    enabled: boolean;
    onEnabled: (v: boolean) => void;
  }) {
    const opts = optionsByProfile[form.profileId] ?? [];
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">{title}</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                onEnabled(e.target.checked);
                setEngineResult(null);
              }}
            />
            Include
          </label>
        </div>
        {!enabled ? (
          <p className="text-sm text-zinc-500">Not included in this quote.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Area (m²)
                </label>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={form.areaM2 || ""}
                  onChange={(e) =>
                    updateSection(which, {
                      areaM2: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Pitch (°)
                </label>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={form.pitchDegrees || ""}
                  onChange={(e) =>
                    updateSection(which, {
                      pitchDegrees: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Profile
              </label>
              <select
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={form.profileId}
                onChange={(e) =>
                  updateSection(which, { profileId: e.target.value })
                }
              >
                <option value="">Select…</option>
                {profileList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Gauge / width
              </label>
              <select
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={form.profileOptionId}
                disabled={!form.profileId}
                onChange={(e) =>
                  updateSection(which, { profileOptionId: e.target.value })
                }
              >
                <option value="">Select…</option>
                {opts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Material
              </label>
              <select
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={form.materialId}
                onChange={(e) =>
                  updateSection(which, { materialId: e.target.value })
                }
              >
                <option value="">Select…</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t border-zinc-100 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Flashings</span>
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => addFlashing(which)}
                >
                  + Add
                </button>
              </div>
              {form.flashings.length === 0 && (
                <p className="text-xs text-zinc-500">None yet.</p>
              )}
              {form.flashings.map((f) => (
                <div
                  key={f.id}
                  className="mb-2 grid grid-cols-4 gap-2 text-sm"
                >
                  <input
                    placeholder="Name"
                    className="rounded border border-zinc-300 px-2 py-1"
                    value={f.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const setter = which === "roof" ? setRoof : setWall;
                      setter((c) => ({
                        ...c,
                        flashings: c.flashings.map((x) =>
                          x.id === f.id ? { ...x, name } : x,
                        ),
                      }));
                      setEngineResult(null);
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Girth mm"
                    className="rounded border border-zinc-300 px-2 py-1"
                    value={f.girthMm || ""}
                    onChange={(e) => {
                      const girthMm = Number(e.target.value) || 0;
                      const setter = which === "roof" ? setRoof : setWall;
                      setter((c) => ({
                        ...c,
                        flashings: c.flashings.map((x) =>
                          x.id === f.id ? { ...x, girthMm } : x,
                        ),
                      }));
                      setEngineResult(null);
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Length m"
                    className="rounded border border-zinc-300 px-2 py-1"
                    value={f.lengthM || ""}
                    onChange={(e) => {
                      const lengthM = Number(e.target.value) || 0;
                      const setter = which === "roof" ? setRoof : setWall;
                      setter((c) => ({
                        ...c,
                        flashings: c.flashings.map((x) =>
                          x.id === f.id ? { ...x, lengthM } : x,
                        ),
                      }));
                      setEngineResult(null);
                    }}
                  />
                  <button
                    type="button"
                    className="text-left text-xs text-red-600"
                    onClick={() => {
                      const setter = which === "roof" ? setRoof : setWall;
                      setter((c) => ({
                        ...c,
                        flashings: c.flashings.filter((x) => x.id !== f.id),
                      }));
                      setEngineResult(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  if (loading) {
    return (
      <div className="p-10 text-center text-sm text-zinc-500">
        Loading quote…
      </div>
    );
  }

  const result = engineResult?.result;
  const workflowAnswers = getWorkflowAnswers();
  const workflowEvaluation = workflowDefinition
    ? evaluateWorkflow(workflowDefinition, workflowAnswers)
    : null;
  const workflowCoreFieldIds = new Set([
    "includeRoof",
    "roof.areaM2",
    "includeWall",
    "wall.areaM2",
    "measureRequired",
    "isSmallJob",
  ]);
  const extraWorkflowFields = workflowEvaluation?.visibleFields.filter(
    (field) => !workflowCoreFieldIds.has(field.id),
  ) ?? [];
  const currentCalculationSaved = Boolean(
    result?.readyToIssue &&
    workflowEvaluation?.ready === true &&
    sameSavedCalculation(result.lines, savedLines),
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href={`/jobs/${jobId}`}
              className="text-sm text-blue-600 hover:underline"
            >
              ← Job
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">
              Quote{job ? ` · ${job.jobNumber}` : ""}
            </h1>
            {quote && (
              <p className="text-sm text-zinc-500">
                {quote.quoteNumber} · {quote.status}
                {job ? ` · job ${job.status}` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <SectionEditor
            title="Roofing"
            which="roof"
            form={roof}
            profileList={roofProfiles}
            enabled={includeRoof}
            onEnabled={setIncludeRoof}
          />
          <SectionEditor
            title="Wall cladding"
            which="wall"
            form={wall}
            profileList={wallProfiles}
            enabled={includeWall}
            onEnabled={setIncludeWall}
          />

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">Workflow questions</h2>
                <p className="text-xs text-zinc-500">
                  {workflowVersion != null ? `Published workflow v${workflowVersion}` : "Published workflow unavailable"}
                </p>
              </div>
              {workflowEvaluation && (
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${workflowEvaluation.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                  {workflowEvaluation.ready ? "Workflow complete" : "Workflow incomplete"}
                </span>
              )}
            </div>
            {workflowError && <p className="mb-3 text-sm text-amber-800">{workflowError}</p>}
            {extraWorkflowFields.length === 0 ? (
              <p className="text-sm text-zinc-500">No additional workflow questions are configured. Core roof/wall fields and job-fee switches are mapped to the published workflow.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {extraWorkflowFields.map((field) => {
                  const value = workflowExtraAnswers[field.id] ?? field.defaultValue ?? "";
                  const missing = workflowEvaluation?.missingRequiredFields.some((item) => item.id === field.id) ?? false;
                  return (
                    <div key={field.id}>
                      <label className="mb-1 block text-xs font-medium text-zinc-600">
                        {field.label}{missing ? " *" : ""}
                      </label>
                      {field.type === "boolean" ? (
                        <label className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(event) => {
                              setWorkflowExtraAnswers((current) => ({ ...current, [field.id]: event.target.checked }));
                              setEngineResult(null);
                            }}
                          />
                          {field.helpText || "Yes"}
                        </label>
                      ) : field.type === "select" ? (
                        <select
                          value={typeof value === "string" ? value : ""}
                          onChange={(event) => {
                            setWorkflowExtraAnswers((current) => ({ ...current, [field.id]: event.target.value }));
                            setEngineResult(null);
                          }}
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                        >
                          <option value="">Select…</option>
                          {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      ) : field.type === "multiselect" ? (
                        <select
                          multiple
                          value={Array.isArray(value) ? value : []}
                          onChange={(event) => {
                            setWorkflowExtraAnswers((current) => ({ ...current, [field.id]: Array.from(event.target.selectedOptions, (option) => option.value) }));
                            setEngineResult(null);
                          }}
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                        >
                          {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : "text"}
                          value={typeof value === "string" || typeof value === "number" ? value : ""}
                          onChange={(event) => {
                            const nextValue = field.type === "number" && event.target.value !== ""
                              ? Number(event.target.value)
                              : event.target.value;
                            setWorkflowExtraAnswers((current) => ({ ...current, [field.id]: nextValue }));
                            setEngineResult(null);
                          }}
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                        />
                      )}
                      {field.helpText && field.type !== "boolean" && <p className="mt-1 text-xs text-zinc-500">{field.helpText}</p>}
                    </div>
                  );
                })}
              </div>
            )}
            {workflowEvaluation && workflowEvaluation.missingRequiredFields.length > 0 && (
              <p className="mt-3 text-sm text-amber-800">
                Required answers missing: {workflowEvaluation.missingRequiredFields.map((field) => field.label).join(", ")}.
              </p>
            )}
            {workflowEvaluation && workflowEvaluation.warnings.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
                {workflowEvaluation.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            )}
            {workflowEvaluation && workflowEvaluation.components.length > 0 && (
              <details className="mt-4 border-t border-zinc-100 pt-3">
                <summary className="cursor-pointer text-sm font-medium text-zinc-700">Workflow-generated work preview ({workflowEvaluation.components.length})</summary>
                <p className="mt-2 text-xs text-zinc-500">Preview only: current quote line pricing is still produced by the roofing/cladding costing engine.</p>
                <ul className="mt-2 space-y-1 text-sm text-zinc-600">
                  {workflowEvaluation.components.map((component) => (
                    <li key={component.id}>{component.name}: {component.quantity} {component.unit}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">Job fees</h2>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={measureRequired}
                  onChange={(e) => {
                    setMeasureRequired(e.target.checked);
                    setEngineResult(null);
                  }}
                />
                Measure fee
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isSmallJob}
                  onChange={(e) => {
                    setIsSmallJob(e.target.checked);
                    setEngineResult(null);
                  }}
                />
                Small job fee
              </label>
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runCalculate}
              disabled={calculating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {calculating ? "Calculating…" : "Calculate"}
            </button>
            <button
              type="button"
              onClick={runSave}
              disabled={saving || !result}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : result?.readyToIssue ? "Save quote" : "Save draft"}
            </button>
            {result?.readyToIssue && quote?.status === "Draft" && (
              <button
                type="button"
                onClick={runIssue}
                disabled={saving || !currentCalculationSaved}
                title={!currentCalculationSaved ? "Save this exact calculation before issuing." : "Issue the saved quote"}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Working…" : "Issue quote"}
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 whitespace-pre-wrap">
              {error}
            </div>
          )}
          {status && !error && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {status}
            </div>
          )}

          {result && (
            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium">Totals</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    result.readyToIssue
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {result.readyToIssue ? "Ready for review" : "Draft — pricing incomplete"}
                </span>
              </div>
              {!result.readyToIssue && (
                <p className="mb-4 text-sm text-amber-900">
                  This calculation cannot move the job to Quoted until all required rates are present and the warnings below are resolved.
                </p>
              )}
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded bg-zinc-50 p-3">
                  <div className="text-zinc-500">Direct cost</div>
                  <div className="text-xl font-semibold">
                    {money(result.direct?.total)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Mat {money(result.direct?.material)} · Lab{" "}
                    {money(result.direct?.labour)} · Fees{" "}
                    {money(result.direct?.fees)}
                  </div>
                </div>
                <div className="rounded bg-zinc-50 p-3">
                  <div className="text-zinc-500">Sell price</div>
                  <div className="text-xl font-semibold">
                    {money(result.sell?.total)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Mat {money(result.sell?.material)} · Lab{" "}
                    {money(result.sell?.labour)} · Fees{" "}
                    {money(result.sell?.fees)}
                  </div>
                </div>
              </div>

              {result.warnings?.length > 0 && (
                <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <strong>Notes:</strong>
                  <ul className="mt-1 list-inside list-disc">
                    {result.warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-zinc-500">
                      <th className="py-1 pr-2">Description</th>
                      <th className="py-1 pr-2">Qty</th>
                      <th className="py-1 pr-2">Unit cost</th>
                      <th className="py-1">Sell</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.lines ?? []).map((line: any) => (
                      <tr key={line.id} className="border-b border-zinc-100">
                        <td className="py-1.5 pr-2">{line.description}</td>
                        <td className="py-1.5 pr-2">
                          {line.quantity} {line.unit}
                        </td>
                        <td className="py-1.5 pr-2">
                          {money(line.unitCost)}
                        </td>
                        <td className="py-1.5">{money(line.sellPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {!result && savedLines.length > 0 && (
            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-lg font-medium">
                Last saved lines ({savedLines.length})
              </h2>
              <p className="mb-3 text-sm text-zinc-500">
                Calculate again to refresh prices, then Save.
              </p>
              <ul className="space-y-1 text-sm">
                {savedLines.slice(0, 12).map((l) => (
                  <li key={l.id}>
                    {l.description} — {l.quantity} {l.unit} ·{" "}
                    {money(l.sellPrice)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
