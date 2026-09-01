"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getJob, type Job } from "@/lib/jobs";
import {
  getQuoteForJob,
  createQuote,
  getQuoteLines,
  saveQuoteLines,
  type Quote,
  type QuoteLine,
} from "@/lib/quotes";
import {
  getProfiles,
  getProfileOptions,
  getMaterials,
  getMaterialColours,
  getUnderlays,
  getFlashingTypes,
  getLabourTypes,
  getAccessories,
  type Profile,
  type ProfileOption,
  type Material,
  type MaterialColour,
  type Underlay,
  type FlashingType,
  type LabourType,
  type Accessory,
} from "@/lib/quote-options";

type Section = "Roofing" | "Wall Cladding" | "Accessories";

type ScopeState = {
  area: number;
  profileId: string;
  profileOptionId: string;
  materialId: string;
  colourId: string;
  underlayId: string;
};

type FlashingRow = {
  id: string;
  flashingTypeId: string;
  length: number;
  quantity: number;
};

type LabourRow = {
  id: string;
  labourTypeId: string;
  quantity: number;
  hours: number;
  rate: number;
};

type AccessoryRow = {
  id: string;
  accessoryId: string;
  quantity: number;
};

const emptyScope: ScopeState = {
  area: 0,
  profileId: "",
  profileOptionId: "",
  materialId: "",
  colourId: "",
  underlayId: "",
};

// ASSUMPTIONS FLAGGED (please confirm/correct these):
// 1. Flashing line cost = flashingType.unitCost * length * quantity
//    (unitCost assumed to be per lineal metre, length + quantity both
//    contribute to total lineal metres).
// 2. Labour line cost = hours * rate (the "quantity/applicable measurement"
//    field is kept as reference/metadata, not multiplied into the cost --
//    unclear from the spec whether it should be).
// 3. Profile/Material/Colour selection has NO pricing table in this phase's
//    schema, so it's recorded as an unpriced descriptive line -- only
//    Underlay carries a real cost within the "material" section.

export default function QuotePage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Catalogue data
  const [roofProfiles, setRoofProfiles] = useState<Profile[]>([]);
  const [wallProfiles, setWallProfiles] = useState<Profile[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [underlays, setUnderlays] = useState<Underlay[]>([]);
  const [flashingTypes, setFlashingTypes] = useState<FlashingType[]>([]);
  const [labourTypes, setLabourTypes] = useState<LabourType[]>([]);
  const [accessoryOptions, setAccessoryOptions] = useState<Accessory[]>([]);

  // Dependent dropdown data, keyed by parent id so both scopes can have
  // different profiles/materials selected without clobbering each other.
  const [profileOptionsByProfile, setProfileOptionsByProfile] = useState<
    Record<string, ProfileOption[]>
  >({});
  const [coloursByMaterial, setColoursByMaterial] = useState<
    Record<string, MaterialColour[]>
  >({});

  // Editing state
  const [roofing, setRoofing] = useState<ScopeState>(emptyScope);
  const [wallCladding, setWallCladding] = useState<ScopeState>(emptyScope);
  const [roofingFlashings, setRoofingFlashings] = useState<FlashingRow[]>([]);
  const [roofingLabour, setRoofingLabour] = useState<LabourRow[]>([]);
  const [wallFlashings, setWallFlashings] = useState<FlashingRow[]>([]);
  const [wallLabour, setWallLabour] = useState<LabourRow[]>([]);
  const [accessoryRows, setAccessoryRows] = useState<AccessoryRow[]>([]);

  useEffect(() => {
    async function load() {
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

        const [
          roofProfilesResult,
          wallProfilesResult,
          materialsResult,
          underlaysResult,
          flashingTypesResult,
          labourTypesResult,
          accessoriesResult,
          existingLines,
        ] = await Promise.all([
          getProfiles("Roofing"),
          getProfiles("Wall Cladding"),
          getMaterials(),
          getUnderlays(),
          getFlashingTypes(),
          getLabourTypes(),
          getAccessories(),
          getQuoteLines(quoteResult.id),
        ]);

        setJob(jobResult);
        setQuote(quoteResult);
        setRoofProfiles(roofProfilesResult);
        setWallProfiles(wallProfilesResult);
        setMaterials(materialsResult);
        setUnderlays(underlaysResult);
        setFlashingTypes(flashingTypesResult);
        setLabourTypes(labourTypesResult);
        setAccessoryOptions(accessoriesResult);

        hydrateFromExistingLines(existingLines);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load quote.",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, router]);

  function hydrateFromExistingLines(lines: QuoteLine[]) {
    const roofMaterialLine = lines.find(
      (l) => l.section === "Roofing" && l.category === "Material" && l.metadata?.kind === "profile",
    );
    const roofUnderlayLine = lines.find(
      (l) => l.section === "Roofing" && l.category === "Material" && l.metadata?.kind === "underlay",
    );
    if (roofMaterialLine || roofUnderlayLine) {
      setRoofing({
        area: roofMaterialLine?.quantity ?? 0,
        profileId: (roofMaterialLine?.metadata?.profileId as string) ?? "",
        profileOptionId: (roofMaterialLine?.metadata?.profileOptionId as string) ?? "",
        materialId: (roofMaterialLine?.metadata?.materialId as string) ?? "",
        colourId: (roofMaterialLine?.metadata?.colourId as string) ?? "",
        underlayId: (roofUnderlayLine?.metadata?.underlayId as string) ?? "",
      });
    }

    const wallMaterialLine = lines.find(
      (l) => l.section === "Wall Cladding" && l.category === "Material" && l.metadata?.kind === "profile",
    );
    const wallUnderlayLine = lines.find(
      (l) => l.section === "Wall Cladding" && l.category === "Material" && l.metadata?.kind === "underlay",
    );
    if (wallMaterialLine || wallUnderlayLine) {
      setWallCladding({
        area: wallMaterialLine?.quantity ?? 0,
        profileId: (wallMaterialLine?.metadata?.profileId as string) ?? "",
        profileOptionId: (wallMaterialLine?.metadata?.profileOptionId as string) ?? "",
        materialId: (wallMaterialLine?.metadata?.materialId as string) ?? "",
        colourId: (wallMaterialLine?.metadata?.colourId as string) ?? "",
        underlayId: (wallUnderlayLine?.metadata?.underlayId as string) ?? "",
      });
    }

    setRoofingFlashings(
      lines
        .filter((l) => l.section === "Roofing" && l.category === "Flashing")
        .map((l) => ({
          id: l.id,
          flashingTypeId: (l.metadata?.flashingTypeId as string) ?? "",
          length: (l.metadata?.length as number) ?? 0,
          quantity: l.quantity,
        })),
    );
    setWallFlashings(
      lines
        .filter((l) => l.section === "Wall Cladding" && l.category === "Flashing")
        .map((l) => ({
          id: l.id,
          flashingTypeId: (l.metadata?.flashingTypeId as string) ?? "",
          length: (l.metadata?.length as number) ?? 0,
          quantity: l.quantity,
        })),
    );

    setRoofingLabour(
      lines
        .filter((l) => l.section === "Roofing" && l.category === "Labour")
        .map((l) => ({
          id: l.id,
          labourTypeId: (l.metadata?.labourTypeId as string) ?? "",
          quantity: l.quantity,
          hours: (l.metadata?.hours as number) ?? 0,
          rate: (l.unitCost as number) ?? 0,
        })),
    );
    setWallLabour(
      lines
        .filter((l) => l.section === "Wall Cladding" && l.category === "Labour")
        .map((l) => ({
          id: l.id,
          labourTypeId: (l.metadata?.labourTypeId as string) ?? "",
          quantity: l.quantity,
          hours: (l.metadata?.hours as number) ?? 0,
          rate: (l.unitCost as number) ?? 0,
        })),
    );

    setAccessoryRows(
      lines
        .filter((l) => l.section === "Accessories")
        .map((l) => ({
          id: l.id,
          accessoryId: (l.metadata?.accessoryId as string) ?? "",
          quantity: l.quantity,
        })),
    );
  }

  async function loadProfileOptions(profileId: string) {
    if (!profileId || profileOptionsByProfile[profileId]) return;
    try {
      const options = await getProfileOptions(profileId);
      setProfileOptionsByProfile((current) => ({ ...current, [profileId]: options }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load profile options.");
    }
  }

  async function loadColours(materialId: string) {
    if (!materialId || coloursByMaterial[materialId]) return;
    try {
      const colours = await getMaterialColours(materialId);
      setColoursByMaterial((current) => ({ ...current, [materialId]: colours }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load material colours.");
    }
  }

  function updateScope(
    which: "roofing" | "wallCladding",
    updates: Partial<ScopeState>,
  ) {
    const setter = which === "roofing" ? setRoofing : setWallCladding;
    setter((current) => {
      const next = { ...current, ...updates };
      // Dependent-dropdown clearing: never leave a stale child selection.
      if ("profileId" in updates) {
        next.profileOptionId = "";
        if (updates.profileId) loadProfileOptions(updates.profileId);
      }
      if ("materialId" in updates) {
        next.colourId = "";
        if (updates.materialId) loadColours(updates.materialId);
      }
      return next;
    });
  }

  function addFlashingRow(which: "roofing" | "wall") {
    const row: FlashingRow = {
      id: crypto.randomUUID(),
      flashingTypeId: "",
      length: 0,
      quantity: 1,
    };
    if (which === "roofing") setRoofingFlashings((c) => [...c, row]);
    else setWallFlashings((c) => [...c, row]);
  }

  function updateFlashingRow(
    which: "roofing" | "wall",
    id: string,
    updates: Partial<FlashingRow>,
  ) {
    const setter = which === "roofing" ? setRoofingFlashings : setWallFlashings;
    setter((current) => current.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }

  function removeFlashingRow(which: "roofing" | "wall", id: string) {
    const setter = which === "roofing" ? setRoofingFlashings : setWallFlashings;
    setter((current) => current.filter((r) => r.id !== id));
  }

  function addLabourRow(which: "roofing" | "wall") {
    const row: LabourRow = {
      id: crypto.randomUUID(),
      labourTypeId: "",
      quantity: 0,
      hours: 0,
      rate: 0,
    };
    if (which === "roofing") setRoofingLabour((c) => [...c, row]);
    else setWallLabour((c) => [...c, row]);
  }

  function updateLabourRow(
    which: "roofing" | "wall",
    id: string,
    updates: Partial<LabourRow>,
  ) {
    const setter = which === "roofing" ? setRoofingLabour : setWallLabour;
    setter((current) =>
      current.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...updates };
        // Auto-fill rate from the catalogue when labour type changes, but
        // leave it editable afterward (spec lists rate as its own field).
        if ("labourTypeId" in updates) {
          const lt = labourTypes.find((t) => t.id === updates.labourTypeId);
          next.rate = lt?.rate ?? next.rate;
        }
        return next;
      }),
    );
  }

  function removeLabourRow(which: "roofing" | "wall", id: string) {
    const setter = which === "roofing" ? setRoofingLabour : setWallLabour;
    setter((current) => current.filter((r) => r.id !== id));
  }

  function addAccessoryRow() {
    setAccessoryRows((c) => [...c, { id: crypto.randomUUID(), accessoryId: "", quantity: 1 }]);
  }

  function updateAccessoryRow(id: string, updates: Partial<AccessoryRow>) {
    setAccessoryRows((current) => current.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }

  function removeAccessoryRow(id: string) {
    setAccessoryRows((current) => current.filter((r) => r.id !== id));
  }

  // --- Costing (see ASSUMPTIONS at top of file) ---

  function flashingLineCost(row: FlashingRow): number | null {
    const type = flashingTypes.find((t) => t.id === row.flashingTypeId);
    if (!type || type.unitCost == null) return null;
    return type.unitCost * row.length * row.quantity;
  }

  function labourLineCost(row: LabourRow): number | null {
    if (!row.rate) return null;
    return row.hours * row.rate;
  }

  function accessoryLineCost(row: AccessoryRow): number | null {
    const acc = accessoryOptions.find((a) => a.id === row.accessoryId);
    if (!acc || acc.unitCost == null) return null;
    return acc.unitCost * row.quantity;
  }

  function underlayLineCost(scope: ScopeState): number | null {
    const underlay = underlays.find((u) => u.id === scope.underlayId);
    if (!scope.underlayId || !underlay || underlay.unitCost == null) return null;
    return underlay.unitCost * scope.area;
  }

  // Sum a list of nullable numbers; if ANY relevant line is unpriced,
  // the whole total is unknown rather than silently partial. Returns null
  // when there's at least one line but its price is unknown.
  function sumOrUnknown(values: (number | null)[]): number | null {
    if (values.length === 0) return 0;
    if (values.some((v) => v === null)) return null;
    return (values as number[]).reduce((a, b) => a + b, 0);
  }

  const materialsTotal = useMemo(
    () => sumOrUnknown([underlayLineCost(roofing), underlayLineCost(wallCladding)]),
    [roofing, wallCladding, underlays],
  );

  const flashingsTotal = useMemo(
    () =>
      sumOrUnknown([
        ...roofingFlashings.map(flashingLineCost),
        ...wallFlashings.map(flashingLineCost),
      ]),
    [roofingFlashings, wallFlashings, flashingTypes],
  );

  const labourTotal = useMemo(
    () => sumOrUnknown([...roofingLabour.map(labourLineCost), ...wallLabour.map(labourLineCost)]),
    [roofingLabour, wallLabour],
  );

  const accessoriesTotal = useMemo(
    () => sumOrUnknown(accessoryRows.map(accessoryLineCost)),
    [accessoryRows, accessoryOptions],
  );

  const subtotal = sumOrUnknown([materialsTotal, flashingsTotal, labourTotal, accessoriesTotal]);
  const gst = subtotal === null ? null : subtotal * 0.15;
  const total = subtotal === null || gst === null ? null : subtotal + gst;

  async function saveQuote() {
    if (!quote || saving) return;
    setSaving(true);
    setError("");

    try {
      const lines: QuoteLine[] = [];

      function pushScopeLines(section: Section, scope: ScopeState) {
        if (scope.profileId || scope.materialId || scope.area) {
          lines.push({
            id: crypto.randomUUID(),
            quoteId: quote!.id,
            section,
            category: "Material",
            description: "Profile/material selection",
            quantity: scope.area,
            unit: "m²",
            unitCost: null, // no profile/material pricing table exists yet
            sellPrice: null,
            sortOrder: lines.length,
            metadata: {
              kind: "profile",
              profileId: scope.profileId,
              profileOptionId: scope.profileOptionId,
              materialId: scope.materialId,
              colourId: scope.colourId,
            },
          });
        }
        if (scope.underlayId) {
          lines.push({
            id: crypto.randomUUID(),
            quoteId: quote!.id,
            section,
            category: "Material",
            description: "Underlay",
            quantity: scope.area,
            unit: "m²",
            unitCost: underlayLineCost(scope) !== null
              ? (underlays.find((u) => u.id === scope.underlayId)?.unitCost ?? null)
              : null,
            sellPrice: null,
            sortOrder: lines.length,
            metadata: { kind: "underlay", underlayId: scope.underlayId },
          });
        }
      }

      pushScopeLines("Roofing", roofing);
      pushScopeLines("Wall Cladding", wallCladding);

      function pushFlashingLines(section: Section, rows: FlashingRow[]) {
        rows.forEach((row, i) => {
          lines.push({
            id: row.id,
            quoteId: quote!.id,
            section,
            category: "Flashing",
            description:
              flashingTypes.find((t) => t.id === row.flashingTypeId)?.name ?? "Flashing",
            quantity: row.quantity,
            unit: "length",
            unitCost: flashingTypes.find((t) => t.id === row.flashingTypeId)?.unitCost ?? null,
            sellPrice: null,
            sortOrder: i,
            metadata: { flashingTypeId: row.flashingTypeId, length: row.length },
          });
        });
      }
      pushFlashingLines("Roofing", roofingFlashings);
      pushFlashingLines("Wall Cladding", wallFlashings);

      function pushLabourLines(section: Section, rows: LabourRow[]) {
        rows.forEach((row, i) => {
          lines.push({
            id: row.id,
            quoteId: quote!.id,
            section,
            category: "Labour",
            description: labourTypes.find((t) => t.id === row.labourTypeId)?.name ?? "Labour",
            quantity: row.quantity,
            unit: "hours",
            unitCost: row.rate || null,
            sellPrice: null,
            sortOrder: i,
            metadata: { labourTypeId: row.labourTypeId, hours: row.hours },
          });
        });
      }
      pushLabourLines("Roofing", roofingLabour);
      pushLabourLines("Wall Cladding", wallLabour);

      accessoryRows.forEach((row, i) => {
        lines.push({
          id: row.id,
          quoteId: quote!.id,
          section: "Accessories",
          category: "Accessory",
          description: accessoryOptions.find((a) => a.id === row.accessoryId)?.name ?? "Accessory",
          quantity: row.quantity,
          unit: "item",
          unitCost: accessoryOptions.find((a) => a.id === row.accessoryId)?.unitCost ?? null,
          sellPrice: null,
          sortOrder: i,
          metadata: { accessoryId: row.accessoryId },
        });
      });

      await saveQuoteLines(quote.id, lines);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save quote.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f4f1] px-6 py-10 text-[11px] text-black/40">
        Loading quote...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f4f4f1] px-6 py-10 text-[#242422]">
        <div className="mx-auto max-w-[900px]">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-red-600">
              Quote loading error
            </div>

            <div className="mt-3 whitespace-pre-wrap text-[12px] leading-6 text-red-800">
              {error}
            </div>

            <div className="mt-5">
              <Link
                href={`/jobs/${jobId}`}
                className="inline-block rounded-md bg-[#242422] px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-white"
              >
                Back to job
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!job || !quote) {
    return (
      <div className="min-h-screen bg-[#f4f4f1] px-6 py-10 text-[#242422]">
        <div className="mx-auto max-w-[900px]">
          <div className="rounded-lg border border-black/10 bg-[#fafaf8] p-6">
            <div className="text-[10px] uppercase tracking-[0.15em] text-black/30">
              Quote unavailable
            </div>

            <div className="mt-3 text-[12px] text-black/50">
              The quote could not be loaded.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f4f1] text-[#242422]">
      <header className="border-b border-black/[0.08] bg-[#fafaf8]">
        <div className="mx-auto max-w-[1200px] px-5 py-5 md:px-9">
          <Link href={`/jobs/${job.id}`} className="text-[10px] text-black/35 hover:text-black/70">
            ← {job.jobNumber}
          </Link>

          <div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="font-mono text-[10px] tracking-wide text-black/30">
                {quote.quoteNumber}
              </div>
              <h1 className="mt-1 text-[25px] font-medium tracking-[-0.035em]">Quote</h1>
              <div className="mt-1 text-[11px] text-black/40">
                {job.customer} · {job.address}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[10px] text-black/50">
                {quote.status}
              </span>
              <span className="rounded-full border border-black/[0.08] bg-white px-4 py-2 font-mono text-[10px] text-black/45">
                Rev {quote.revision}
              </span>
              <button
                type="button"
                onClick={saveQuote}
                disabled={saving}
                className="rounded-md bg-[#242422] px-4 py-2 text-[10px] text-white disabled:cursor-wait disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save quote"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 py-7 md:px-9">
        {error && (
          <div className="mb-5 border-l-2 border-red-500/60 bg-red-50 px-3 py-2.5 text-[11px] text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="space-y-5">
            <Card title="Roofing">
              <ScopeFields
                scope={roofing}
                profiles={roofProfiles}
                profileOptions={profileOptionsByProfile[roofing.profileId] ?? []}
                materials={materials}
                colours={coloursByMaterial[roofing.materialId] ?? []}
                underlays={underlays}
                onChange={(u) => updateScope("roofing", u)}
              />
            </Card>

            <Card title="Roofing — Flashings">
              <FlashingTable
                rows={roofingFlashings}
                flashingTypes={flashingTypes}
                onAdd={() => addFlashingRow("roofing")}
                onChange={(id, u) => updateFlashingRow("roofing", id, u)}
                onRemove={(id) => removeFlashingRow("roofing", id)}
              />
            </Card>

            <Card title="Roofing — Labour">
              <LabourTable
                rows={roofingLabour}
                labourTypes={labourTypes}
                onAdd={() => addLabourRow("roofing")}
                onChange={(id, u) => updateLabourRow("roofing", id, u)}
                onRemove={(id) => removeLabourRow("roofing", id)}
              />
            </Card>

            <Card title="Wall Cladding">
              <ScopeFields
                scope={wallCladding}
                profiles={wallProfiles}
                profileOptions={profileOptionsByProfile[wallCladding.profileId] ?? []}
                materials={materials}
                colours={coloursByMaterial[wallCladding.materialId] ?? []}
                underlays={underlays}
                onChange={(u) => updateScope("wallCladding", u)}
              />
            </Card>

            <Card title="Wall Cladding — Flashings">
              <FlashingTable
                rows={wallFlashings}
                flashingTypes={flashingTypes}
                onAdd={() => addFlashingRow("wall")}
                onChange={(id, u) => updateFlashingRow("wall", id, u)}
                onRemove={(id) => removeFlashingRow("wall", id)}
              />
            </Card>

            <Card title="Wall Cladding — Labour">
              <LabourTable
                rows={wallLabour}
                labourTypes={labourTypes}
                onAdd={() => addLabourRow("wall")}
                onChange={(id, u) => updateLabourRow("wall", id, u)}
                onRemove={(id) => removeLabourRow("wall", id)}
              />
            </Card>

            <Card title="Accessories">
              <AccessoryTable
                rows={accessoryRows}
                accessories={accessoryOptions}
                onAdd={addAccessoryRow}
                onChange={updateAccessoryRow}
                onRemove={removeAccessoryRow}
              />
            </Card>
          </section>

          <aside className="space-y-5 lg:sticky lg:top-5 lg:self-start">
            <Card title="Customer">
              <div className="space-y-4">
                <Detail label="Customer" value={job.customer} />
                <Detail label="Site" value={job.address} />
                <Detail label="Job number" value={job.jobNumber} mono />
              </div>
            </Card>

            <Card title="Totals">
              <div className="space-y-3">
                <TotalRow label="Materials" value={formatMoneyOrDash(materialsTotal)} />
                <TotalRow label="Flashings" value={formatMoneyOrDash(flashingsTotal)} />
                <TotalRow label="Labour" value={formatMoneyOrDash(labourTotal)} />
                <TotalRow label="Accessories" value={formatMoneyOrDash(accessoriesTotal)} />
                <TotalRow label="Subtotal" value={formatMoneyOrDash(subtotal)} />
                <TotalRow label="GST" value={formatMoneyOrDash(gst)} />
                <div className="border-t border-black/[0.08] pt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-black/30">
                      Quote total
                    </span>
                    <span className="font-mono text-[18px] text-black/70">
                      {formatMoneyOrDash(total)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}

// --- Reusable sub-sections ---

function ScopeFields({
  scope,
  profiles,
  profileOptions,
  materials,
  colours,
  underlays,
  onChange,
}: {
  scope: ScopeState;
  profiles: Profile[];
  profileOptions: ProfileOption[];
  materials: Material[];
  colours: MaterialColour[];
  underlays: Underlay[];
  onChange: (updates: Partial<ScopeState>) => void;
}) {
  const selectedProfile = profiles.find((p) => p.id === scope.profileId);
  const measurementLabel =
    selectedProfile?.measurementType === "width" ? "Width" : "Gauge";

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <Field label="Area (m²)">
        <input
          type="number"
          min="0"
          step="any"
          value={scope.area}
          onChange={(e) => onChange({ area: Number(e.target.value) })}
          className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
        />
      </Field>

      <Field label="Profile">
        <select
          value={scope.profileId}
          onChange={(e) => onChange({ profileId: e.target.value })}
          className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
        >
          <option value="">Select...</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={measurementLabel}>
        <select
          value={scope.profileOptionId}
          onChange={(e) => onChange({ profileOptionId: e.target.value })}
          disabled={!scope.profileId}
          className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
        >
          <option value="">Select...</option>
          {profileOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.value}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Material">
        <select
          value={scope.materialId}
          onChange={(e) => onChange({ materialId: e.target.value })}
          className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
        >
          <option value="">Select...</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Colour">
        <select
          value={scope.colourId}
          onChange={(e) => onChange({ colourId: e.target.value })}
          disabled={!scope.materialId}
          className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
        >
          <option value="">Select...</option>
          {colours.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Underlay">
        <select
          value={scope.underlayId}
          onChange={(e) => onChange({ underlayId: e.target.value })}
          className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
        >
          <option value="">Select...</option>
          {underlays.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function FlashingTable({
  rows,
  flashingTypes,
  onAdd,
  onChange,
  onRemove,
}: {
  rows: FlashingRow[];
  flashingTypes: FlashingType[];
  onAdd: () => void;
  onChange: (id: string, updates: Partial<FlashingRow>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      {rows.length === 0 ? (
        <div className="text-[11px] text-black/25">No flashing lines.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[1.5fr_1fr_1fr_30px] items-center gap-2">
              <select
                value={row.flashingTypeId}
                onChange={(e) => onChange(row.id, { flashingTypeId: e.target.value })}
                className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
              >
                <option value="">Flashing type...</option>
                {flashingTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Length"
                value={row.length}
                onChange={(e) => onChange(row.id, { length: Number(e.target.value) })}
                className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
              />
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Qty"
                value={row.quantity}
                onChange={(e) => onChange(row.id, { quantity: Number(e.target.value) })}
                className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => onRemove(row.id)}
                className="text-[12px] text-black/20 hover:text-red-500"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 text-[10px] text-black/40 hover:text-black/70"
      >
        + Add flashing line
      </button>
    </div>
  );
}

function LabourTable({
  rows,
  labourTypes,
  onAdd,
  onChange,
  onRemove,
}: {
  rows: LabourRow[];
  labourTypes: LabourType[];
  onAdd: () => void;
  onChange: (id: string, updates: Partial<LabourRow>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      {rows.length === 0 ? (
        <div className="text-[11px] text-black/25">No labour lines.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_30px] items-center gap-2"
            >
              <select
                value={row.labourTypeId}
                onChange={(e) => onChange(row.id, { labourTypeId: e.target.value })}
                className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
              >
                <option value="">Labour type...</option>
                {labourTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Qty"
                value={row.quantity}
                onChange={(e) => onChange(row.id, { quantity: Number(e.target.value) })}
                className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
              />
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Hours"
                value={row.hours}
                onChange={(e) => onChange(row.id, { hours: Number(e.target.value) })}
                className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
              />
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Rate"
                value={row.rate}
                onChange={(e) => onChange(row.id, { rate: Number(e.target.value) })}
                className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => onRemove(row.id)}
                className="text-[12px] text-black/20 hover:text-red-500"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 text-[10px] text-black/40 hover:text-black/70"
      >
        + Add labour line
      </button>
    </div>
  );
}

function AccessoryTable({
  rows,
  accessories,
  onAdd,
  onChange,
  onRemove,
}: {
  rows: AccessoryRow[];
  accessories: Accessory[];
  onAdd: () => void;
  onChange: (id: string, updates: Partial<AccessoryRow>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      {rows.length === 0 ? (
        <div className="text-[11px] text-black/25">No accessory lines.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[1.7fr_1fr_30px] items-center gap-2">
              <select
                value={row.accessoryId}
                onChange={(e) => onChange(row.id, { accessoryId: e.target.value })}
                className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
              >
                <option value="">Accessory...</option>
                {accessories.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Qty"
                value={row.quantity}
                onChange={(e) => onChange(row.id, { quantity: Number(e.target.value) })}
                className="w-full rounded border border-black/[0.08] bg-white px-2 py-1.5 text-[10px] text-black/55 outline-none disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => onRemove(row.id)}
                className="text-[12px] text-black/20 hover:text-red-500"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 text-[10px] text-black/40 hover:text-black/70"
      >
        + Add accessory line
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[9px] uppercase tracking-[0.12em] text-black/25">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-black/[0.08] bg-[#fafaf8]">
      <div className="border-b border-black/[0.06] px-5 py-3">
        <h2 className="text-[10px] uppercase tracking-[0.15em] text-black/30">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.12em] text-black/25">{label}</div>
      <div className={"mt-1 text-[11px] text-black/55" + (mono ? " font-mono" : "")}>
        {value || "—"}
      </div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-black/35">{label}</span>
      <span className="font-mono text-[11px] text-black/50">{value}</span>
    </div>
  );
}

function formatMoneyOrDash(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(value);
}
