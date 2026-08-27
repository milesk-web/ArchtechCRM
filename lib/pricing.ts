import { supabase } from "./supabase";

export type ProductFamily = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  active: boolean;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  active: boolean;
};

export type Material = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

export type PricingDimension = {
  id: string;
  name: string;
  description: string | null;
  value_type: string;
  active: boolean;
};

export type PricingOption = {
  id: string;
  dimension_id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export type FamilyDimension = {
  id: string;
  family_id: string;
  dimension_id: string;
  required: boolean;
  sort_order: number;
};

export type FamilyProduct = {
  id: string;
  family_id: string;
  product_id: string;
  active: boolean;
};

export type PricingRule = {
  id: string;
  family_id: string;
  name: string;
  conditions: Record<string, unknown>;
  action: Record<string, unknown>;
  priority: number;
  active: boolean;
};

export type PriceEntry = {
  id: string;
  family_id: string;
  product_id: string | null;
  material_id: string | null;
  selections: Record<string, string>;
  unit: string;
  price: number;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
};

export type CommonFlashing = {
  id: string;
  name: string;
  standard_girth: string;
  description: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function getProductFamilies(): Promise<ProductFamily[]> {
  const { data, error } = await supabase
    .from("product_families")
    .select("*")
    .order("name");

  if (error) {
    throw new Error(`Unable to load product families: ${error.message}`);
  }

  return data ?? [];
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name");

  if (error) {
    throw new Error(`Unable to load products: ${error.message}`);
  }

  return data ?? [];
}

export async function getMaterials(): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .order("name");

  if (error) {
    throw new Error(`Unable to load materials: ${error.message}`);
  }

  return data ?? [];
}

export async function getPricingDimensions(): Promise<PricingDimension[]> {
  const { data, error } = await supabase
    .from("pricing_dimensions")
    .select("*")
    .order("name");

  if (error) {
    throw new Error(`Unable to load pricing dimensions: ${error.message}`);
  }

  return data ?? [];
}

export async function getPricingOptions(): Promise<PricingOption[]> {
  const { data, error } = await supabase
    .from("pricing_options")
    .select("*")
    .order("sort_order")
    .order("name");

  if (error) {
    throw new Error(`Unable to load pricing options: ${error.message}`);
  }

  return data ?? [];
}

export async function getFamilyDimensions(): Promise<FamilyDimension[]> {
  const { data, error } = await supabase
    .from("family_dimensions")
    .select("*")
    .order("sort_order");

  if (error) {
    throw new Error(`Unable to load family dimensions: ${error.message}`);
  }

  return data ?? [];
}

export async function getFamilyProducts(): Promise<FamilyProduct[]> {
  const { data, error } = await supabase
    .from("family_products")
    .select("*")
    .order("created_at");

  if (error) {
    throw new Error(`Unable to load family products: ${error.message}`);
  }

  return data ?? [];
}

export async function getPricingRules(): Promise<PricingRule[]> {
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("*")
    .order("priority")
    .order("name");

  if (error) {
    throw new Error(`Unable to load pricing rules: ${error.message}`);
  }

  return data ?? [];
}

export async function getPriceEntries(): Promise<PriceEntry[]> {
  const { data, error } = await supabase
    .from("price_entries")
    .select("*")
    .order("created_at");

  if (error) {
    throw new Error(`Unable to load price entries: ${error.message}`);
  }

  return data ?? [];
}

export async function getCommonFlashings(): Promise<CommonFlashing[]> {
  const { data, error } = await supabase
    .from("common_flashings")
    .select("*")
    .order("sort_order")
    .order("name");

  if (error) {
    throw new Error(`Unable to load common flashings: ${error.message}`);
  }

  return data ?? [];
}

export async function addProductFamily(
  name: string,
  unit = "each",
  description?: string,
) {
  const { data, error } = await supabase
    .from("product_families")
    .insert({
      name: name.trim(),
      unit,
      description: description?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to add product family: ${error.message}`);
  }

  return data as ProductFamily;
}

export async function addPricingDimension(
  name: string,
  valueType = "option",
  description?: string,
) {
  const { data, error } = await supabase
    .from("pricing_dimensions")
    .insert({
      name: name.trim(),
      value_type: valueType,
      description: description?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to add pricing dimension: ${error.message}`);
  }

  return data as PricingDimension;
}

export async function addPricingOption(
  dimensionId: string,
  name: string,
  sortOrder = 0,
) {
  const { data, error } = await supabase
    .from("pricing_options")
    .insert({
      dimension_id: dimensionId,
      name: name.trim(),
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to add pricing option: ${error.message}`);
  }

  return data as PricingOption;
}

export async function addFamilyDimension(
  familyId: string,
  dimensionId: string,
  required = false,
  sortOrder = 0,
) {
  const { data, error } = await supabase
    .from("family_dimensions")
    .insert({
      family_id: familyId,
      dimension_id: dimensionId,
      required,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to add family dimension: ${error.message}`);
  }

  return data as FamilyDimension;
}

export async function addFamilyProduct(
  familyId: string,
  productId: string,
) {
  const { data, error } = await supabase
    .from("family_products")
    .insert({
      family_id: familyId,
      product_id: productId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to add family product: ${error.message}`);
  }

  return data as FamilyProduct;
}

export async function addPriceEntry(input: {
  familyId: string;
  productId?: string | null;
  materialId?: string | null;
  selections?: Record<string, string>;
  unit: string;
  price: number;
}) {
  const { data, error } = await supabase
    .from("price_entries")
    .insert({
      family_id: input.familyId,
      product_id: input.productId || null,
      material_id: input.materialId || null,
      selections: input.selections ?? {},
      unit: input.unit,
      price: input.price,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to add price entry: ${error.message}`);
  }

  return data as PriceEntry;
}

export async function updatePriceEntry(
  id: string,
  updates: Partial<{
    price: number;
    unit: string;
    selections: Record<string, string>;
    active: boolean;
    effective_from: string;
    effective_to: string | null;
  }>,
) {
  const { error } = await supabase
    .from("price_entries")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Unable to update price entry: ${error.message}`);
  }
}

export async function addCommonFlashing(
  name: string,
  standardGirth: string,
  description?: string,
  sortOrder = 0,
) {
  const { data, error } = await supabase
    .from("common_flashings")
    .insert({
      name: name.trim(),
      standard_girth: standardGirth.trim(),
      description: description?.trim() || null,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to add common flashing: ${error.message}`);
  }

  return data as CommonFlashing;
}

export async function updateCommonFlashing(
  id: string,
  updates: Partial<{
    name: string;
    standard_girth: string;
    description: string | null;
    active: boolean;
    sort_order: number;
  }>,
) {
  const { data, error } = await supabase
    .from("common_flashings")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to update common flashing: ${error.message}`);
  }

  return data as CommonFlashing;
}