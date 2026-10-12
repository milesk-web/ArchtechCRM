import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { webcrypto } from "node:crypto";
import ts from "typescript";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const enginePath = resolve("lib/costing/engine.ts");
const source = await readFile(enginePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { calculateQuote } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

function catalogue(overrides = {}) {
  return {
    profiles: [
      { id: "roof-profile", name: "Corrugated", section: "Roofing", measurementType: "gauge", sortOrder: 1 },
      { id: "wall-profile", name: "Corrugated", section: "Wall Cladding", measurementType: "gauge", sortOrder: 1 },
    ],
    profileOptions: [
      { id: "roof-option", profileId: "roof-profile", value: "0.55", sortOrder: 1 },
      { id: "wall-option", profileId: "wall-profile", value: "0.55", sortOrder: 1 },
    ],
    materials: [
      { id: "roof-material", name: "Roof steel", sortOrder: 1 },
      { id: "wall-material", name: "Wall steel", sortOrder: 2 },
    ],
    colours: [],
    materialRates: [
      { id: "roof-rate", materialId: "roof-material", profileId: "roof-profile", profileOptionId: "roof-option", colourId: null, unit: "m2", unitCost: 10 },
      { id: "wall-rate", materialId: "wall-material", profileId: "wall-profile", profileOptionId: "wall-option", colourId: null, unit: "m2", unitCost: 20 },
    ],
    flashingTypes: [{ id: "apron", name: "Apron", typicalGirthMm: 200, unit: "lm", sortOrder: 1 }],
    flashingBands: [{ id: "band-200", minGirth: 151, maxGirth: 200, sortOrder: 1 }],
    flashingRates: [{ id: "flash-rate", flashingTypeId: "apron", girthBandId: "band-200", materialId: "roof-material", unitCost: 7 }],
    flashingSurcharges: [],
    underlays: [],
    labourRates: [
      { id: "roof-labour", name: "Longrun roof installation", section: "Roofing", unit: "m2", baseRate: 5, sortOrder: 1 },
      { id: "wall-labour", name: "Cladding installation", section: "Wall Cladding", unit: "m2", baseRate: 8, sortOrder: 1 },
    ],
    labourFactors: [],
    accessories: [{ id: "screw-pack", name: "Screw pack", unit: "each", unitCost: 4, sortOrder: 1 }],
    pricingRules: [],
    ...overrides,
  };
}

function section({ areaM2 = 100, profileId = "roof-profile", profileOptionId = "roof-option", materialId = "roof-material", flashings = [] } = {}) {
  return { areaM2, profileId, profileOptionId, materialId, flashings };
}

test("mixed roofing and cladding applies each section's markup and reconciles line totals", () => {
  const result = calculateQuote(
    {
      roof: section({ areaM2: 100 }),
      wall: section({ areaM2: 50, profileId: "wall-profile", profileOptionId: "wall-option", materialId: "wall-material" }),
      margins: { materialRoof: 0.15, labourRoof: 0.15, materialWall: 0.3, labourWall: 0.3 },
    },
    catalogue(),
  );

  assert.equal(result.readyToIssue, true);
  assert.equal(result.sell.material, 2450);
  assert.equal(result.sell.labour, 1095);
  assert.equal(result.sell.total, 3545);
  const materialTotal = result.lines
    .filter((line) => ["Material", "Flashing", "Underlay", "Accessory"].includes(line.category))
    .reduce((sum, line) => sum + line.sellPrice * line.quantity, 0);
  const labourTotal = result.lines
    .filter((line) => line.category === "Labour")
    .reduce((sum, line) => sum + line.sellPrice * line.quantity, 0);
  assert.equal(Math.round(materialTotal * 100) / 100, result.sell.material);
  assert.equal(Math.round(labourTotal * 100) / 100, result.sell.labour);
});

test("missing material rate blocks issue readiness", () => {
  const result = calculateQuote({ roof: section() }, catalogue({ materialRates: [] }));
  assert.equal(result.readyToIssue, false);
  assert.ok(result.warnings.some((warning) => warning.includes("No material rate found")));
  assert.ok(result.lines.some((line) => line.category === "Material" && line.sellPrice === null));
});

test("missing labour rate blocks issue readiness", () => {
  const result = calculateQuote({ roof: section() }, catalogue({ labourRates: [] }));
  assert.equal(result.readyToIssue, false);
  assert.ok(result.warnings.some((warning) => warning.includes("No active labour rate")));
});

test("unpriced flashing blocks issue readiness", () => {
  const result = calculateQuote(
    { roof: section({ flashings: [{ id: "fl-1", flashingTypeId: "apron", girthMm: 200, materialId: "roof-material", lengthM: 5, quantity: 1 }] }) },
    catalogue({ flashingRates: [] }),
  );
  assert.equal(result.readyToIssue, false);
  assert.ok(result.warnings.some((warning) => warning.includes("No flashing rate")));
});

test("zero or invalid section area blocks issue readiness", () => {
  const zero = calculateQuote({ roof: section({ areaM2: 0 }) }, catalogue());
  const invalid = calculateQuote({ roof: section({ areaM2: Number.NaN }) }, catalogue());
  assert.equal(zero.readyToIssue, false);
  assert.equal(invalid.readyToIssue, false);
  assert.ok(zero.warnings.some((warning) => warning.includes("Area must be greater than zero")));
  assert.ok(invalid.warnings.some((warning) => warning.includes("Area must be greater than zero")));
});

test("missing profile, option, or material blocks issue readiness", () => {
  const result = calculateQuote(
    { roof: section({ profileId: "", profileOptionId: "", materialId: "" }) },
    catalogue(),
  );
  assert.equal(result.readyToIssue, false);
  assert.ok(result.warnings.some((warning) => warning.includes("Select a profile, profile option, and material")));
});

test("missing accessory rate blocks issue readiness", () => {
  const result = calculateQuote(
    { accessories: [{ id: "acc-1", accessoryId: "not-in-catalogue", quantity: 2 }] },
    catalogue(),
  );
  assert.equal(result.readyToIssue, false);
  assert.ok(result.warnings.some((warning) => warning.includes("Accessory not found or missing rate")));
});
