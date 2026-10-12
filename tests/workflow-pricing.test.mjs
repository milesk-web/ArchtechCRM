import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { webcrypto } from "node:crypto";
import ts from "typescript";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const source = await readFile(resolve("lib/costing/workflow-pricing.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { applyWorkflowPricing } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

function baseResult() {
  return {
    lines: [
      { id: "roof-material", section: "Roofing", category: "Material", description: "Roof sheets", quantity: 100, unit: "m²", unitCost: 10, sellPrice: 11.5, sortOrder: 1, metadata: {} },
      { id: "roof-labour", section: "Roofing", category: "Labour", description: "Roof install", quantity: 100, unit: "m²", unitCost: 5, sellPrice: 5.75, sortOrder: 2, metadata: {} },
    ],
    direct: { material: 1000, labour: 500, fees: 0, total: 1500 },
    sell: { material: 1150, labour: 575, fees: 0, total: 1725 },
    margins: { materialRoof: 0.15, labourRoof: 0.15, materialWall: 0.3, labourWall: 0.3 },
    warnings: [],
    readyToIssue: true,
    meta: { calculatedAt: "2026-01-01T00:00:00.000Z" },
  };
}

const catalogue = {
  pricingRules: [
    { id: "mr", name: "Roof material markup", section: "Roofing", ruleType: "material_markup", value: 0.15 },
    { id: "lw", name: "Wall labour markup", section: "Wall Cladding", ruleType: "labour_markup", value: 0.3 },
  ],
};

test("workflow-priced material, labour, and fee components reconcile totals", () => {
  const components = [
    { id: "safety-rail", name: "Safety rail", category: "Accessory", unit: "each", quantity: 2, metadata: {}, pricing: { unitCost: 50, markupRuleType: "material_markup", section: "Roofing" } },
    { id: "extra-labour", name: "Extra installation", category: "Labour", unit: "hour", quantity: 3, metadata: {}, pricing: { unitCost: 40, markupRuleType: "labour_markup", section: "Wall Cladding" } },
    { id: "travel-fee", name: "Travel fee", category: "Fee", unit: "km", quantity: 10, metadata: {}, pricing: { unitCost: 2, markupRuleType: "none", section: "Fees" } },
    { id: "preview-only", name: "Unpriced preview", category: "Material", unit: "m²", quantity: 4, metadata: {} },
  ];

  const result = applyWorkflowPricing(baseResult(), components, catalogue, 3);
  assert.equal(result.lines.length, 5);
  assert.equal(result.direct.material, 1100);
  assert.equal(result.direct.labour, 620);
  assert.equal(result.direct.fees, 20);
  assert.equal(result.direct.total, 1740);
  assert.equal(result.sell.material, 1265);
  assert.equal(result.sell.labour, 731);
  assert.equal(result.sell.fees, 20);
  assert.equal(result.sell.total, 2016);
  assert.equal(result.readyToIssue, true);
  const customLine = result.lines.find((line) => line.metadata.workflowComponentId === "safety-rail");
  assert.equal(customLine.sellPrice, 57.5);
  assert.equal(customLine.metadata.workflowVersion, 3);
});

test("missing markup rule leaves component unpriced and blocks issuance", () => {
  const result = applyWorkflowPricing(
    baseResult(),
    [{ id: "custom", name: "Custom material", category: "Material", unit: "m²", quantity: 5, metadata: {}, pricing: { unitCost: 12, markupRuleType: "material_markup", section: "Wall Cladding" } }],
    catalogue,
    1,
  );
  assert.equal(result.lines.length, 2);
  assert.equal(result.readyToIssue, false);
  assert.ok(result.warnings.some((warning) => warning.includes("no published material markup rule")));
});

test("workflow pricing does not mutate the source calculation", () => {
  const source = baseResult();
  const originalLineCount = source.lines.length;
  applyWorkflowPricing(
    source,
    [{ id: "fee", name: "Fee", category: "Fee", unit: "each", quantity: 1, metadata: {}, pricing: { unitCost: 25, markupRuleType: "none", section: "Fees" } }],
    catalogue,
    1,
  );
  assert.equal(source.lines.length, originalLineCount);
  assert.equal(source.direct.fees, 0);
});
