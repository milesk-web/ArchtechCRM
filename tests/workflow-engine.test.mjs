import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const source = await readFile(resolve("lib/workflows/engine.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const {
  evaluateCondition,
  evaluateWorkflow,
  validateWorkflowDefinition,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const definition = {
  key: "roof-replacement",
  name: "Roof replacement",
  version: 1,
  fields: [
    { id: "includeRoof", label: "Include roofing", type: "boolean", defaultValue: true },
    { id: "roof.areaM2", label: "Roof area (m²)", type: "number", required: true, visibleWhen: { field: "includeRoof", operator: "equals", value: true } },
    { id: "includeUnderlay", label: "Include underlay", type: "boolean", defaultValue: false },
    { id: "underlay.type", label: "Underlay type", type: "select", requiredWhen: { field: "includeUnderlay", operator: "equals", value: true }, visibleWhen: { field: "includeUnderlay", operator: "equals", value: true }, options: [{ label: "Standard", value: "standard" }] },
  ],
  components: [
    { id: "roof-sheets", name: "Roof sheets", category: "Material", unit: "m²", quantity: { kind: "field", field: "roof.areaM2", multiplier: 1.12 }, when: { field: "includeRoof", operator: "equals", value: true }, metadata: { source: "roof-area" } },
    { id: "underlay", name: "Roof underlay", category: "Underlay", unit: "m²", quantity: { kind: "field", field: "roof.areaM2", multiplier: 1.1 }, when: { all: [{ field: "includeRoof", operator: "equals", value: true }, { field: "includeUnderlay", operator: "equals", value: true }] } },
  ],
};

test("condition evaluator supports nested all/any/not and numeric comparisons", () => {
  const answers = { area: 125, profile: "corrugated", enabled: true };
  assert.equal(evaluateCondition({ all: [
    { field: "area", operator: "greater_than", value: 100 },
    { any: [
      { field: "profile", operator: "equals", value: "corrugated" },
      { field: "profile", operator: "equals", value: "standing-seam" },
    ] },
    { not: { field: "enabled", operator: "equals", value: false } },
  ] }, answers), true);
  assert.equal(evaluateCondition({ field: "area", operator: "less_than_or_equal", value: 100 }, answers), false);
  assert.equal(evaluateCondition({ field: "missing", operator: "is_not_set" }, answers), true);
});

test("defaults, conditional visibility, and required questions evaluate consistently", () => {
  const result = evaluateWorkflow(definition, { "roof.areaM2": 120 });
  assert.equal(result.answers.includeRoof, true);
  assert.equal(result.answers.includeUnderlay, false);
  assert.deepEqual(result.visibleFields.map((field) => field.id), ["includeRoof", "roof.areaM2", "includeUnderlay"]);
  assert.deepEqual(result.missingRequiredFields, []);
  assert.equal(result.ready, true);
});

test("conditional required questions block incomplete workflows", () => {
  const result = evaluateWorkflow(definition, {
    "roof.areaM2": 120,
    includeUnderlay: true,
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingRequiredFields, [{ id: "underlay.type", label: "Underlay type" }]);
});

test("conditions generate explainable work components with deterministic quantities", () => {
  const result = evaluateWorkflow(definition, {
    "roof.areaM2": 120,
    includeUnderlay: true,
    "underlay.type": "standard",
  });
  assert.equal(result.ready, true);
  assert.deepEqual(result.components.map((item) => [item.id, item.quantity]), [
    ["roof-sheets", 134.4],
    ["underlay", 132],
  ]);
  assert.deepEqual(result.components[0].metadata, { source: "roof-area" });
  assert.deepEqual(evaluateWorkflow(definition, {
    "roof.areaM2": 120,
    includeUnderlay: true,
    "underlay.type": "standard",
  }), result);
});

test("invalid component quantity expressions create a blocker instead of silently pricing zero", () => {
  const invalid = {
    ...definition,
    components: [{ id: "invalid", name: "Invalid work", category: "Labour", unit: "hour", quantity: { kind: "field", field: "unknown" } }],
  };
  const result = evaluateWorkflow(invalid, { "roof.areaM2": 120 });
  assert.equal(result.ready, false);
  assert.deepEqual(result.warnings, ["Invalid work: quantity could not be calculated."]);
  assert.deepEqual(result.components, []);
});

test("workflow definition validation rejects duplicate IDs and empty select options", () => {
  const invalid = {
    ...definition,
    fields: [
      { id: "same", label: "First", type: "text" },
      { id: "same", label: "Second", type: "select", options: [] },
    ],
    components: [
      { id: "duplicate", name: "One", category: "Material", unit: "m²", quantity: { kind: "constant", value: 1 } },
      { id: "duplicate", name: "Two", category: "Labour", unit: "hour", quantity: { kind: "constant", value: 1 } },
    ],
  };
  const errors = validateWorkflowDefinition(invalid);
  assert.ok(errors.some((error) => error.includes("Duplicate workflow question ID")));
  assert.ok(errors.some((error) => error.includes("must define at least one option")));
  assert.ok(errors.some((error) => error.includes("Duplicate work component ID")));
});
