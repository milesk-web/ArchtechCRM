"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
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

type Tab =
  | "profiles"
  | "materials"
  | "underlays"
  | "flashings"
  | "labour"
  | "accessories"
  | "pricing";

type CatalogueTable =
  | "profiles"
  | "profile_options"
  | "materials"
  | "material_colours"
  | "underlays"
  | "flashing_types"
  | "labour_types"
  | "accessories"
  | "material_prices";

type MaterialPrice = {
  id: string;
  materialId: string;
  profileId: string;
  profileOptionId: string;
  colourId: string | null;
  unitCost: number;
  active: boolean;
};

const tabs: { id: Tab; label: string }[] = [
  { id: "profiles", label: "Profiles" },
  { id: "materials", label: "Materials" },
  { id: "underlays", label: "Underlays" },
  { id: "flashings", label: "Flashings" },
  { id: "labour", label: "Labour" },
  { id: "accessories", label: "Accessories" },
  { id: "pricing", label: "Pricing" },
];

const inputClass =
  "w-full rounded-md border border-black/[0.09] bg-white px-3 py-2 text-[11px] text-black/60 outline-none focus:border-black/25";

export default function CataloguePage() {
  const [tab, setTab] = useState<Tab>("profiles");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileOptions, setProfileOptions] = useState<ProfileOption[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialColours, setMaterialColours] = useState<MaterialColour[]>(
    [],
  );
  const [underlays, setUnderlays] = useState<Underlay[]>([]);
  const [flashings, setFlashings] = useState<FlashingType[]>([]);
  const [labour, setLabour] = useState<LabourType[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [prices, setPrices] = useState<MaterialPrice[]>([]);

  const [selectedProfile, setSelectedProfile] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("");

  const [profileName, setProfileName] = useState("");
  const [profileSection, setProfileSection] = useState("roofing");
  const [profileMeasurement, setProfileMeasurement] =
    useState<"gauge" | "width">("gauge");
  const [profileOption, setProfileOption] = useState("");

  const [materialName, setMaterialName] = useState("");
  const [colourName, setColourName] = useState("");

  const [itemName, setItemName] = useState("");
  const [itemUnit, setItemUnit] = useState("");
  const [itemCost, setItemCost] = useState("");

  const [pricingMaterial, setPricingMaterial] = useState("");
  const [pricingProfile, setPricingProfile] = useState("");
  const [pricingOption, setPricingOption] = useState("");
  const [pricingColour, setPricingColour] = useState("");
  const [pricingCost, setPricingCost] = useState("");

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selectedProfile) {
      void loadProfileOptions(selectedProfile);
    } else {
      setProfileOptions([]);
    }
  }, [selectedProfile]);

  useEffect(() => {
    if (selectedMaterial) {
      void loadMaterialColours(selectedMaterial);
    } else {
      setMaterialColours([]);
    }
  }, [selectedMaterial]);

  useEffect(() => {
    if (pricingProfile) {
      void loadPricingOptions(pricingProfile);
    } else {
      setPricingOptions([]);
      setPricingOption("");
    }
  }, [pricingProfile]);

  useEffect(() => {
    if (pricingMaterial) {
      void loadPricingColours(pricingMaterial);
    } else {
      setPricingColours([]);
      setPricingColour("");
    }
  }, [pricingMaterial]);

  const [pricingOptions, setPricingOptions] = useState<ProfileOption[]>([]);
  const [pricingColours, setPricingColours] = useState<MaterialColour[]>([]);

  const pricingProfiles = useMemo(() => {
    if (!pricingMaterial) return profiles;

    const materialPriceProfileIds = new Set(
      prices
        .filter((price) => price.materialId === pricingMaterial)
        .map((price) => price.profileId),
    );

    if (materialPriceProfileIds.size === 0) {
      return profiles;
    }

    return profiles.filter((profile) =>
      materialPriceProfileIds.has(profile.id),
    );
  }, [pricingMaterial, prices, profiles]);

  const selectedPricingProfile = profiles.find(
    (profile) => profile.id === pricingProfile,
  );

  const materialNeedsColour =
    pricingMaterial === "" ? false : pricingColours.length > 0;

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [
        profilesResult,
        materialsResult,
        underlaysResult,
        flashingsResult,
        labourResult,
        accessoriesResult,
        pricesResult,
      ] = await Promise.allSettled([
        getProfiles(),
        getMaterials(),
        getUnderlays(),
        getFlashingTypes(),
        getLabourTypes(),
        getAccessories(),
        loadPrices(),
      ]);

      const errors: string[] = [];

      if (profilesResult.status === "fulfilled") {
        setProfiles(profilesResult.value);
        if (!selectedProfile && profilesResult.value.length > 0) {
          setSelectedProfile(profilesResult.value[0].id);
        }
      } else {
        errors.push(`Profiles: ${profilesResult.reason?.message || "Failed to load"}`);
      }

      if (materialsResult.status === "fulfilled") {
        setMaterials(materialsResult.value);
        if (!selectedMaterial && materialsResult.value.length > 0) {
          setSelectedMaterial(materialsResult.value[0].id);
        }
        if (!pricingMaterial && materialsResult.value.length > 0) {
          setPricingMaterial(materialsResult.value[0].id);
        }
      } else {
        errors.push(`Materials: ${materialsResult.reason?.message || "Failed to load"}`);
      }

      if (underlaysResult.status === "fulfilled") {
        setUnderlays(underlaysResult.value);
      } else {
        errors.push(`Underlays: ${underlaysResult.reason?.message || "Failed to load"}`);
      }

      if (flashingsResult.status === "fulfilled") {
        setFlashings(flashingsResult.value);
      } else {
        errors.push(`Flashings: ${flashingsResult.reason?.message || "Failed to load"}`);
      }

      if (labourResult.status === "fulfilled") {
        setLabour(labourResult.value);
      } else {
        errors.push(`Labour: ${labourResult.reason?.message || "Failed to load"}`);
      }

      if (accessoriesResult.status === "fulfilled") {
        setAccessories(accessoriesResult.value);
      } else {
        errors.push(`Accessories: ${accessoriesResult.reason?.message || "Failed to load"}`);
      }

      if (pricesResult.status === "fulfilled") {
        setPrices(pricesResult.value);
      } else {
        errors.push(`Material Prices: ${pricesResult.reason?.message || "Failed to load"}`);
      }

      if (errors.length > 0) {
        setError(errors.join(" | "));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load catalogue.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPrices(): Promise<MaterialPrice[]> {
    const { data: sessionData } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};

    if (sessionData?.session?.access_token) {
      headers["Authorization"] = `Bearer ${sessionData.session.access_token}`;
    }

    const response = await fetch("/api/catalogue?table=material_prices", {
      cache: "no-store",
      headers,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.error ||
          `Unable to load material prices (${response.status}).`,
      );
    }

    return (result?.data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      materialId: String(row.material_id),
      profileId: String(row.profile_id),
      profileOptionId: String(row.profile_option_id),
      colourId: row.colour_id ? String(row.colour_id) : null,
      unitCost: Number(row.unit_cost),
      active: Boolean(row.active),
    }));
  }

  async function loadProfileOptions(profileId: string) {
    try {
      setProfileOptions(await getProfileOptions(profileId));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load profile options.",
      );
    }
  }

  async function loadMaterialColours(materialId: string) {
    try {
      setMaterialColours(await getMaterialColours(materialId));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load material colours.",
      );
    }
  }

  async function loadPricingOptions(profileId: string) {
    try {
      setPricingOptions(await getProfileOptions(profileId));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load pricing options.",
      );
    }
  }

  async function loadPricingColours(materialId: string) {
    try {
      setPricingColours(await getMaterialColours(materialId));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load pricing colours.",
      );
    }
  }

  async function createCatalogueItem(
    table: CatalogueTable,
    data: Record<string, unknown>,
  ): Promise<boolean> {
    setError("");
    setNotice("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (sessionData?.session?.access_token) {
        headers["Authorization"] = `Bearer ${sessionData.session.access_token}`;
      }

      const response = await fetch("/api/catalogue", {
        method: "POST",
        headers,
        body: JSON.stringify({
          table,
          data,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          `CATALOGUE API ERROR ${response.status}: ${
            result?.error || "No error message returned."
          }`,
        );
        return false;
      }

      setNotice("Created successfully.");
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create catalogue item.",
      );
      return false;
    }
  }

  async function deleteCatalogueItem(
    table: CatalogueTable,
    id: string,
  ): Promise<boolean> {
    setError("");
    setNotice("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (sessionData?.session?.access_token) {
        headers["Authorization"] = `Bearer ${sessionData.session.access_token}`;
      }

      const response = await fetch("/api/catalogue", {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          table,
          id,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          result?.error ||
            `Unable to delete catalogue item (${response.status}).`,
        );
        return false;
      }

      setNotice("Deleted successfully.");
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete catalogue item.",
      );
      return false;
    }
  }

  async function addProfile() {
    if (!profileName.trim()) {
      setError("Enter a profile name.");
      return;
    }

    const created = await createCatalogueItem("profiles", {
      name: profileName.trim(),
      section: profileSection,
      measurement_type: profileMeasurement,
      sort_order: profiles.length,
      active: true,
    });

    if (!created) return;

    setProfileName("");
    await load();
  }

  async function addProfileOption() {
    if (!selectedProfile || !profileOption.trim()) {
      setError("Select a profile and enter a value.");
      return;
    }

    const created = await createCatalogueItem("profile_options", {
      profile_id: selectedProfile,
      value: profileOption.trim(),
      sort_order: profileOptions.length,
      active: true,
    });

    if (!created) return;

    setProfileOption("");
    await loadProfileOptions(selectedProfile);
  }

  async function addMaterial() {
    if (!materialName.trim()) {
      setError("Enter a material name.");
      return;
    }

    const created = await createCatalogueItem("materials", {
      name: materialName.trim(),
      sort_order: materials.length,
      active: true,
    });

    if (!created) return;

    setMaterialName("");
    await load();
  }

  async function addColour() {
    if (!selectedMaterial || !colourName.trim()) {
      setError("Select a material and enter a colour.");
      return;
    }

    const created = await createCatalogueItem("material_colours", {
      material_id: selectedMaterial,
      name: colourName.trim(),
      sort_order: materialColours.length,
      active: true,
    });

    if (!created) return;

    setColourName("");
    await loadMaterialColours(selectedMaterial);
  }

  async function addSimpleItem() {
    if (!itemName.trim()) {
      setError("Enter an item name.");
      return;
    }

    const sortOrder =
      tab === "underlays"
        ? underlays.length
        : tab === "flashings"
          ? flashings.length
          : tab === "labour"
            ? labour.length
            : accessories.length;

    const numericCost =
      itemCost.trim() === "" ? null : Number(itemCost.trim());

    if (numericCost !== null && Number.isNaN(numericCost)) {
      setError("Cost must be a number.");
      return;
    }

    const table =
      tab === "underlays"
        ? "underlays"
        : tab === "flashings"
          ? "flashing_types"
          : tab === "labour"
            ? "labour_types"
            : "accessories";

    const data =
      tab === "labour"
        ? {
            name: itemName.trim(),
            unit: itemUnit.trim(),
            rate: numericCost,
            sort_order: sortOrder,
            active: true,
          }
        : {
            name: itemName.trim(),
            unit: itemUnit.trim(),
            unit_cost: numericCost,
            sort_order: sortOrder,
            active: true,
          };

    const created = await createCatalogueItem(table, data);

    if (!created) return;

    setItemName("");
    setItemUnit("");
    setItemCost("");

    await load();
  }

  async function addPrice() {
    if (!pricingMaterial) {
      setError("Select a material.");
      return;
    }

    if (!pricingProfile) {
      setError("Select a profile.");
      return;
    }

    if (!pricingOption) {
      setError("Select a gauge or width.");
      return;
    }

    if (pricingCost.trim() === "") {
      setError("Enter a unit cost.");
      return;
    }

    const cost = Number(pricingCost);

    if (Number.isNaN(cost)) {
      setError("Unit cost must be a number.");
      return;
    }

    if (materialNeedsColour && !pricingColour) {
      setError(
        "This material has colours in the catalogue. Select a colour when entering its price.",
      );
      return;
    }

    const existing = prices.find(
      (price) =>
        price.materialId === pricingMaterial &&
        price.profileId === pricingProfile &&
        price.profileOptionId === pricingOption &&
        price.colourId === (pricingColour || null),
    );

    if (existing) {
      setError(
        "A price already exists for this material, profile, gauge/width and colour combination.",
      );
      return;
    }

    const created = await createCatalogueItem("material_prices", {
      material_id: pricingMaterial,
      profile_id: pricingProfile,
      profile_option_id: pricingOption,
      colour_id: pricingColour || null,
      unit_cost: cost,
      active: true,
    });

    if (!created) return;

    setPricingCost("");

    const refreshed = await loadPrices();
    setPrices(refreshed);
  }

  async function deleteItem(table: CatalogueTable, id: string): Promise<boolean> {
    if (!window.confirm("Delete this item?")) return false;

    const deleted = await deleteCatalogueItem(table, id);

    if (!deleted) return false;

    await load();

    if (selectedProfile) {
      await loadProfileOptions(selectedProfile);
    }

    if (selectedMaterial) {
      await loadMaterialColours(selectedMaterial);
    }

    if (pricingProfile) {
      await loadPricingOptions(pricingProfile);
    }

    if (pricingMaterial) {
      await loadPricingColours(pricingMaterial);
    }
    return true;
  }

  function priceLabel(price: MaterialPrice) {
    const material = materials.find((item) => item.id === price.materialId);
    const profile = profiles.find((item) => item.id === price.profileId);
    const option = profileOptionsForPrice(price);
    const colour = price.colourId
      ? materialColoursForPrice(price).find(
          (item) => item.id === price.colourId,
        )
      : null;

    return {
      material: material?.name || "Unknown material",
      profile: profile?.name || "Unknown profile",
      option: option?.value || "Unknown",
      colour: colour?.name || null,
    };
  }

  function profileOptionsForPrice(price: MaterialPrice) {
    const profile = profiles.find((item) => item.id === price.profileId);

    if (!profile) return undefined;

    return allProfileOptions.find(
      (item) => item.id === price.profileOptionId,
    );
  }

  function materialColoursForPrice(price: MaterialPrice) {
    return allMaterialColours.filter(
      (item) => item.materialId === price.materialId,
    );
  }

  const allProfileOptions = profileOptions;
  const allMaterialColours = materialColours;

  return (
    <main className="min-h-screen bg-[#f4f4f1] text-[#242422]">
      <div className="mx-auto max-w-[1200px] px-6 py-8">
        <div className="mb-8">
          <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-black/25">
            Archtech CRM
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-medium tracking-[-0.04em]">
                Catalogue
              </h1>

              <p className="mt-1 text-[11px] text-black/40">
                Products, profiles and rates used when building quotes.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              className="rounded-md border border-black/[0.09] bg-white px-3 py-2 text-[10px] text-black/50 hover:bg-black/[0.025]"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">
            {error}
          </div>
        )}

        {notice && !error && (
          <div className="mb-5 rounded-md border border-black/[0.08] bg-white px-4 py-3 text-[11px] text-black/50">
            {notice}
          </div>
        )}

        <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-black/[0.08] bg-[#fafaf8] p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setError("");
                setNotice("");
              }}
              className={
                tab === item.id
                  ? "rounded-md bg-[#242422] px-4 py-2 text-[10px] text-white"
                  : "rounded-md px-4 py-2 text-[10px] text-black/40 hover:bg-black/[0.03]"
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-lg border border-black/[0.08] bg-[#fafaf8] p-8 text-[11px] text-black/35">
            Loading catalogue...
          </div>
        ) : (
          <>
            {tab === "profiles" && (
              <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
                <Panel
                  title="Profiles"
                  action={
                    <button
                      type="button"
                      onClick={() => void addProfile()}
                      className="rounded-md bg-[#242422] px-3 py-2 text-[10px] text-white"
                    >
                      Add profile
                    </button>
                  }
                >
                  <div className="mb-5 grid gap-3 sm:grid-cols-3">
                    <Input
                      label="Name"
                      value={profileName}
                      onChange={setProfileName}
                      placeholder="Corrugated"
                    />

                    <Select
                      label="Section"
                      value={profileSection}
                      onChange={setProfileSection}
                      options={[
                        ["roofing", "Roofing"],
                        ["wall_cladding", "Wall Cladding"],
                      ]}
                    />

                    <Select
                      label="Measurement"
                      value={profileMeasurement}
                      onChange={(value) =>
                        setProfileMeasurement(value as "gauge" | "width")
                      }
                      options={[
                        ["gauge", "Gauge"],
                        ["width", "Width"],
                      ]}
                    />
                  </div>

                  {profiles.length === 0 ? (
                    <Empty text="No profiles yet." />
                  ) : (
                    <div className="divide-y divide-black/[0.06]">
                      {profiles.map((profile) => (
                        <div
                          key={profile.id}
                          className="flex items-center justify-between gap-4 py-3"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedProfile(profile.id)}
                            className="flex-1 text-left"
                          >
                            <div className="text-[11px] text-black/65">
                              {profile.name}
                            </div>

                            <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-black/25">
                              {profile.section} Â·{" "}
                              {profile.measurementType === "gauge"
                                ? "Gauge"
                                : "Width"}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void deleteItem("profiles", profile.id)
                            }
                            className="text-[10px] text-black/20 hover:text-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel
                  title={
                    profiles.find((item) => item.id === selectedProfile)
                      ?.measurementType === "width"
                      ? "Widths"
                      : "Gauges"
                  }
                >
                  {!selectedProfile ? (
                    <Empty text="Select a profile." />
                  ) : (
                    <>
                      <div className="mb-4 flex gap-2">
                        <input
                          value={profileOption}
                          onChange={(event) =>
                            setProfileOption(event.target.value)
                          }
                          placeholder={
                            profiles.find(
                              (item) => item.id === selectedProfile,
                            )?.measurementType === "width"
                              ? "e.g. 450"
                              : "e.g. 0.55"
                          }
                          className={inputClass}
                        />

                        <button
                          type="button"
                          onClick={() => void addProfileOption()}
                          className="rounded-md bg-[#242422] px-3 py-2 text-[10px] text-white"
                        >
                          Add
                        </button>
                      </div>

                      {profileOptions.length === 0 ? (
                        <Empty text="No options yet." />
                      ) : (
                        <div className="space-y-2">
                          {profileOptions.map((option) => (
                            <div
                              key={option.id}
                              className="flex items-center justify-between rounded-md border border-black/[0.06] bg-white px-3 py-2 font-mono text-[11px] text-black/55"
                            >
                              <span>{option.value}</span>

                              <button
                                type="button"
                                onClick={() =>
                                  void deleteItem(
                                    "profile_options",
                                    option.id,
                                  )
                                }
                                className="text-[10px] text-black/20 hover:text-red-500"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </Panel>
              </div>
            )}

            {tab === "materials" && (
              <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
                <Panel
                  title="Materials"
                  action={
                    <button
                      type="button"
                      onClick={() => void addMaterial()}
                      className="rounded-md bg-[#242422] px-3 py-2 text-[10px] text-white"
                    >
                      Add material
                    </button>
                  }
                >
                  <div className="mb-5">
                    <Input
                      label="Name"
                      value={materialName}
                      onChange={setMaterialName}
                      placeholder="KiwiColour Vitor+"
                    />
                  </div>

                  {materials.length === 0 ? (
                    <Empty text="No materials yet." />
                  ) : (
                    <div className="divide-y divide-black/[0.06]">
                      {materials.map((material) => (
                        <div
                          key={material.id}
                          className="flex items-center justify-between gap-4 py-3"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedMaterial(material.id)}
                            className="flex-1 text-left text-[11px] text-black/65"
                          >
                            {material.name}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void deleteItem("materials", material.id)
                            }
                            className="text-[10px] text-black/20 hover:text-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="Colours">
                  {!selectedMaterial ? (
                    <Empty text="Select a material." />
                  ) : (
                    <>
                      <div className="mb-4 flex gap-2">
                        <input
                          value={colourName}
                          onChange={(event) =>
                            setColourName(event.target.value)
                          }
                          placeholder="FlaxPod"
                          className={inputClass}
                        />

                        <button
                          type="button"
                          onClick={() => void addColour()}
                          className="rounded-md bg-[#242422] px-3 py-2 text-[10px] text-white"
                        >
                          Add
                        </button>
                      </div>

                      {materialColours.length === 0 ? (
                        <Empty text="No colours yet." />
                      ) : (
                        <div className="space-y-2">
                          {materialColours.map((colour) => (
                            <div
                              key={colour.id}
                              className="flex items-center justify-between rounded-md border border-black/[0.06] bg-white px-3 py-2 text-[11px] text-black/55"
                            >
                              <span>{colour.name}</span>

                              <button
                                type="button"
                                onClick={() =>
                                  void deleteItem(
                                    "material_colours",
                                    colour.id,
                                  )
                                }
                                className="text-[10px] text-black/20 hover:text-red-500"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </Panel>
              </div>
            )}

            {tab === "pricing" && (
              <div className="space-y-5">
                <Panel title="Material pricing">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Select
                      label="Material"
                      value={pricingMaterial}
                      onChange={(value) => {
                        setPricingMaterial(value);
                        setPricingProfile("");
                        setPricingOption("");
                        setPricingColour("");
                      }}
                      options={[
                        ["", "Select material"],
                        ...materials.map((material) => [material.id, material.name] as [string, string]),
                      ]}
                    />

                    <Select
                      label="Profile"
                      value={pricingProfile}
                      onChange={(value) => {
                        setPricingProfile(value);
                        setPricingOption("");
                      }}
                      options={[
                        ["", "Select profile"],
                        ...pricingProfiles.map((profile) => [profile.id, profile.name] as [string, string]),
                      ]}
                    />

                    <Select
                      label={
                        selectedPricingProfile?.measurementType === "width"
                          ? "Width"
                          : "Gauge"
                      }
                      value={pricingOption}
                      onChange={setPricingOption}
                      options={[
                        ["", "Select value"],
                        ...pricingOptions.map((option) => [option.id, option.value] as [string, string]),
                      ]}
                    />

                    <Input
                      label="Unit cost / mÂ²"
                      value={pricingCost}
                      onChange={setPricingCost}
                      placeholder="e.g. 18.50"
                    />
                  </div>

                  {materialNeedsColour && (
                    <div className="mt-4 max-w-[280px]">
                      <Select
                        label="Colour"
                        value={pricingColour}
                        onChange={setPricingColour}
                        options={[
                          ["", "Select colour"],
                          ...pricingColours.map((colour) => [colour.id, colour.name] as [string, string]),
                        ]}
                      />

                      <p className="mt-2 text-[9px] leading-4 text-black/30">
                        This material has colour entries, so pricing can be
                        recorded against a specific colour.
                      </p>
                    </div>
                  )}

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void addPrice()}
                      className="rounded-md bg-[#242422] px-4 py-2 text-[10px] text-white"
                    >
                      Add price
                    </button>
                  </div>
                </Panel>

                <Panel title="Current pricing matrix">
                  {prices.length === 0 ? (
                    <Empty text="No material pricing has been entered yet." />
                  ) : (
                    <div className="divide-y divide-black/[0.06]">
                      {prices.map((price) => {
                        const label = priceLabel(price);

                        return (
                          <div
                            key={price.id}
                            className="grid gap-3 py-3 md:grid-cols-[1.2fr_1fr_100px_140px_100px]"
                          >
                            <div>
                              <div className="text-[11px] text-black/65">
                                {label.material}
                              </div>
                              <div className="mt-1 text-[9px] text-black/25">
                                Material
                              </div>
                            </div>

                            <div>
                              <div className="text-[11px] text-black/55">
                                {label.profile}
                              </div>
                              <div className="mt-1 text-[9px] text-black/25">
                                {label.option}
                              </div>
                            </div>

                            <div className="text-[11px] text-black/50">
                              {label.colour || "All colours"}
                            </div>

                            <div className="font-mono text-right text-[11px] text-black/55">
                              {new Intl.NumberFormat("en-NZ", {
                                style: "currency",
                                currency: "NZD",
                              }).format(price.unitCost)}
                              <span className="ml-1 text-[9px] text-black/25">
                                / mÂ²
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                void deleteItem(
                                  "material_prices",
                                  price.id,
                                )
                              }
                              className="text-right text-[10px] text-black/20 hover:text-red-500"
                            >
                              Delete
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Panel>
              </div>
            )}

            {tab !== "profiles" &&
              tab !== "materials" &&
              tab !== "pricing" && (
                <SimplePanel
                  tab={tab}
                  underlays={underlays}
                  flashings={flashings}
                  labour={labour}
                  accessories={accessories}
                  itemName={itemName}
                  setItemName={setItemName}
                  itemUnit={itemUnit}
                  setItemUnit={setItemUnit}
                  itemCost={itemCost}
                  setItemCost={setItemCost}
                  addItem={addSimpleItem}
                  deleteItem={deleteItem}
                />
              )}
          </>
        )}
      </div>
    </main>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-black/[0.08] bg-[#fafaf8]">
      <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3">
        <h2 className="text-[10px] uppercase tracking-[0.14em] text-black/30">
          {title}
        </h2>

        {action}
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-[9px] uppercase tracking-[0.12em] text-black/25">
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputClass + " mt-1"}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label className="block">
      <span className="text-[9px] uppercase tracking-[0.12em] text-black/25">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass + " mt-1"}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-black/[0.08] bg-white/40 px-4 py-8 text-center text-[10px] text-black/25">
      {text}
    </div>
  );
}

function SimplePanel({
  tab,
  underlays,
  flashings,
  labour,
  accessories,
  itemName,
  setItemName,
  itemUnit,
  setItemUnit,
  itemCost,
  setItemCost,
  addItem,
  deleteItem,
}: {
  tab: Tab;
  underlays: Underlay[];
  flashings: FlashingType[];
  labour: LabourType[];
  accessories: Accessory[];
  itemName: string;
  setItemName: (value: string) => void;
  itemUnit: string;
  setItemUnit: (value: string) => void;
  itemCost: string;
  setItemCost: (value: string) => void;
  addItem: () => void;
  deleteItem: (table: CatalogueTable, id: string) => Promise<boolean>;
}) {
  const title =
    tab === "underlays"
      ? "Underlays"
      : tab === "flashings"
        ? "Flashings"
        : tab === "labour"
          ? "Labour"
          : "Accessories";

  const records =
    tab === "underlays"
      ? underlays
      : tab === "flashings"
        ? flashings
        : tab === "labour"
          ? labour
          : accessories;

  const table: CatalogueTable =
    tab === "underlays"
      ? "underlays"
      : tab === "flashings"
        ? "flashing_types"
        : tab === "labour"
          ? "labour_types"
          : "accessories";

  return (
    <Panel
      title={title}
      action={
        <button
          type="button"
          onClick={() => void addItem()}
          className="rounded-md bg-[#242422] px-3 py-2 text-[10px] text-white"
        >
          Add item
        </button>
      }
    >
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Input
          label="Name"
          value={itemName}
          onChange={setItemName}
          placeholder="Item name"
        />

        <Input
          label="Unit"
          value={itemUnit}
          onChange={setItemUnit}
          placeholder={tab === "labour" ? "hour" : "mÂ² / lm / item"}
        />

        <Input
          label={tab === "labour" ? "Rate" : "Unit cost"}
          value={itemCost}
          onChange={setItemCost}
          placeholder="Leave blank if unknown"
        />
      </div>

      {records.length === 0 ? (
        <Empty text={"No " + title.toLowerCase() + " yet."} />
      ) : (
        <div className="divide-y divide-black/[0.06]">
          {records.map((record) => {
            const cost = "rate" in record ? record.rate : record.unitCost;

            return (
              <div
                key={record.id}
                className="grid grid-cols-[1fr_100px_120px_60px] items-center gap-4 py-3"
              >
                <div className="text-[11px] text-black/60">
                  {record.name}
                </div>

                <div className="font-mono text-[10px] text-black/30">
                  {record.unit || "â€”"}
                </div>

                <div className="text-right font-mono text-[10px] text-black/40">
                  {cost == null
                    ? "â€”"
                    : new Intl.NumberFormat("en-NZ", {
                        style: "currency",
                        currency: "NZD",
                      }).format(cost)}
                </div>

                <button
                  type="button"
                  onClick={() => void deleteItem(table, record.id)}
                  className="text-right text-[10px] text-black/20 hover:text-red-500"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}








