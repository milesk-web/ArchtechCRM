/**
 * Pure costing engine types.
 * No React, no Supabase – just data shapes the engine needs.
 */

export type Section = "Roofing" | "Wall Cladding";

export type MeasurementType = "gauge" | "width";

export type Profile = {
  id: string;
  name: string;
  section: Section;
  measurementType: MeasurementType;
  sortOrder: number;
};

export type ProfileOption = {
  id: string;
  profileId: string;
  value: string; // "0.4", "0.55", "250", "450", "193-295", etc.
  sortOrder: number;
};

export type Material = {
  id: string;
  name: string;
  family?: string; // "prepainted" | "architectural" | "copper" | ...
  densityKgPerM2?: number | null;
  sortOrder: number;
};

export type MaterialColour = {
  id: string;
  materialId: string;
  name: string;
  sortOrder: number;
};

export type MaterialRate = {
  id: string;
  materialId: string;
  profileId: string;
  profileOptionId: string | null;
  colourId: string | null;
  unit: "m2" | "lm";
  unitCost: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
};

export type FlashingType = {
  id: string;
  name: string;
  typicalGirthMm: number | null;
  unit: string;
  sortOrder: number;
};

export type FlashingGirthBand = {
  id: string;
  minGirth: number;
  maxGirth: number;
  sortOrder: number;
};

export type FlashingRate = {
  id: string;
  flashingTypeId: string | null; // null = global band rate
  girthBandId: string;
  materialId: string;
  unitCost: number;
};

export type FlashingSurcharge = {
  id: string;
  name: string; // "Soft Edge", "Perforation"
  matchPattern: string; // simple contains match for now
  unitCostPerLm: number;
};

export type Underlay = {
  id: string;
  name: string;
  brand?: string;
  unit: string;
  unitCost: number | null;
  effectiveM2Factor?: number; // e.g. 1.12 wastage
  sortOrder: number;
};

export type LabourRate = {
  id: string;
  name: string;
  section: Section | "Spouting" | null;
  unit: "m2" | "lm" | "hour" | "each";
  baseRate: number;
  sortOrder: number;
};

export type LabourFactor = {
  id: string;
  name: string;
  factorType: "pitch" | "complexity" | "profile";
  matchValue: string;
  /** Multiplier (1.15) or additive dollars – engine decides by factorType */
  multiplier: number;
};

export type Accessory = {
  id: string;
  name: string;
  unit: string;
  unitCost: number | null;
  packQty?: number | null;
  sortOrder: number;
};

export type PricingRule = {
  id: string;
  name: string;
  section: Section | null; // null = global
  ruleType:
    | "material_markup"
    | "labour_markup"
    | "small_job_fee"
    | "measure_fee"
    | "travel_rate_per_hour"
    | "distance_rate_per_km"
    | "meal_allowance"
    | "accommodation_per_week";
  value: number;
};

/** Snapshot of all catalogue data needed by the engine for one calculation */
export type CatalogueSnapshot = {
  profiles: Profile[];
  profileOptions: ProfileOption[];
  materials: Material[];
  colours: MaterialColour[];
  materialRates: MaterialRate[];
  flashingTypes: FlashingType[];
  flashingBands: FlashingGirthBand[];
  flashingRates: FlashingRate[];
  flashingSurcharges: FlashingSurcharge[];
  underlays: Underlay[];
  labourRates: LabourRate[];
  labourFactors: LabourFactor[];
  accessories: Accessory[];
  pricingRules: PricingRule[];
};

// ---------------------------------------------------------------------------
// Input / Output of the pure engine
// ---------------------------------------------------------------------------

export type FlashingInput = {
  id: string; // client-generated UUID for line tracking
  flashingTypeId: string | null;
  customName?: string;
  girthMm: number;
  materialId: string;
  lengthM: number;
  quantity: number;
};

export type ComplexityFlags = {
  valleyLm?: number;
  hipLm?: number;
  rakedLm?: number;
  penetrations?: number;
  skylights?: number;
};

export type SectionInput = {
  areaM2: number;
  linealMetres?: number;
  profileId: string;
  profileOptionId: string;
  materialId: string;
  colourId?: string;
  underlayId?: string;
  pitchDegrees?: number;
  flashings: FlashingInput[];
  complexity?: ComplexityFlags;
};

export type AccessoryInput = {
  id: string;
  accessoryId: string;
  quantity: number;
};

export type JobContext = {
  isSmallJob?: boolean;
  distanceKm?: number;
  measureRequired?: boolean;
  outOfTownDays?: number;
  crewSize?: number;
};

export type QuoteInput = {
  roof?: SectionInput;
  wall?: SectionInput;
  accessories?: AccessoryInput[];
  jobContext?: JobContext;
  margins?: {
    materialRoof?: number;
    labourRoof?: number;
    materialWall?: number;
    labourWall?: number;
  };
};

export type CostLine = {
  id: string;
  section: Section | "Accessories" | "Fees";
  category: "Material" | "Flashing" | "Labour" | "Underlay" | "Accessory" | "Fee";
  description: string;
  quantity: number;
  unit: string;
  unitCost: number | null;
  sellPrice: number | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
};

export type QuoteResult = {
  lines: CostLine[];
  direct: {
    material: number;
    labour: number;
    fees: number;
    total: number;
  };
  sell: {
    material: number;
    labour: number;
    fees: number;
    total: number;
  };
  margins: {
    materialRoof: number;
    labourRoof: number;
    materialWall: number;
    labourWall: number;
  };
  warnings: string[];
  meta: {
    calculatedAt: string;
  };
};
