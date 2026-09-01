import { supabase } from "./supabase";

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

async function fetchActive<T>(
  table: string,
  mapRow: (row: any) => T,
  filter?: (query: any) => any,
): Promise<T[]> {
  let query = supabase
    .from(table)
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (filter) {
    query = filter(query);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load ${table}: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}

export function getProfiles(section?: string): Promise<Profile[]> {
  return fetchActive<Profile>(
    "profiles",
    (row) => ({
      id: row.id,
      name: row.name,
      section: row.section,
      measurementType: row.measurement_type,
      sortOrder: row.sort_order,
    }),
    section ? (query) => query.eq("section", section) : undefined,
  );
}

export function getProfileOptions(profileId: string): Promise<ProfileOption[]> {
  return fetchActive<ProfileOption>(
    "profile_options",
    (row) => ({
      id: row.id,
      profileId: row.profile_id,
      value: row.value,
      sortOrder: row.sort_order,
    }),
    (query) => query.eq("profile_id", profileId),
  );
}

export function getMaterials(): Promise<Material[]> {
  return fetchActive<Material>("materials", (row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
  }));
}

export function getMaterialColours(materialId: string): Promise<MaterialColour[]> {
  return fetchActive<MaterialColour>(
    "material_colours",
    (row) => ({
      id: row.id,
      materialId: row.material_id,
      name: row.name,
      sortOrder: row.sort_order,
    }),
    (query) => query.eq("material_id", materialId),
  );
}

export function getUnderlays(): Promise<Underlay[]> {
  return fetchActive<Underlay>("underlays", (row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    unitCost: row.unit_cost,
    sortOrder: row.sort_order,
  }));
}

export function getFlashingTypes(): Promise<FlashingType[]> {
  return fetchActive<FlashingType>("flashing_types", (row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    unitCost: row.unit_cost,
    sortOrder: row.sort_order,
  }));
}

export function getLabourTypes(): Promise<LabourType[]> {
  return fetchActive<LabourType>("labour_types", (row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    rate: row.rate,
    sortOrder: row.sort_order,
  }));
}

export function getAccessories(): Promise<Accessory[]> {
  return fetchActive<Accessory>("accessories", (row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    unitCost: row.unit_cost,
    sortOrder: row.sort_order,
  }));
}