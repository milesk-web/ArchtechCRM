"use client";

/**
 * Quote flow — process-led, engine-backed.
 * Excel is a guide for intent, not a formula clone.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getJob, updateJob, type Job } from "@/lib/jobs";
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

        const [pRes, mRes, lines] = await Promise.all([
          fetch("/api/catalogue?table=profiles").then(readJson),
          fetch("/api/catalogue?table=materials").then(readJson),
          getQuoteLines(quoteResult.id),
        ]);

        setJob(jobResult);
        setQuote(quoteResult);
        setProfiles(pRes.data ?? []);
        setMaterials(mRes.data ?? []);
        setSavedLines(lines);

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
      const body: Record<string, unknown> = {
        jobContext: { measureRequired, isSmallJob },
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
      setStatus("Calculated — review totals, then Save quote.");
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
      try {
        if (job && job.status === "Opportunity") {
          const today = new Date().toISOString().slice(0, 10);
          await updateJob(job.id, {
            status: "Quoted",
            quoted_date: today,
          });
          setJob({
            ...job,
            status: "Quoted",
            dates: { ...job.dates, quoted: today },
          });
        }
      } catch {
        // Non-fatal — lines already saved
      }

      const totalLabel =
        sellTotal != null ? ` · sell ${money(sellTotal)}` : "";
      setStatus(
        `Saved ${saved.length} line(s)${totalLabel}. Return to the job card when ready.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
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
              {saving ? "Saving…" : "Save quote"}
            </button>
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
              <h2 className="mb-4 text-lg font-medium">Totals</h2>
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
