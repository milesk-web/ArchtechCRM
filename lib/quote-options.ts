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
  typicalGirth: number | null;
  sortOrder: number;
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

async function fetchCatalogue<T>(
  table: string,
  params?: Record<string, string | undefined>,
  mapRow?: (row: any) => T,
): Promise<T[]> {
  const search = new URLSearchParams({ table });

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      search.set(key, value);
    }
  }

  const response = await fetch(`/api/catalogue?${search.toString()}`);

  if (!response.ok) {
    let message = `Unable to load ${table}.`;

    try {
      const body = await response.json();

      if (body?.error) {
        message = body.error;
      }
    } catch {
      // Keep default message.
    }

    throw new Error(message);
  }

  const body = await response.json();
  const rows = Array.isArray(body?.data) ? body.data : [];

  return mapRow
    ? rows.map(mapRow)
    : (rows as T[]);
}

export function getProfiles(
  section?: string,
): Promise<Profile[]> {
  return fetchCatalogue(
    "profiles",
    section ? { section } : undefined,
    (row) => ({
      id: row.id,
      name: row.name,
      section: row.section,
      measurementType: row.measurement_type,
      sortOrder: row.sort_order,
    }),
  );
}

export function getProfileOptions(
  profileId: string,
): Promise<ProfileOption[]> {
  return fetchCatalogue(
    "profile_options",
    {
      profile_id: profileId,
    },
    (row) => ({
      id: row.id,
      profileId: row.profile_id,
      value: row.value,
      sortOrder: row.sort_order,
    }),
  );
}

export function getMaterials(): Promise<Material[]> {
  return fetchCatalogue(
    "materials",
    undefined,
    (row) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order,
    }),
  );
}

export function getMaterialColours(
  materialId: string,
): Promise<MaterialColour[]> {
  return fetchCatalogue(
    "material_colours",
    {
      material_id: materialId,
    },
    (row) => ({
      id: row.id,
      materialId: row.material_id,
      name: row.name,
      sortOrder: row.sort_order,
    }),
  );
}

export function getUnderlays(): Promise<Underlay[]> {
  return fetchCatalogue(
    "underlays",
    undefined,
    (row) => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      unitCost: row.unit_cost,
      sortOrder: row.sort_order,
    }),
  );
}

export function getFlashingTypes(): Promise<FlashingType[]> {
  return fetchCatalogue(
    "flashing_types",
    undefined,
    (row) => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      unitCost: row.unit_cost,
      typicalGirth: row.typical_girth,
      sortOrder: row.sort_order,
    }),
  );
}

export function getLabourTypes(): Promise<LabourType[]> {
  return fetchCatalogue(
    "labour_types",
    undefined,
    (row) => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      rate: row.rate,
      sortOrder: row.sort_order,
    }),
  );
}

export function getAccessories(): Promise<Accessory[]> {
  return fetchCatalogue(
    "accessories",
    undefined,
    (row) => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      unitCost: row.unit_cost,
      sortOrder: row.sort_order,
    }),
  );
}