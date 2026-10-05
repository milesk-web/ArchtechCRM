"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Option = { id: string; name?: string; value?: string; section?: string };

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      text.slice(0, 300) || `Server returned non-JSON (status ${res.status})`,
    );
  }
}

export default function CostingTestPage() {
  const [profiles, setProfiles] = useState<Option[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [materials, setMaterials] = useState<Option[]>([]);
  const [profileId, setProfileId] = useState("");
  const [optionId, setOptionId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [area, setArea] = useState(120);
  const [pitch, setPitch] = useState(25);
  const [measure, setMeasure] = useState(true);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [seedMsg, setSeedMsg] = useState("");

  useEffect(() => {
    loadLists();
  }, []);

  async function loadLists() {
    setLoading(true);
    setError("");
    try {
      const [pRes, mRes] = await Promise.all([
        fetch("/api/catalogue?table=profiles"),
        fetch("/api/catalogue?table=materials"),
      ]);
      const pJson = await readJson(pRes);
      const mJson = await readJson(mRes);
      if (!pRes.ok) throw new Error(pJson.error || "Could not load profiles");
      if (!mRes.ok) throw new Error(mJson.error || "Could not load materials");
      setProfiles(pJson.data ?? []);
      setMaterials(mJson.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load catalogue");
    } finally {
      setLoading(false);
    }
  }

  async function onProfileChange(id: string) {
    setProfileId(id);
    setOptionId("");
    setOptions([]);
    if (!id) return;
    try {
      const res = await fetch(
        `/api/catalogue?table=profile_options&profile_id=${id}`,
      );
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Could not load options");
      setOptions(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load options");
    }
  }

  async function runSeed() {
    setSeeding(true);
    setSeedMsg("");
    setError("");
    try {
      const res = await fetch("/api/costing/seed", { method: "POST" });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Seed failed");
      setSeedMsg(json.message || "Seed complete");
      await loadLists();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  async function runCalculate() {
    if (!profileId || !optionId || !materialId) {
      setError("Pick a profile, option, and material first.");
      return;
    }
    setCalculating(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/costing/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roof: {
            areaM2: area,
            linealMetres: area,
            profileId,
            profileOptionId: optionId,
            materialId,
            flashings: [],
            pitchDegrees: pitch,
          },
          jobContext: {
            measureRequired: measure,
            isSmallJob: false,
          },
        }),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Calculate failed");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Calculate failed");
    } finally {
      setCalculating(false);
    }
  }

  const money = (n: number | null | undefined) =>
    n == null
      ? "—"
      : `$${Number(n).toLocaleString("en-NZ", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Costing engine test</h1>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Back to app
          </Link>
        </div>

        <p className="mb-6 text-sm text-zinc-600">
          Use this page to seed the database and run a sample quote calculation.
          You need to be logged in.
        </p>

        <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-medium">Step 1 — Seed data</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Click once to load materials, profiles, rates, and pricing rules.
            Safe to run more than once.
          </p>
          <button
            type="button"
            onClick={runSeed}
            disabled={seeding}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {seeding ? "Seeding…" : "Seed costing data"}
          </button>
          {seedMsg && (
            <p className="mt-3 text-sm text-green-700">{seedMsg}</p>
          )}
        </section>

        <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-medium">Step 2 — Run a test quote</h2>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading catalogue…</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Profile</label>
                <select
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={profileId}
                  onChange={(e) => onProfileChange(e.target.value)}
                >
                  <option value="">Select profile…</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.section ? ` (${p.section})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Gauge / width
                </label>
                <select
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={optionId}
                  onChange={(e) => setOptionId(e.target.value)}
                  disabled={!profileId}
                >
                  <option value="">Select option…</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Material</label>
                <select
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={materialId}
                  onChange={(e) => setMaterialId(e.target.value)}
                >
                  <option value="">Select material…</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Area (m²)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={area}
                    onChange={(e) => setArea(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Pitch (°)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={pitch}
                    onChange={(e) => setPitch(Number(e.target.value))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={measure}
                  onChange={(e) => setMeasure(e.target.checked)}
                />
                Include measure fee ($1,500)
              </label>

              <button
                type="button"
                onClick={runCalculate}
                disabled={calculating}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {calculating ? "Calculating…" : "Calculate"}
              </button>
            </div>
          )}
        </section>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {result && (
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-medium">Result</h2>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded bg-zinc-50 p-3">
                <div className="text-zinc-500">Direct cost</div>
                <div className="text-xl font-semibold">
                  {money(result.result?.direct?.total)}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Mat {money(result.result?.direct?.material)} · Lab{" "}
                  {money(result.result?.direct?.labour)} · Fees{" "}
                  {money(result.result?.direct?.fees)}
                </div>
              </div>
              <div className="rounded bg-zinc-50 p-3">
                <div className="text-zinc-500">Sell price</div>
                <div className="text-xl font-semibold">
                  {money(result.result?.sell?.total)}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Mat {money(result.result?.sell?.material)} · Lab{" "}
                  {money(result.result?.sell?.labour)} · Fees{" "}
                  {money(result.result?.sell?.fees)}
                </div>
              </div>
            </div>

            {result.result?.warnings?.length > 0 && (
              <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <strong>Warnings:</strong>
                <ul className="mt-1 list-inside list-disc">
                  {result.result.warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-2 text-sm font-medium">Lines</div>
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
                  {(result.result?.lines ?? []).map((line: any) => (
                    <tr key={line.id} className="border-b border-zinc-100">
                      <td className="py-1.5 pr-2">{line.description}</td>
                      <td className="py-1.5 pr-2">
                        {line.quantity} {line.unit}
                      </td>
                      <td className="py-1.5 pr-2">{money(line.unitCost)}</td>
                      <td className="py-1.5">{money(line.sellPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-zinc-500">
                Raw JSON / meta
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-zinc-100 p-3 text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </section>
        )}
      </div>
    </div>
  );
}
