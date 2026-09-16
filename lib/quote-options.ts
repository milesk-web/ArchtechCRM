/**
 * Catalogue accessors for the quote builder.
 * All reads go through the authenticated /api/catalogue route — no direct
 * browser-side Supabase queries.
 */

export type MeasurementType = "gauge" | "width";

export type Profile = {
  id: string;
  name: string;
  section: string;
  measurementType: MeasurementType;
  sortOrder: number;
};

export type ProfileOption = {
  id: string;
  profileId: string;
  value: string;
  sortOrder: number;
};

export type Material = {
  id: string;
  name: string;
  sortOrder: number;
};

export type MaterialColour = {
  id: string;
  materialId: string;
  name: string;
  sortOrder: number;
};

export type Underlay = {
  id: string;
  name: string;
  unit: string;
  unitCost: number | null;
  sortOrder: number;
};

export type FlashingType = {
  id: string;
  name: string;
  unit: string;
  unitCost: number | null;
  /** Default / typical girth (mm) when the catalogue provides one. */
  typicalGirth: number | null;
  sortOrder: number;
};

export type FlashingGirthBand = {
  id: string;
  /** Optional association; bands may be global or per-type depending on schema. */
  flashingTypeId: string | null;
  minGirth: number;
  maxGirth: number;
  active: boolean;
  sortOrder: number;
};

export type FlashingPrice = {
  id: string;
  flashingGirthBandId: string;
  materialId: string;
  unitCost: number;
  active: boolean;
};

export type MaterialPrice = {
  id: string;
  materialId: string;
  profileId: string;
  profileOptionId: string;
  colourId: string | null;
  unitCost: number;
  active: boolean;
};

export type LabourType = {
  id: string;
  name: string;
  unit: string;
  rate: number | null;
  sortOrder: number;
};

export type Accessory = {
  id: string;
  name: string;
  unit: string;
  unitCost: number | null;
  sortOrder: number;
};

type CatalogueTable =
  | "profiles"
  | "profile_options"
  | "materials"
  | "material_colours"
  | "underlays"
  | "flashing_types"
  | "flashing_girth_bands"
  | "flashing_prices"
  | "labour_types"
  | "accessories"
  | "material_prices";

async function fetchCatalogue<T>(
  table: CatalogueTable,
  mapRow: (row: Record<string, unknown>) => T,
  params?: Record<string, string>,
): Promise<T[]> {
  const search = new URLSearchParams({ table });
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      search.set(key, value);
    }
  }

  const response = await fetch(`/api/catalogue?${search.toString()}`, {
    cache: "no-store",
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.error || `Unable to load ${table} (${response.status}).`,
    );
  }

  return (result?.data ?? []).map((row: Record<string, unknown>) =>
    mapRow(row),
  );
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function getProfiles(section?: string): Promise<Profile[]> {
  return fetchCatalogue<Profile>(
    "profiles",
    (row) => ({
      id: String(row.id),
      name: String(row.name),
      section: String(row.section),
      measurementType: row.measurement_type as MeasurementType,
      sortOrder: Number(row.sort_order ?? 0),
    }),
    section ? { section } : undefined,
  );
}

export function getProfileOptions(profileId: string): Promise<ProfileOption[]> {
  return fetchCatalogue<ProfileOption>(
    "profile_options",
    (row) => ({
      id: String(row.id),
      profileId: String(row.profile_id),
      value: String(row.value),
      sortOrder: Number(row.sort_order ?? 0),
    }),
    { profile_id: profileId },
  );
}

export function getMaterials(): Promise<Material[]> {
  return fetchCatalogue<Material>("materials", (row) => ({
    id: String(row.id),
    name: String(row.name),
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

export function getMaterialColours(materialId: string): Promise<MaterialColour[]> {
  return fetchCatalogue<MaterialColour>(
    "material_colours",
    (row) => ({
      id: String(row.id),
      materialId: String(row.material_id),
      name: String(row.name),
      sortOrder: Number(row.sort_order ?? 0),
    }),
    { material_id: materialId },
  );
}

export function getUnderlays(): Promise<Underlay[]> {
  return fetchCatalogue<Underlay>("underlays", (row) => ({
    id: String(row.id),
    name: String(row.name),
    unit: String(row.unit ?? ""),
    unitCost: num(row.unit_cost),
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

export function getFlashingTypes(): Promise<FlashingType[]> {
  return fetchCatalogue<FlashingType>("flashing_types", (row) => ({
    id: String(row.id),
    name: String(row.name),
    unit: String(row.unit ?? "m"),
    unitCost: num(row.unit_cost),
    // Support either typical_girth or standard_girth column names if present.
    typicalGirth:
      num(row.typical_girth) ??
      num(row.standard_girth) ??
      num(row.typicalGirth) ??
      null,
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

export function getFlashingGirthBands(): Promise<FlashingGirthBand[]> {
  return fetchCatalogue<FlashingGirthBand>("flashing_girth_bands", (row) => ({
    id: String(row.id),
    flashingTypeId:
      row.flashing_type_id == null || row.flashing_type_id === ""
        ? null
        : String(row.flashing_type_id),
    minGirth: Number(row.min_girth),
    maxGirth: Number(row.max_girth),
    active: row.active !== false,
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

export function getFlashingPrices(): Promise<FlashingPrice[]> {
  return fetchCatalogue<FlashingPrice>("flashing_prices", (row) => ({
    id: String(row.id),
    flashingGirthBandId: String(row.flashing_girth_band_id),
    materialId: String(row.material_id),
    unitCost: Number(row.unit_cost),
    active: row.active !== false,
  }));
}

export function getMaterialPrices(): Promise<MaterialPrice[]> {
  return fetchCatalogue<MaterialPrice>("material_prices", (row) => ({
    id: String(row.id),
    materialId: String(row.material_id),
    profileId: String(row.profile_id),
    profileOptionId: String(row.profile_option_id),
    colourId: row.colour_id == null ? null : String(row.colour_id),
    unitCost: Number(row.unit_cost),
    active: row.active !== false,
  }));
}

export function getLabourTypes(): Promise<LabourType[]> {
  return fetchCatalogue<LabourType>("labour_types", (row) => ({
    id: String(row.id),
    name: String(row.name),
    unit: String(row.unit ?? ""),
    rate: num(row.rate),
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

export function getAccessories(): Promise<Accessory[]> {
  return fetchCatalogue<Accessory>("accessories", (row) => ({
    id: String(row.id),
    name: String(row.name),
    unit: String(row.unit ?? ""),
    unitCost: num(row.unit_cost),
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

/**
 * Resolve the applicable girth band for a numeric girth.
 * Prefers the tightest matching band (lowest min_girth among matches).
 * When flashingTypeId is provided and bands are typed, prefers a type-specific
 * match; otherwise falls back to any matching band (global).
 */
export function getFlashingBand(
  girth: number,
  bands: FlashingGirthBand[],
  flashingTypeId?: string | null,
): FlashingGirthBand | null {
  if (!Number.isFinite(girth) || girth <= 0) return null;

  const matches = bands
    .filter(
      (band) =>
        band.active !== false &&
        girth >= band.minGirth &&
        girth <= band.maxGirth,
    )
    .sort((a, b) => a.minGirth - b.minGirth);

  if (matches.length === 0) return null;

  if (flashingTypeId) {
    const typed = matches.find((b) => b.flashingTypeId === flashingTypeId);
    if (typed) return typed;
  }

  // Prefer global bands (null type) when available, else first match.
  const global = matches.find((b) => b.flashingTypeId == null);
  return global ?? matches[0] ?? null;
}

export function resolveFlashingUnitCost(
  band: FlashingGirthBand | null,
  materialId: string,
  prices: FlashingPrice[],
): number | null {
  if (!band || !materialId) return null;
  const price = prices.find(
    (p) =>
      p.active !== false &&
      p.flashingGirthBandId === band.id &&
      p.materialId === materialId,
  );
  return price ? price.unitCost : null;
}

export function resolveMaterialUnitCost(
  scope: {
    profileId: string;
    profileOptionId: string;
    materialId: string;
    colourId: string;
  },
  prices: MaterialPrice[],
): number | null {
  if (!scope.profileId || !scope.profileOptionId || !scope.materialId) {
    return null;
  }

  // Prefer exact colour match, then colour-agnostic (null colour).
  const exact = prices.find(
    (p) =>
      p.active !== false &&
      p.profileId === scope.profileId &&
      p.profileOptionId === scope.profileOptionId &&
      p.materialId === scope.materialId &&
      p.colourId === (scope.colourId || null),
  );
  if (exact) return exact.unitCost;

  const anyColour = prices.find(
    (p) =>
      p.active !== false &&
      p.profileId === scope.profileId &&
      p.profileOptionId === scope.profileOptionId &&
      p.materialId === scope.materialId &&
      p.colourId == null,
  );
  return anyColour ? anyColour.unitCost : null;
}