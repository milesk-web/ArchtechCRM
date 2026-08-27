"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addCommonFlashing,
  addPricingDimension,
  addPricingOption,
  addProductFamily,
  getCommonFlashings,
  getPricingDimensions,
  getPricingOptions,
  getProductFamilies,
  getProducts,
  updateCommonFlashing,
  type CommonFlashing,
  type PricingDimension,
  type PricingOption,
  type Product,
  type ProductFamily,
} from "@/lib/pricing";

type Tab =
  | "families"
  | "products"
  | "dimensions"
  | "flashings";

export default function PricingPage() {
  const [tab, setTab] = useState<Tab>("families");

  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dimensions, setDimensions] = useState<PricingDimension[]>([]);
  const [options, setOptions] = useState<PricingOption[]>([]);
  const [flashings, setFlashings] = useState<CommonFlashing[]>([]);

  const [selectedFamily, setSelectedFamily] = useState("");
  const [selectedDimension, setSelectedDimension] = useState("");

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("each");
  const [optionName, setOptionName] = useState("");

  const [flashingName, setFlashingName] = useState("");
  const [flashingGirth, setFlashingGirth] = useState("");
  const [flashingDescription, setFlashingDescription] =
    useState("");

  const [editingFlashing, setEditingFlashing] =
    useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editGirth, setEditGirth] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [
        familyData,
        productData,
        dimensionData,
        optionData,
        flashingData,
      ] = await Promise.all([
        getProductFamilies(),
        getProducts(),
        getPricingDimensions(),
        getPricingOptions(),
        getCommonFlashings(),
      ]);

      setFamilies(familyData);
      setProducts(productData);
      setDimensions(dimensionData);
      setOptions(optionData);
      setFlashings(flashingData);

      if (!selectedFamily && familyData.length > 0) {
        setSelectedFamily(familyData[0].id);
      }

      if (!selectedDimension && dimensionData.length > 0) {
        setSelectedDimension(dimensionData[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load pricing configuration.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createFamily() {
    if (!name.trim()) return;

    try {
      const family = await addProductFamily(name.trim(), unit);

      setFamilies((current) =>
        [...current, family].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );

      setSelectedFamily(family.id);
      setName("");
      setUnit("each");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add family.",
      );
    }
  }

  async function createDimension() {
    if (!name.trim()) return;

    try {
      const dimension = await addPricingDimension(name.trim());

      setDimensions((current) =>
        [...current, dimension].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );

      setSelectedDimension(dimension.id);
      setName("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add dimension.",
      );
    }
  }

  async function createOption() {
    if (!selectedDimension || !optionName.trim()) return;

    try {
      const option = await addPricingOption(
        selectedDimension,
        optionName.trim(),
      );

      setOptions((current) =>
        [...current, option].sort(
          (a, b) =>
            a.sort_order - b.sort_order ||
            a.name.localeCompare(b.name),
        ),
      );

      setOptionName("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add option.",
      );
    }
  }

  async function createFlashing() {
    if (!flashingName.trim() || !flashingGirth.trim()) {
      return;
    }

    try {
      const flashing = await addCommonFlashing(
        flashingName.trim(),
        flashingGirth.trim(),
        flashingDescription,
      );

      setFlashings((current) =>
        [...current, flashing].sort(
          (a, b) =>
            a.sort_order - b.sort_order ||
            a.name.localeCompare(b.name),
        ),
      );

      setFlashingName("");
      setFlashingGirth("");
      setFlashingDescription("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add common flashing.",
      );
    }
  }

  function startEditing(flashing: CommonFlashing) {
    setEditingFlashing(flashing.id);
    setEditName(flashing.name);
    setEditGirth(flashing.standard_girth);
  }

  function cancelEditing() {
    setEditingFlashing(null);
    setEditName("");
    setEditGirth("");
  }

  async function saveFlashing(id: string) {
    if (!editName.trim() || !editGirth.trim()) return;

    try {
      const updated = await updateCommonFlashing(id, {
        name: editName.trim(),
        standard_girth: editGirth.trim(),
      });

      setFlashings((current) =>
        current.map((flashing) =>
          flashing.id === id ? updated : flashing,
        ),
      );

      cancelEditing();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update common flashing.",
      );
    }
  }

  async function toggleFlashing(flashing: CommonFlashing) {
    try {
      const updated = await updateCommonFlashing(
        flashing.id,
        {
          active: !flashing.active,
        },
      );

      setFlashings((current) =>
        current.map((item) =>
          item.id === flashing.id ? updated : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update flashing status.",
      );
    }
  }

  const familyProducts = useMemo(() => {
    return products;
  }, [products]);

  const selectedFamilyObject = families.find(
    (family) => family.id === selectedFamily,
  );

  const selectedDimensionObject = dimensions.find(
    (dimension) => dimension.id === selectedDimension,
  );

  const selectedOptions = options.filter(
    (option) =>
      option.dimension_id === selectedDimension,
  );

  return (
    <div className="min-h-screen bg-[#f4f4f1] text-[#242422]">
      <header className="border-b border-black/[0.08] bg-[#fafaf8]">
        <div className="mx-auto max-w-[1180px] px-5 py-6 md:px-9">
          <div className="text-[10px] uppercase tracking-[0.17em] text-black/30">
            Archtech
          </div>

          <h1 className="mt-1 text-[25px] font-medium tracking-[-0.035em]">
            Pricing
          </h1>

          <p className="mt-2 max-w-[600px] text-[11px] leading-5 text-black/40">
            Configure the product and pricing structure used by
            quoting.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-5 py-7 md:px-9">
        <nav className="mb-7 flex flex-wrap gap-x-6 gap-y-3 border-b border-black/[0.08]">
          {[
            ["families", "Families"],
            ["products", "Products"],
            ["dimensions", "Dimensions"],
            ["flashings", "Common Flashings"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value as Tab)}
              className={`border-b-2 pb-3 text-[10px] uppercase tracking-[0.13em] transition ${
                tab === value
                  ? "border-black/60 text-black/65"
                  : "border-transparent text-black/30 hover:text-black/55"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {error && (
          <div className="mb-5 border-l-2 border-red-500/60 bg-red-50 px-3 py-2.5 text-[11px] text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-[11px] text-black/35">
            Loading pricing configuration...
          </div>
        ) : (
          <>
            {tab === "families" && (
              <section>
                <div className="mb-6 rounded-lg border border-black/[0.08] bg-[#fafaf8] p-5">
                  <div className="mb-4 text-[10px] uppercase tracking-[0.13em] text-black/30">
                    Product families
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <input
                      value={name}
                      onChange={(e) =>
                        setName(e.target.value)
                      }
                      placeholder="e.g. Roofing, Wall Cladding, Flashings"
                      className="flex-1 border-b border-black/[0.14] bg-transparent py-2 text-[11px] outline-none placeholder:text-black/25"
                    />

                    <select
                      value={unit}
                      onChange={(e) =>
                        setUnit(e.target.value)
                      }
                      className="border-b border-black/[0.14] bg-transparent py-2 text-[11px] outline-none"
                    >
                      <option value="each">Each</option>
                      <option value="LM">LM</option>
                      <option value="m²">m²</option>
                      <option value="kg">kg</option>
                    </select>

                    <button
                      onClick={createFamily}
                      className="rounded-md bg-[#242422] px-4 py-2 text-[10px] text-white"
                    >
                      + Add family
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-[280px_1fr]">
                  <div className="rounded-lg border border-black/[0.08] bg-[#fafaf8]">
                    <div className="border-b border-black/[0.07] px-5 py-3 text-[9px] uppercase tracking-[0.1em] text-black/25">
                      Families
                    </div>

                    {families.map((family) => (
                      <button
                        key={family.id}
                        onClick={() =>
                          setSelectedFamily(family.id)
                        }
                        className={`flex w-full items-center justify-between border-b border-black/[0.05] px-5 py-4 text-left ${
                          selectedFamily === family.id
                            ? "bg-black/[0.025]"
                            : ""
                        }`}
                      >
                        <span className="text-[12px] text-black/65">
                          {family.name}
                        </span>

                        <span className="text-[9px] uppercase tracking-[0.08em] text-black/25">
                          {family.unit}
                        </span>
                      </button>
                    ))}

                    {families.length === 0 && (
                      <div className="px-5 py-7 text-[11px] text-black/30">
                        No families yet.
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-black/[0.08] bg-[#fafaf8]">
                    <div className="border-b border-black/[0.07] px-5 py-4">
                      <div className="text-[9px] uppercase tracking-[0.1em] text-black/25">
                        Selected family
                      </div>

                      <div className="mt-1 text-[16px] text-black/65">
                        {selectedFamilyObject?.name ??
                          "Select a family"}
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="mb-3 text-[9px] uppercase tracking-[0.1em] text-black/25">
                        Products
                      </div>

                      <div className="space-y-1">
                        {familyProducts.map(
                          (product: Product) => (
                            <div
                              key={product.id}
                              className="flex items-center justify-between border-b border-black/[0.05] py-3"
                            >
                              <span className="text-[11px] text-black/55">
                                {product.name}
                              </span>

                              <span className="text-[9px] text-black/25">
                                {product.category ??
                                  "Uncategorised"}
                              </span>
                            </div>
                          ),
                        )}
                      </div>

                      <div className="mt-5 border-t border-black/[0.07] pt-4 text-[10px] leading-5 text-black/30">
                        Product assignment will be configured
                        here next. This allows the same product
                        library to be shared between Roofing,
                        Wall Cladding and other families.
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {tab === "products" && (
              <section>
                <div className="rounded-lg border border-black/[0.08] bg-[#fafaf8]">
                  <div className="border-b border-black/[0.07] px-5 py-4">
                    <div className="text-[9px] uppercase tracking-[0.1em] text-black/25">
                      Product library
                    </div>

                    <div className="mt-1 text-[11px] text-black/40">
                      Products are shared across quoting families.
                    </div>
                  </div>

                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between border-b border-black/[0.05] px-5 py-4"
                    >
                      <div>
                        <div className="text-[12px] text-black/65">
                          {product.name}
                        </div>

                        {product.description && (
                          <div className="mt-1 text-[10px] text-black/30">
                            {product.description}
                          </div>
                        )}
                      </div>

                      <div className="text-[9px] uppercase tracking-[0.1em] text-black/25">
                        {product.category ??
                          "Uncategorised"}
                      </div>
                    </div>
                  ))}

                  {products.length === 0 && (
                    <div className="px-5 py-8 text-[11px] text-black/30">
                      No products yet.
                    </div>
                  )}
                </div>
              </section>
            )}

            {tab === "dimensions" && (
              <section>
                <div className="mb-6 rounded-lg border border-black/[0.08] bg-[#fafaf8] p-5">
                  <div className="mb-4 text-[10px] uppercase tracking-[0.13em] text-black/30">
                    Pricing dimensions
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <input
                      value={name}
                      onChange={(e) =>
                        setName(e.target.value)
                      }
                      placeholder="e.g. Material, Thickness, Width, Girth"
                      className="flex-1 border-b border-black/[0.14] bg-transparent py-2 text-[11px] outline-none placeholder:text-black/25"
                    />

                    <button
                      onClick={createDimension}
                      className="rounded-md bg-[#242422] px-4 py-2 text-[10px] text-white"
                    >
                      + Add dimension
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-[280px_1fr]">
                  <div className="rounded-lg border border-black/[0.08] bg-[#fafaf8]">
                    <div className="border-b border-black/[0.07] px-5 py-3 text-[9px] uppercase tracking-[0.1em] text-black/25">
                      Dimensions
                    </div>

                    {dimensions.map((dimension) => (
                      <button
                        key={dimension.id}
                        onClick={() =>
                          setSelectedDimension(
                            dimension.id,
                          )
                        }
                        className={`flex w-full items-center justify-between border-b border-black/[0.05] px-5 py-4 text-left ${
                          selectedDimension ===
                          dimension.id
                            ? "bg-black/[0.025]"
                            : ""
                        }`}
                      >
                        <span className="text-[12px] text-black/60">
                          {dimension.name}
                        </span>

                        <span className="text-[9px] text-black/25">
                          {
                            options.filter(
                              (option) =>
                                option.dimension_id ===
                                dimension.id,
                            ).length
                          }
                        </span>
                      </button>
                    ))}

                    {dimensions.length === 0 && (
                      <div className="px-5 py-7 text-[11px] text-black/30">
                        No dimensions yet.
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-black/[0.08] bg-[#fafaf8]">
                    <div className="border-b border-black/[0.07] px-5 py-4">
                      <div className="text-[9px] uppercase tracking-[0.1em] text-black/25">
                        Dimension options
                      </div>

                      <div className="mt-1 text-[15px] text-black/65">
                        {selectedDimensionObject?.name ??
                          "Select a dimension"}
                      </div>
                    </div>

                    {selectedDimension && (
                      <div className="border-b border-black/[0.06] p-5">
                        <div className="flex gap-3">
                          <input
                            value={optionName}
                            onChange={(e) =>
                              setOptionName(
                                e.target.value,
                              )
                            }
                            placeholder="Add option"
                            className="flex-1 border-b border-black/[0.14] bg-transparent py-2 text-[11px] outline-none placeholder:text-black/25"
                          />

                          <button
                            onClick={createOption}
                            className="rounded-md bg-[#242422] px-3 py-2 text-[10px] text-white"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedOptions.map((option) => (
                      <div
                        key={option.id}
                        className="flex items-center justify-between border-b border-black/[0.05] px-5 py-4"
                      >
                        <span className="text-[11px] text-black/55">
                          {option.name}
                        </span>

                        <span className="text-[9px] text-black/20">
                          {option.active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>
                    ))}

                    {selectedDimension &&
                      selectedOptions.length === 0 && (
                        <div className="px-5 py-8 text-[11px] text-black/30">
                          No options yet.
                        </div>
                      )}
                  </div>
                </div>
              </section>
            )}

            {tab === "flashings" && (
              <section>
                <div className="mb-6">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.13em] text-black/30">
                    Common flashings
                  </div>

                  <p className="max-w-[700px] text-[11px] leading-5 text-black/40">
                    These are the standard flashing types available
                    to estimators. The standard girth is only the
                    default. It can be overridden on an individual
                    quote when the measured girth is different.
                  </p>
                </div>

                <div className="mb-6 rounded-lg border border-black/[0.08] bg-[#fafaf8] p-5">
                  <div className="mb-4 text-[10px] uppercase tracking-[0.13em] text-black/30">
                    Add common flashing
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1.3fr_1fr_1.5fr_auto]">
                    <input
                      value={flashingName}
                      onChange={(e) =>
                        setFlashingName(e.target.value)
                      }
                      placeholder="Flashing name"
                      className="border-b border-black/[0.14] bg-transparent py-2 text-[11px] outline-none placeholder:text-black/25"
                    />

                    <input
                      value={flashingGirth}
                      onChange={(e) =>
                        setFlashingGirth(e.target.value)
                      }
                      placeholder="Standard girth e.g. 401-450"
                      className="border-b border-black/[0.14] bg-transparent py-2 text-[11px] outline-none placeholder:text-black/25"
                    />

                    <input
                      value={flashingDescription}
                      onChange={(e) =>
                        setFlashingDescription(
                          e.target.value,
                        )
                      }
                      placeholder="Description (optional)"
                      className="border-b border-black/[0.14] bg-transparent py-2 text-[11px] outline-none placeholder:text-black/25"
                    />

                    <button
                      onClick={createFlashing}
                      className="rounded-md bg-[#242422] px-4 py-2 text-[10px] text-white"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-black/[0.08] bg-[#fafaf8]">
                  <div className="grid grid-cols-[1.5fr_1fr_120px] border-b border-black/[0.07] px-5 py-3 text-[9px] uppercase tracking-[0.1em] text-black/25">
                    <span>Flashing</span>
                    <span>Standard girth</span>
                    <span>Status</span>
                  </div>

                  {flashings.map((flashing) => (
                    <div
                      key={flashing.id}
                      className="border-b border-black/[0.05]"
                    >
                      {editingFlashing === flashing.id ? (
                        <div className="grid gap-3 px-5 py-4 md:grid-cols-[1.5fr_1fr_auto_auto]">
                          <input
                            value={editName}
                            onChange={(e) =>
                              setEditName(e.target.value)
                            }
                            className="border-b border-black/[0.14] bg-transparent py-2 text-[11px] outline-none"
                          />

                          <input
                            value={editGirth}
                            onChange={(e) =>
                              setEditGirth(e.target.value)
                            }
                            className="border-b border-black/[0.14] bg-transparent py-2 text-[11px] outline-none"
                          />

                          <button
                            onClick={() =>
                              saveFlashing(flashing.id)
                            }
                            className="rounded-md bg-[#242422] px-3 py-2 text-[10px] text-white"
                          >
                            Save
                          </button>

                          <button
                            onClick={cancelEditing}
                            className="rounded-md border border-black/[0.1] px-3 py-2 text-[10px] text-black/50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-[1.5fr_1fr_120px] items-center px-5 py-4">
                          <button
                            onClick={() =>
                              startEditing(flashing)
                            }
                            className="text-left text-[11px] text-black/60 hover:text-black/80"
                          >
                            {flashing.name}
                          </button>

                          <button
                            onClick={() =>
                              startEditing(flashing)
                            }
                            className="text-left font-mono text-[11px] text-black/50"
                          >
                            {flashing.standard_girth}
                          </button>

                          <button
                            onClick={() =>
                              toggleFlashing(flashing)
                            }
                            className={`text-left text-[9px] uppercase tracking-[0.1em] ${
                              flashing.active
                                ? "text-black/35"
                                : "text-black/20"
                            }`}
                          >
                            {flashing.active
                              ? "Active"
                              : "Inactive"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {flashings.length === 0 && (
                    <div className="px-5 py-8 text-[11px] text-black/30">
                      No common flashings yet.
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-lg border border-black/[0.06] bg-black/[0.015] px-5 py-4 text-[10px] leading-5 text-black/35">
                  <strong className="font-medium text-black/50">
                    Important:
                  </strong>{" "}
                  the standard girth here is not the price. It is
                  the default girth presented when this flashing is
                  selected during quoting. The quote will use the
                  actual selected/overridden girth when resolving
                  the material price.
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}