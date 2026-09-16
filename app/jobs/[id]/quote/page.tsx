"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { getJob, type Job } from "@/lib/jobs";
import {
  createQuote,
  getQuoteForJob,
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

type ScopeName = "Roofing" | "Wall Cladding";
type ScopeKey = "roofing" | "wall";

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
  materialId: string;
  length: number;
  quantity: number;
};

type LabourRow = {
  id: string;
  labourTypeId: string;
  quantity: number;
  hours: number;
};

type AccessoryRow = {
  id: string;
  accessoryId: string;
  quantity: number;
};

type MaterialPrice = {
  id: string;
  material_id: string;
  profile_id: string;
  profile_option_id: string;
  colour_id: string | null;
  unit_cost: number;
};

type FlashingGirthBand = {
  id: string;
  min_girth: number;
  max_girth: number;
  active: boolean;
  sort_order: number;
};

type FlashingPrice = {
  id: string;
  flashing_girth_band_id: string;
  material_id: string;
  unit_cost: number;
};

const emptyScope: ScopeState = {
  area: 0,
  profileId: "",
  profileOptionId: "",
  materialId: "",
  colourId: "",
  underlayId: "",
};

const inputClass =
  "w-full rounded-md border border-black/[0.12] bg-white px-3 py-2 text-sm text-black outline-none focus:border-black/30";

const numberInputClass =
  "w-full rounded-md border border-black/[0.12] bg-white px-3 py-2 text-sm text-right text-black outline-none focus:border-black/30";

function money(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    minimumFractionDigits: 2,
  }).format(value);
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function catalogueGet<T>(
  table: string,
  params?: Record<string, string | undefined>,
): Promise<T[]> {
  const search = new URLSearchParams({ table });

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) search.set(key, value);
  }

  const response = await fetch(`/api/catalogue?${search.toString()}`);

  if (!response.ok) {
    let message = `Unable to load ${table}.`;

    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // Keep default message.
    }

    throw new Error(message);
  }

  const body = await response.json();

  return (body?.data ?? []) as T[];
}

export default function QuotePage() {
  const params = useParams();
  const router = useRouter();

  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [roofProfiles, setRoofProfiles] = useState<Profile[]>([]);
  const [wallProfiles, setWallProfiles] = useState<Profile[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [underlays, setUnderlays] = useState<Underlay[]>([]);
  const [flashingTypes, setFlashingTypes] = useState<FlashingType[]>([]);
  const [labourTypes, setLabourTypes] = useState<LabourType[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);

  const [profileOptions, setProfileOptions] = useState<
    Record<string, ProfileOption[]>
  >({});

  const [materialColours, setMaterialColours] = useState<
    Record<string, MaterialColour[]>
  >({});

  const [materialPrices, setMaterialPrices] = useState<MaterialPrice[]>([]);
  const [flashingBands, setFlashingBands] = useState<FlashingGirthBand[]>([]);
  const [flashingPrices, setFlashingPrices] = useState<FlashingPrice[]>([]);

  const [roofing, setRoofing] = useState<ScopeState>(emptyScope);
  const [wall, setWall] = useState<ScopeState>(emptyScope);

  const [roofingFlashings, setRoofingFlashings] = useState<FlashingRow[]>([]);
  const [wallFlashings, setWallFlashings] = useState<FlashingRow[]>([]);

  const [roofingLabour, setRoofingLabour] = useState<LabourRow[]>([]);
  const [wallLabour, setWallLabour] = useState<LabourRow[]>([]);

  const [accessoryRows, setAccessoryRows] = useState<AccessoryRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

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
          pricesResult,
          bandsResult,
          flashingPricesResult,
        ] = await Promise.all([
          getProfiles("Roofing"),
          getProfiles("Wall Cladding"),
          getMaterials(),
          getUnderlays(),
          getFlashingTypes(),
          getLabourTypes(),
          getAccessories(),
          getQuoteLines(quoteResult.id),
          catalogueGet<MaterialPrice>("material_prices"),
          catalogueGet<FlashingGirthBand>("flashing_girth_bands"),
          catalogueGet<FlashingPrice>("flashing_prices"),
        ]);

        if (cancelled) return;

        setJob(jobResult);
        setQuote(quoteResult);

        setRoofProfiles(roofProfilesResult);
        setWallProfiles(wallProfilesResult);
        setMaterials(materialsResult);
        setUnderlays(underlaysResult);
        setFlashingTypes(flashingTypesResult);
        setLabourTypes(labourTypesResult);
        setAccessories(accessoriesResult);

        setMaterialPrices(pricesResult);
        setFlashingBands(bandsResult);
        setFlashingPrices(flashingPricesResult);

        await hydrateExistingLines(
          existingLines,
          roofProfilesResult,
          wallProfilesResult,
          materialsResult,
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load quote.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [jobId, router]);

  async function hydrateExistingLines(
    lines: QuoteLine[],
    roofProfilesResult: Profile[],
    wallProfilesResult: Profile[],
    materialsResult: Material[],
  ) {
    const hydrateScope = async (
      section: ScopeName,
      setter: (value: ScopeState) => void,
    ) => {
      const materialLine = lines.find(
        (line) =>
          line.section === section &&
          line.category === "Material" &&
          line.metadata?.kind === "profile",
      );

      const underlayLine = lines.find(
        (line) =>
          line.section === section &&
          line.category === "Material" &&
          line.metadata?.kind === "underlay",
      );

      if (!materialLine && !underlayLine) return;

      const profileId =
        typeof materialLine?.metadata?.profileId === "string"
          ? materialLine.metadata.profileId
          : "";

      const profileOptionId =
        typeof materialLine?.metadata?.profileOptionId === "string"
          ? materialLine.metadata.profileOptionId
          : "";

      const materialId =
        typeof materialLine?.metadata?.materialId === "string"
          ? materialLine.metadata.materialId
          : "";

      const colourId =
        typeof materialLine?.metadata?.colourId === "string"
          ? materialLine.metadata.colourId
          : "";

      const underlayId =
        typeof underlayLine?.metadata?.underlayId === "string"
          ? underlayLine.metadata.underlayId
          : "";

      if (profileId) {
        try {
          const options = await getProfileOptions(profileId);
          setProfileOptions((current) => ({
            ...current,
            [profileId]: options,
          }));
        } catch {
          // Leave the quote load usable even if dependent catalogue data fails.
        }
      }

      if (materialId) {
        try {
          const colours = await getMaterialColours(materialId);
          setMaterialColours((current) => ({
            ...current,
            [materialId]: colours,
          }));
        } catch {
          // Leave the quote load usable.
        }
      }

      setter({
        area: materialLine?.quantity ?? 0,
        profileId,
        profileOptionId,
        materialId,
        colourId,
        underlayId,
      });

      void roofProfilesResult;
      void wallProfilesResult;
      void materialsResult;
    };

    await Promise.all([
      hydrateScope("Roofing", setRoofing),
      hydrateScope("Wall Cladding", setWall),
    ]);

    const flashingRows = (
      section: ScopeName,
    ): FlashingRow[] =>
      lines
        .filter(
          (line) =>
            line.section === section && line.category === "Flashing",
        )
        .map((line) => ({
          id: line.id,
          flashingTypeId:
            typeof line.metadata?.flashingTypeId === "string"
              ? line.metadata.flashingTypeId
              : "",
          materialId:
            typeof line.metadata?.materialId === "string"
              ? line.metadata.materialId
              : "",
          length:
            typeof line.metadata?.length === "number"
              ? line.metadata.length
              : 0,
          quantity: line.quantity,
        }));

    setRoofingFlashings(flashingRows("Roofing"));
    setWallFlashings(flashingRows("Wall Cladding"));

    const labourRows = (
      section: ScopeName,
    ): LabourRow[] =>
      lines
        .filter(
          (line) =>
            line.section === section && line.category === "Labour",
        )
        .map((line) => ({
          id: line.id,
          labourTypeId:
            typeof line.metadata?.labourTypeId === "string"
              ? line.metadata.labourTypeId
              : "",
          quantity: line.quantity,
          hours:
            typeof line.metadata?.hours === "number"
              ? line.metadata.hours
              : 0,
        }));

    setRoofingLabour(labourRows("Roofing"));
    setWallLabour(labourRows("Wall Cladding"));

    setAccessoryRows(
      lines
        .filter((line) => line.section === "Accessories")
        .map((line) => ({
          id: line.id,
          accessoryId:
            typeof line.metadata?.accessoryId === "string"
              ? line.metadata.accessoryId
              : "",
          quantity: line.quantity,
        })),
    );
  }

  async function ensureProfileOptions(profileId: string) {
    if (!profileId || profileOptions[profileId]) return;

    try {
      const values = await getProfileOptions(profileId);

      setProfileOptions((current) => ({
        ...current,
        [profileId]: values,
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load profile options.",
      );
    }
  }

  async function ensureMaterialColours(materialId: string) {
    if (!materialId || materialColours[materialId]) return;

    try {
      const values = await getMaterialColours(materialId);

      setMaterialColours((current) => ({
        ...current,
        [materialId]: values,
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load material colours.",
      );
    }
  }

  function updateScope(
    key: ScopeKey,
    updates: Partial<ScopeState>,
  ) {
    const setter = key === "roofing" ? setRoofing : setWall;

    setter((current) => {
      const next = {
        ...current,
        ...updates,
      };

      if ("profileId" in updates) {
        next.profileOptionId = "";

        if (updates.profileId) {
          void ensureProfileOptions(updates.profileId);
        }
      }

      if ("materialId" in updates) {
        next.colourId = "";

        if (updates.materialId) {
          void ensureMaterialColours(updates.materialId);
        }
      }

      return next;
    });
  }

  function addFlashing(key: ScopeKey) {
    const row: FlashingRow = {
      id: crypto.randomUUID(),
      flashingTypeId: "",
      materialId: "",
      length: 0,
      quantity: 1,
    };

    if (key === "roofing") {
      setRoofingFlashings((current) => [...current, row]);
    } else {
      setWallFlashings((current) => [...current, row]);
    }
  }

  function updateFlashing(
    key: ScopeKey,
    id: string,
    updates: Partial<FlashingRow>,
  ) {
    const setter =
      key === "roofing"
        ? setRoofingFlashings
        : setWallFlashings;

    setter((current) =>
      current.map((row) =>
        row.id === id ? { ...row, ...updates } : row,
      ),
    );
  }

  function removeFlashing(key: ScopeKey, id: string) {
    const setter =
      key === "roofing"
        ? setRoofingFlashings
        : setWallFlashings;

    setter((current) =>
      current.filter((row) => row.id !== id),
    );
  }

  function addLabour(key: ScopeKey) {
    const row: LabourRow = {
      id: crypto.randomUUID(),
      labourTypeId: "",
      quantity: 1,
      hours: 0,
    };

    if (key === "roofing") {
      setRoofingLabour((current) => [...current, row]);
    } else {
      setWallLabour((current) => [...current, row]);
    }
  }

  function updateLabour(
    key: ScopeKey,
    id: string,
    updates: Partial<LabourRow>,
  ) {
    const setter =
      key === "roofing"
        ? setRoofingLabour
        : setWallLabour;

    setter((current) =>
      current.map((row) =>
        row.id === id ? { ...row, ...updates } : row,
      ),
    );
  }

  function removeLabour(key: ScopeKey, id: string) {
    const setter =
      key === "roofing"
        ? setRoofingLabour
        : setWallLabour;

    setter((current) =>
      current.filter((row) => row.id !== id),
    );
  }

  function addAccessory() {
    setAccessoryRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        accessoryId: "",
        quantity: 1,
      },
    ]);
  }

  function updateAccessory(
    id: string,
    updates: Partial<AccessoryRow>,
  ) {
    setAccessoryRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, ...updates } : row,
      ),
    );
  }

  function removeAccessory(id: string) {
    setAccessoryRows((current) =>
      current.filter((row) => row.id !== id),
    );
  }

  function getMaterialPrice(scope: ScopeState) {
    if (
      !scope.profileId ||
      !scope.profileOptionId ||
      !scope.materialId
    ) {
      return null;
    }

    const exactColour = materialPrices.find(
      (price) =>
        price.material_id === scope.materialId &&
        price.profile_id === scope.profileId &&
        price.profile_option_id === scope.profileOptionId &&
        price.colour_id === scope.colourId,
    );

    if (exactColour) return exactColour.unit_cost;

    const genericColour = materialPrices.find(
      (price) =>
        price.material_id === scope.materialId &&
        price.profile_id === scope.profileId &&
        price.profile_option_id === scope.profileOptionId &&
        price.colour_id == null,
    );

    return genericColour?.unit_cost ?? null;
  }

  function getFlashingBand(
    flashingTypeId: string,
  ): FlashingGirthBand | null {
    const type = flashingTypes.find(
      (item) => item.id === flashingTypeId,
    );

    if (!type || type.typicalGirth == null) return null;

    return (
      flashingBands
        .filter(
          (band) =>
            type.typicalGirth! >= band.min_girth &&
            type.typicalGirth! <= band.max_girth,
        )
        .sort((a, b) => {
          if (a.min_girth !== b.min_girth) {
            return a.min_girth - b.min_girth;
          }

          return a.sort_order - b.sort_order;
        })[0] ?? null
    );
  }

  function getFlashingPrice(
    flashingTypeId: string,
    materialId: string,
  ) {
    const band = getFlashingBand(flashingTypeId);

    if (!band || !materialId) return null;

    const price = flashingPrices.find(
      (item) =>
        item.flashing_girth_band_id === band.id &&
        item.material_id === materialId,
    );

    return price?.unit_cost ?? null;
  }

  function materialDescription(
    section: ScopeName,
    scope: ScopeState,
  ) {
    const profile = (
      section === "Roofing"
        ? roofProfiles
        : wallProfiles
    ).find((item) => item.id === scope.profileId);

    const option = scope.profileOptionId
      ? profileOptions[scope.profileId]?.find(
          (item) => item.id === scope.profileOptionId,
        )
      : null;

    const material = materials.find(
      (item) => item.id === scope.materialId,
    );

    const colour = scope.colourId
      ? materialColours[scope.materialId]?.find(
          (item) => item.id === scope.colourId,
        )
      : null;

    return [
      section,
      profile?.name,
      option?.value,
      material?.name,
      colour?.name,
    ]
      .filter(Boolean)
      .join(" — ");
  }

  function scopeMaterialCost(scope: ScopeState) {
    const price = getMaterialPrice(scope);

    if (price == null || scope.area <= 0) return null;

    return price * scope.area;
  }

  function scopeUnderlayCost(scope: ScopeState) {
    const underlay = underlays.find(
      (item) => item.id === scope.underlayId,
    );

    if (
      !underlay ||
      underlay.unitCost == null ||
      scope.area <= 0
    ) {
      return null;
    }

    return underlay.unitCost * scope.area;
  }

  function flashingCost(row: FlashingRow) {
    const price = getFlashingPrice(
      row.flashingTypeId,
      row.materialId,
    );

    if (
      price == null ||
      row.length <= 0 ||
      row.quantity <= 0
    ) {
      return null;
    }

    return price * row.length * row.quantity;
  }

  function labourCost(row: LabourRow) {
    const type = labourTypes.find(
      (item) => item.id === row.labourTypeId,
    );

    if (
      !type ||
      type.rate == null ||
      row.hours <= 0 ||
      row.quantity <= 0
    ) {
      return null;
    }

    return type.rate * row.hours * row.quantity;
  }

  function accessoryCost(row: AccessoryRow) {
    const accessory = accessories.find(
      (item) => item.id === row.accessoryId,
    );

    if (
      !accessory ||
      accessory.unitCost == null ||
      row.quantity <= 0
    ) {
      return null;
    }

    return accessory.unitCost * row.quantity;
  }

  const totals = useMemo(() => {
    let subtotal = 0;

    const roofingMaterial = scopeMaterialCost(roofing);
    const roofingUnderlay = scopeUnderlayCost(roofing);
    const wallMaterial = scopeMaterialCost(wall);
    const wallUnderlay = scopeUnderlayCost(wall);

    if (roofingMaterial != null) subtotal += roofingMaterial;
    if (roofingUnderlay != null) subtotal += roofingUnderlay;
    if (wallMaterial != null) subtotal += wallMaterial;
    if (wallUnderlay != null) subtotal += wallUnderlay;

    for (const row of roofingFlashings) {
      const value = flashingCost(row);
      if (value != null) subtotal += value;
    }

    for (const row of wallFlashings) {
      const value = flashingCost(row);
      if (value != null) subtotal += value;
    }

    for (const row of roofingLabour) {
      const value = labourCost(row);
      if (value != null) subtotal += value;
    }

    for (const row of wallLabour) {
      const value = labourCost(row);
      if (value != null) subtotal += value;
    }

    for (const row of accessoryRows) {
      const value = accessoryCost(row);
      if (value != null) subtotal += value;
    }

    const gst = subtotal * 0.15;
    const total = subtotal + gst;

    return {
      subtotal,
      gst,
      total,
    };
  }, [
    roofing,
    wall,
    roofingFlashings,
    wallFlashings,
    roofingLabour,
    wallLabour,
    accessoryRows,
    materialPrices,
    flashingBands,
    flashingPrices,
    flashingTypes,
    underlays,
    labourTypes,
    accessories,
  ]);

  function buildQuoteLines(): QuoteLine[] {
    if (!quote) return [];

    const lines: QuoteLine[] = [];
    let sortOrder = 0;

    function pushLine(
      section: string,
      category: string,
      description: string,
      quantity: number,
      unit: string,
      unitCost: number | null,
      metadata: Record<string, unknown>,
    ) {
      lines.push({
        id: crypto.randomUUID(),
        quoteId: quote!.id,
        section,
        category,
        description,
        quantity,
        unit,
        unitCost,
        sellPrice: unitCost,
        sortOrder: sortOrder++,
        metadata,
      });
    }

    function addScope(
      section: ScopeName,
      scope: ScopeState,
    ) {
      if (
        scope.area > 0 &&
        scope.profileId &&
        scope.profileOptionId &&
        scope.materialId
      ) {
        const price = getMaterialPrice(scope);

        pushLine(
          section,
          "Material",
          materialDescription(section, scope),
          scope.area,
          "m²",
          price,
          {
            kind: "profile",
            profileId: scope.profileId,
            profileOptionId: scope.profileOptionId,
            materialId: scope.materialId,
            colourId: scope.colourId || null,
          },
        );
      }

      if (scope.underlayId && scope.area > 0) {
        const underlay = underlays.find(
          (item) => item.id === scope.underlayId,
        );

        pushLine(
          section,
          "Material",
          underlay?.name ?? "Underlay",
          scope.area,
          underlay?.unit ?? "m²",
          underlay?.unitCost ?? null,
          {
            kind: "underlay",
            underlayId: scope.underlayId,
          },
        );
      }
    }

    addScope("Roofing", roofing);
    addScope("Wall Cladding", wall);

    function addFlashings(
      section: ScopeName,
      rows: FlashingRow[],
    ) {
      for (const row of rows) {
        if (
          !row.flashingTypeId ||
          !row.materialId ||
          row.length <= 0 ||
          row.quantity <= 0
        ) {
          continue;
        }

        const type = flashingTypes.find(
          (item) => item.id === row.flashingTypeId,
        );

        const material = materials.find(
          (item) => item.id === row.materialId,
        );

        const band = getFlashingBand(row.flashingTypeId);
        const price = getFlashingPrice(
          row.flashingTypeId,
          row.materialId,
        );

        pushLine(
          section,
          "Flashing",
          [
            type?.name,
            material?.name,
            band
              ? `${band.min_girth}-${band.max_girth}G`
              : null,
          ]
            .filter(Boolean)
            .join(" — "),
          row.length * row.quantity,
          "m",
          price,
          {
            kind: "flashing",
            flashingTypeId: row.flashingTypeId,
            materialId: row.materialId,
            length: row.length,
            girthBandId: band?.id ?? null,
            typicalGirth:
              type?.typicalGirth ?? null,
          },
        );
      }
    }

    addFlashings("Roofing", roofingFlashings);
    addFlashings("Wall Cladding", wallFlashings);

    function addLabour(
      section: ScopeName,
      rows: LabourRow[],
    ) {
      for (const row of rows) {
        if (
          !row.labourTypeId ||
          row.hours <= 0 ||
          row.quantity <= 0
        ) {
          continue;
        }

        const type = labourTypes.find(
          (item) => item.id === row.labourTypeId,
        );

        pushLine(
          section,
          "Labour",
          type?.name ?? "Labour",
          row.hours * row.quantity,
          "hr",
          type?.rate ?? null,
          {
            kind: "labour",
            labourTypeId: row.labourTypeId,
            hours: row.hours,
          },
        );
      }
    }

    addLabour("Roofing", roofingLabour);
    addLabour("Wall Cladding", wallLabour);

    for (const row of accessoryRows) {
      if (!row.accessoryId || row.quantity <= 0) continue;

      const accessory = accessories.find(
        (item) => item.id === row.accessoryId,
      );

      pushLine(
        "Accessories",
        "Accessory",
        accessory?.name ?? "Accessory",
        row.quantity,
        accessory?.unit ?? "item",
        accessory?.unitCost ?? null,
        {
          kind: "accessory",
          accessoryId: row.accessoryId,
        },
      );
    }

    return lines;
  }

  async function saveQuote() {
    if (!quote) return;

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const lines = buildQuoteLines();

      await saveQuoteLines(quote.id, lines);

      setNotice("Quote saved.");

      window.setTimeout(() => {
        setNotice("");
      }, 2500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save quote.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] p-8 text-sm text-black/60">
        Loading quote…
      </main>
    );
  }

  if (!job || !quote) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] p-8">
        <p className="text-sm text-black/60">
          Quote could not be loaded.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-black">
      <div className="mx-auto max-w-[1500px] px-6 py-8">
        <header className="mb-8 flex flex-col gap-5 border-b border-black/[0.08] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3 text-xs text-black/45">
              <Link href={`/jobs/${job.id}`} className="hover:text-black">
                Jobs
              </Link>
              <span>/</span>
              <span>{job.jobNumber}</span>
              <span>/</span>
              <span>Quote</span>
            </div>

            <h1 className="text-2xl font-medium tracking-tight">
              {job.name}
            </h1>

            <div className="mt-2 text-sm text-black/55">
              {job.customer}
              {job.address ? ` · ${job.address}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-black/45">
              <div>{quote.quoteNumber}</div>
              <div>Revision {quote.revision}</div>
              <div>{quote.status}</div>
            </div>

            <button
              type="button"
              onClick={saveQuote}
              disabled={saving}
              className="rounded-md bg-black px-5 py-2.5 text-sm text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save quote"}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {notice}
          </div>
        )}

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            <ScopeSection
              title="Roofing"
              scope={roofing}
              profiles={roofProfiles}
              materials={materials}
              underlays={underlays}
              profileOptions={profileOptions}
              colours={materialColours}
              onChange={(updates) =>
                updateScope("roofing", updates)
              }
              getPrice={getMaterialPrice}
              onAddFlashing={() => addFlashing("roofing")}
              flashingRows={roofingFlashings}
              flashingTypes={flashingTypes}
              flashingBands={flashingBands}
              onUpdateFlashing={(id, updates) =>
                updateFlashing("roofing", id, updates)
              }
              onRemoveFlashing={(id) =>
                removeFlashing("roofing", id)
              }
              onAddLabour={() => addLabour("roofing")}
              labourRows={roofingLabour}
              labourTypes={labourTypes}
              onUpdateLabour={(id, updates) =>
                updateLabour("roofing", id, updates)
              }
              onRemoveLabour={(id) =>
                removeLabour("roofing", id)
              }
              getFlashingBand={getFlashingBand}
              getFlashingPrice={getFlashingPrice}
              flashingCost={flashingCost}
              labourCost={labourCost}
            />

            <ScopeSection
              title="Wall Cladding"
              scope={wall}
              profiles={wallProfiles}
              materials={materials}
              underlays={underlays}
              profileOptions={profileOptions}
              colours={materialColours}
              onChange={(updates) =>
                updateScope("wall", updates)
              }
              getPrice={getMaterialPrice}
              onAddFlashing={() => addFlashing("wall")}
              flashingRows={wallFlashings}
              flashingTypes={flashingTypes}
              flashingBands={flashingBands}
              onUpdateFlashing={(id, updates) =>
                updateFlashing("wall", id, updates)
              }
              onRemoveFlashing={(id) =>
                removeFlashing("wall", id)
              }
              onAddLabour={() => addLabour("wall")}
              labourRows={wallLabour}
              labourTypes={labourTypes}
              onUpdateLabour={(id, updates) =>
                updateLabour("wall", id, updates)
              }
              onRemoveLabour={(id) =>
                removeLabour("wall", id)
              }
              getFlashingBand={getFlashingBand}
              getFlashingPrice={getFlashingPrice}
              flashingCost={flashingCost}
              labourCost={labourCost}
            />

            <section className="rounded-lg border border-black/[0.08] bg-white">
              <div className="flex items-center justify-between border-b border-black/[0.08] px-5 py-4">
                <div>
                  <h2 className="font-medium">Accessories</h2>
                  <p className="mt-1 text-xs text-black/45">
                    Add catalogue accessories to the quote.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addAccessory}
                  className="rounded-md border border-black/[0.12] px-3 py-2 text-xs hover:bg-black/[0.03]"
                >
                  + Add accessory
                </button>
              </div>

              <div className="p-5">
                {accessoryRows.length === 0 ? (
                  <p className="text-sm text-black/40">
                    No accessories added.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {accessoryRows.map((row) => {
                      const accessory = accessories.find(
                        (item) => item.id === row.accessoryId,
                      );

                      return (
                        <div
                          key={row.id}
                          className="grid gap-3 rounded-md border border-black/[0.08] p-3 md:grid-cols-[minmax(0,1fr)_120px_120px_40px]"
                        >
                          <select
                            className={inputClass}
                            value={row.accessoryId}
                            onChange={(event) =>
                              updateAccessory(row.id, {
                                accessoryId:
                                  event.target.value,
                              })
                            }
                          >
                            <option value="">
                              Select accessory…
                            </option>

                            {accessories.map((item) => (
                              <option
                                key={item.id}
                                value={item.id}
                              >
                                {item.name}
                              </option>
                            ))}
                          </select>

                          <input
                            className={numberInputClass}
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.quantity}
                            onChange={(event) =>
                              updateAccessory(row.id, {
                                quantity: numberValue(
                                  event.target.value,
                                ),
                              })
                            }
                          />

                          <div className="flex items-center justify-end text-sm">
                            {money(
                              accessory?.unitCost != null
                                ? accessory.unitCost *
                                    row.quantity
                                : null,
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeAccessory(row.id)
                            }
                            className="text-black/35 hover:text-red-600"
                            aria-label="Remove accessory"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-lg border border-black/[0.08] bg-white">
              <div className="border-b border-black/[0.08] px-5 py-4">
                <h2 className="font-medium">Quote summary</h2>
              </div>

              <div className="space-y-3 p-5 text-sm">
                <SummaryRow
                  label="Subtotal"
                  value={money(totals.subtotal)}
                />

                <SummaryRow
                  label="GST"
                  value={money(totals.gst)}
                />

                <div className="my-4 border-t border-black/[0.08]" />

                <div className="flex items-baseline justify-between">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-medium">
                    {money(totals.total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-black/[0.08] bg-white p-5 text-xs text-black/50">
              <p className="font-medium text-black/70">
                Pricing source
              </p>

              <p className="mt-2 leading-5">
                All rates are resolved from the current Catalogue.
                Flashing prices use the flashing type&apos;s typical
                girth and the matching global girth band.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-black/60">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

type ScopeSectionProps = {
  title: ScopeName;
  scope: ScopeState;
  profiles: Profile[];
  materials: Material[];
  underlays: Underlay[];
  profileOptions: Record<string, ProfileOption[]>;
  colours: Record<string, MaterialColour[]>;
  onChange: (updates: Partial<ScopeState>) => void;
  getPrice: (scope: ScopeState) => number | null;

  flashingRows: FlashingRow[];
  flashingTypes: FlashingType[];
  flashingBands: FlashingGirthBand[];
  onAddFlashing: () => void;
  onUpdateFlashing: (
    id: string,
    updates: Partial<FlashingRow>,
  ) => void;
  onRemoveFlashing: (id: string) => void;

  labourRows: LabourRow[];
  labourTypes: LabourType[];
  onAddLabour: () => void;
  onUpdateLabour: (
    id: string,
    updates: Partial<LabourRow>,
  ) => void;
  onRemoveLabour: (id: string) => void;

  getFlashingBand: (
    flashingTypeId: string,
  ) => FlashingGirthBand | null;

  getFlashingPrice: (
    flashingTypeId: string,
    materialId: string,
  ) => number | null;

  flashingCost: (row: FlashingRow) => number | null;
  labourCost: (row: LabourRow) => number | null;
};

function ScopeSection(props: ScopeSectionProps) {
  const {
    title,
    scope,
    profiles,
    materials,
    underlays,
    profileOptions,
    colours,
    onChange,
    getPrice,
    flashingRows,
    flashingTypes,
    flashingBands,
    onAddFlashing,
    onUpdateFlashing,
    onRemoveFlashing,
    labourRows,
    labourTypes,
    onAddLabour,
    onUpdateLabour,
    onRemoveLabour,
    getFlashingBand,
    getFlashingPrice,
    flashingCost,
    labourCost,
  } = props;

  const selectedProfile = profiles.find(
    (item) => item.id === scope.profileId,
  );

  const options = scope.profileId
    ? profileOptions[scope.profileId] ?? []
    : [];

  const availableColours = scope.materialId
  ? props.colours[scope.materialId] ?? []
  : [];

  const materialPrice = getPrice(scope);

  const underlay = underlays.find(
    (item) => item.id === scope.underlayId,
  );

  return (
    <section className="rounded-lg border border-black/[0.08] bg-white">
      <div className="border-b border-black/[0.08] px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-medium">{title}</h2>
            <p className="mt-1 text-xs text-black/45">
              Select the catalogue items and enter the measured area.
            </p>
          </div>

          {materialPrice != null && scope.area > 0 && (
            <div className="text-right">
              <div className="text-xs text-black/40">
                Material rate
              </div>
              <div className="font-medium">
                {money(materialPrice)} / m²
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Profile">
            <select
              className={inputClass}
              value={scope.profileId}
              onChange={(event) =>
                onChange({
                  profileId: event.target.value,
                })
              }
            >
              <option value="">Select profile…</option>

              {profiles.map((profile) => (
                <option
                  key={profile.id}
                  value={profile.id}
                >
                  {profile.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={
              selectedProfile?.measurementType === "gauge"
                ? "Gauge"
                : "Width"
            }
          >
            <select
              className={inputClass}
              value={scope.profileOptionId}
              onChange={(event) =>
                onChange({
                  profileOptionId: event.target.value,
                })
              }
              disabled={!scope.profileId}
            >
              <option value="">
                {scope.profileId
                  ? "Select option…"
                  : "Select profile first"}
              </option>

              {options.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                >
                  {option.value}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Material">
            <select
              className={inputClass}
              value={scope.materialId}
              onChange={(event) =>
                onChange({
                  materialId: event.target.value,
                })
              }
            >
              <option value="">Select material…</option>

              {materials.map((material) => (
                <option
                  key={material.id}
                  value={material.id}
                >
                  {material.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Colour">
            <select
              className={inputClass}
              value={scope.colourId}
              onChange={(event) =>
                onChange({
                  colourId: event.target.value,
                })
              }
              disabled={!scope.materialId}
            >
              <option value="">
                {scope.materialId
                  ? "Select colour…"
                  : "Select material first"}
              </option>

              {availableColours.map((colour) => (
                <option
                  key={colour.id}
                  value={colour.id}
                >
                  {colour.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Area (m²)">
            <input
              className={numberInputClass}
              type="number"
              min="0"
              step="0.01"
              value={scope.area}
              onChange={(event) =>
                onChange({
                  area: numberValue(event.target.value),
                })
              }
            />
          </Field>

          <Field label="Underlay">
            <select
              className={inputClass}
              value={scope.underlayId}
              onChange={(event) =>
                onChange({
                  underlayId: event.target.value,
                })
              }
            >
              <option value="">No underlay</option>

              {underlays.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                  {item.unitCost != null
                    ? ` — ${money(item.unitCost)}/${item.unit}`
                    : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-5 rounded-md bg-black/[0.025] p-4">
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div>
              <div className="text-xs text-black/40">
                Material
              </div>
              <div className="mt-1">
                {materialPrice != null
                  ? `${money(materialPrice)} / m²`
                  : "—"}
              </div>
            </div>

            <div>
              <div className="text-xs text-black/40">
                Material total
              </div>
              <div className="mt-1">
                {materialPrice != null && scope.area > 0
                  ? money(materialPrice * scope.area)
                  : "—"}
              </div>
            </div>

            <div>
              <div className="text-xs text-black/40">
                Underlay total
              </div>
              <div className="mt-1">
                {underlay?.unitCost != null &&
                scope.area > 0
                  ? money(
                      underlay.unitCost * scope.area,
                    )
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-black/[0.08] pt-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">
                Flashings
              </h3>
              <p className="mt-1 text-xs text-black/45">
                Typical girth determines the applicable global
                girth band and material price.
              </p>
            </div>

            <button
              type="button"
              onClick={onAddFlashing}
              className="rounded-md border border-black/[0.12] px-3 py-2 text-xs hover:bg-black/[0.03]"
            >
              + Add flashing
            </button>
          </div>

          {flashingRows.length === 0 ? (
            <p className="text-sm text-black/40">
              No flashings added.
            </p>
          ) : (
            <div className="space-y-3">
              {flashingRows.map((row) => {
                const type = flashingTypes.find(
                  (item) =>
                    item.id === row.flashingTypeId,
                );

                const band = getFlashingBand(
                  row.flashingTypeId,
                );

                const price = getFlashingPrice(
                  row.flashingTypeId,
                  row.materialId,
                );

                return (
                  <div
                    key={row.id}
                    className="rounded-md border border-black/[0.08] p-3"
                  >
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_100px_100px_40px]">
                      <select
                        className={inputClass}
                        value={row.flashingTypeId}
                        onChange={(event) =>
                          onUpdateFlashing(row.id, {
                            flashingTypeId:
                              event.target.value,
                          })
                        }
                      >
                        <option value="">
                          Select flashing…
                        </option>

                        {flashingTypes.map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                          >
                            {item.name}
                          </option>
                        ))}
                      </select>

                      <select
                        className={inputClass}
                        value={row.materialId}
                        onChange={(event) =>
                          onUpdateFlashing(row.id, {
                            materialId:
                              event.target.value,
                          })
                        }
                      >
                        <option value="">
                          Select material…
                        </option>

                        {materials.map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                          >
                            {item.name}
                          </option>
                        ))}
                      </select>

                      <input
                        className={numberInputClass}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Length"
                        value={row.length}
                        onChange={(event) =>
                          onUpdateFlashing(row.id, {
                            length: numberValue(
                              event.target.value,
                            ),
                          })
                        }
                      />

                      <input
                        className={numberInputClass}
                        type="number"
                        min="1"
                        step="1"
                        value={row.quantity}
                        onChange={(event) =>
                          onUpdateFlashing(row.id, {
                            quantity: numberValue(
                              event.target.value,
                            ),
                          })
                        }
                      />

                      <div className="flex items-center justify-end text-sm">
                        {money(flashingCost(row))}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onRemoveFlashing(row.id)
                        }
                        className="text-black/35 hover:text-red-600"
                        aria-label="Remove flashing"
                      >
                        ×
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-black/45">
                      <span>
                        Typical girth:{" "}
                        {type?.typicalGirth != null
                          ? `${type.typicalGirth}G`
                          : "—"}
                      </span>

                      <span>
                        Girth band:{" "}
                        {band
                          ? `${band.min_girth}-${band.max_girth}G`
                          : "—"}
                      </span>

                      <span>
                        Rate:{" "}
                        {price != null
                          ? `${money(price)} / m`
                          : "—"}
                      </span>

                      {type && (
                        <span>
                          Unit: {type.unit}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-black/[0.08] pt-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">
                Labour
              </h3>
              <p className="mt-1 text-xs text-black/45">
                Labour rate comes from the catalogue.
              </p>
            </div>

            <button
              type="button"
              onClick={onAddLabour}
              className="rounded-md border border-black/[0.12] px-3 py-2 text-xs hover:bg-black/[0.03]"
            >
              + Add labour
            </button>
          </div>

          {labourRows.length === 0 ? (
            <p className="text-sm text-black/40">
              No labour added.
            </p>
          ) : (
            <div className="space-y-3">
              {labourRows.map((row) => {
                const labour = labourTypes.find(
                  (item) =>
                    item.id === row.labourTypeId,
                );

                return (
                  <div
                    key={row.id}
                    className="grid gap-3 rounded-md border border-black/[0.08] p-3 md:grid-cols-[minmax(0,1fr)_120px_120px_120px_40px]"
                  >
                    <select
                      className={inputClass}
                      value={row.labourTypeId}
                      onChange={(event) =>
                        onUpdateLabour(row.id, {
                          labourTypeId:
                            event.target.value,
                        })
                      }
                    >
                      <option value="">
                        Select labour…
                      </option>

                      {labourTypes.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                        </option>
                      ))}
                    </select>

                    <input
                      className={numberInputClass}
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(event) =>
                        onUpdateLabour(row.id, {
                          quantity: numberValue(
                            event.target.value,
                          ),
                        })
                      }
                    />

                    <input
                      className={numberInputClass}
                      type="number"
                      min="0"
                      step="0.25"
                      value={row.hours}
                      onChange={(event) =>
                        onUpdateLabour(row.id, {
                          hours: numberValue(
                            event.target.value,
                          ),
                        })
                      }
                    />

                    <div className="flex items-center justify-end text-sm">
                      {labour?.rate != null &&
                      row.hours > 0 &&
                      row.quantity > 0
                        ? money(
                            labour.rate *
                              row.hours *
                              row.quantity,
                          )
                        : "—"}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onRemoveLabour(row.id)
                      }
                      className="text-black/35 hover:text-red-600"
                      aria-label="Remove labour"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-black/50">
        {label}
      </span>
      {children}
    </label>
  );
}