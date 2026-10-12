/**
 * Deterministic workflow evaluator.
 *
 * It evaluates configurable questions, visibility/requiredness conditions, and
 * generated work components without React, database calls, time, or randomness.
 * Pricing remains the responsibility of the costing engine.
 */

export type WorkflowAnswer = string | number | boolean | null | undefined | string[];
export type WorkflowAnswers = Record<string, WorkflowAnswer>;

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "contains"
  | "is_set"
  | "is_not_set";

export type WorkflowCondition =
  | { field: string; operator: ConditionOperator; value?: unknown }
  | { all: WorkflowCondition[] }
  | { any: WorkflowCondition[] }
  | { not: WorkflowCondition };

export type WorkflowField = {
  id: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "multiselect";
  required?: boolean;
  requiredWhen?: WorkflowCondition;
  visibleWhen?: WorkflowCondition;
  defaultValue?: WorkflowAnswer;
  helpText?: string;
  options?: Array<{ label: string; value: string }>;
};

export type QuantityFormula =
  | { kind: "constant"; value: number }
  | { kind: "field"; field: string; multiplier?: number; add?: number };

export type WorkflowComponentPricingMode = "costing_engine" | "informational";

export type WorkflowComponentPricing = {
  unitCost: number;
  markupRuleType?: "material_markup" | "labour_markup" | "none";
  section?: "Roofing" | "Wall Cladding" | "Accessories" | "Fees";
};

export type WorkflowComponentDefinition = {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: QuantityFormula;
  when?: WorkflowCondition;
  metadata?: Record<string, unknown>;
  pricing?: WorkflowComponentPricing;
  pricingMode?: WorkflowComponentPricingMode;
};

export type WorkflowDefinition = {
  key: string;
  name: string;
  version: number;
  fields: WorkflowField[];
  components: WorkflowComponentDefinition[];
};

export type GeneratedWorkComponent = {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  metadata: Record<string, unknown>;
  pricing?: WorkflowComponentPricing;
  pricingMode?: WorkflowComponentPricingMode;
};

export type WorkflowEvaluation = {
  answers: WorkflowAnswers;
  visibleFields: WorkflowField[];
  missingRequiredFields: Array<{ id: string; label: string }>;
  components: GeneratedWorkComponent[];
  warnings: string[];
  ready: boolean;
};

function readAnswer(answers: WorkflowAnswers, field: string): WorkflowAnswer {
  if (Object.prototype.hasOwnProperty.call(answers, field)) return answers[field];
  let current: unknown = answers;
  for (const part of field.split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current as WorkflowAnswer;
}

function isSet(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function evaluateCondition(
  condition: WorkflowCondition | undefined,
  answers: WorkflowAnswers,
): boolean {
  if (!condition) return true;
  if ("all" in condition) return condition.all.every((item) => evaluateCondition(item, answers));
  if ("any" in condition) return condition.any.some((item) => evaluateCondition(item, answers));
  if ("not" in condition) return !evaluateCondition(condition.not, answers);

  const actual = readAnswer(answers, condition.field);
  switch (condition.operator) {
    case "equals":
      return Object.is(actual, condition.value);
    case "not_equals":
      return !Object.is(actual, condition.value);
    case "greater_than": {
      const left = numeric(actual);
      const right = numeric(condition.value);
      return left !== null && right !== null && left > right;
    }
    case "greater_than_or_equal": {
      const left = numeric(actual);
      const right = numeric(condition.value);
      return left !== null && right !== null && left >= right;
    }
    case "less_than": {
      const left = numeric(actual);
      const right = numeric(condition.value);
      return left !== null && right !== null && left < right;
    }
    case "less_than_or_equal": {
      const left = numeric(actual);
      const right = numeric(condition.value);
      return left !== null && right !== null && left <= right;
    }
    case "contains":
      if (Array.isArray(actual)) return actual.includes(condition.value as string);
      return typeof actual === "string" && typeof condition.value === "string"
        ? actual.includes(condition.value)
        : false;
    case "is_set":
      return isSet(actual);
    case "is_not_set":
      return !isSet(actual);
    default:
      return false;
  }
}

export function applyWorkflowDefaults(
  definition: WorkflowDefinition,
  answers: WorkflowAnswers,
): WorkflowAnswers {
  const resolved = { ...answers };
  for (const field of definition.fields) {
    if (!Object.prototype.hasOwnProperty.call(resolved, field.id) && field.defaultValue !== undefined) {
      resolved[field.id] = field.defaultValue;
    }
  }
  return resolved;
}

function resolveQuantity(
  formula: QuantityFormula,
  answers: WorkflowAnswers,
): number | null {
  if (formula.kind === "constant") {
    return Number.isFinite(formula.value) ? formula.value : null;
  }
  const value = numeric(readAnswer(answers, formula.field));
  if (value === null) return null;
  const multiplier = formula.multiplier ?? 1;
  const add = formula.add ?? 0;
  if (!Number.isFinite(multiplier) || !Number.isFinite(add)) return null;
  const result = value * multiplier + add;
  return Number.isFinite(result) ? result : null;
}

export function evaluateWorkflow(
  definition: WorkflowDefinition,
  inputAnswers: WorkflowAnswers,
): WorkflowEvaluation {
  const answers = applyWorkflowDefaults(definition, inputAnswers);
  const visibleFields = definition.fields.filter((field) =>
    evaluateCondition(field.visibleWhen, answers),
  );
  const missingRequiredFields = visibleFields
    .filter((field) => {
      const required = field.required === true ||
        (field.requiredWhen ? evaluateCondition(field.requiredWhen, answers) : false);
      const value = readAnswer(answers, field.id);
      return required && (!isSet(value) || (typeof value === "string" && value.trim() === ""));
    })
    .map((field) => ({ id: field.id, label: field.label }));

  const warnings: string[] = [];
  const components: GeneratedWorkComponent[] = [];
  for (const component of definition.components) {
    if (!evaluateCondition(component.when, answers)) continue;
    const quantity = resolveQuantity(component.quantity, answers);
    if (quantity === null) {
      warnings.push(`${component.name}: quantity could not be calculated.`);
      continue;
    }
    if (quantity < 0) {
      warnings.push(`${component.name}: quantity cannot be negative.`);
      continue;
    }
    if (quantity === 0) continue;
    components.push({
      id: component.id,
      name: component.name,
      category: component.category,
      unit: component.unit,
      quantity,
      metadata: { ...(component.metadata ?? {}) },
      ...(component.pricing ? { pricing: { ...component.pricing } } : {}),
      ...(component.pricingMode ? { pricingMode: component.pricingMode } : {}),
    });
  }

  return {
    answers,
    visibleFields,
    missingRequiredFields,
    components,
    warnings,
    ready: missingRequiredFields.length === 0 && warnings.length === 0,
  };
}

const CONDITION_OPERATORS = new Set<ConditionOperator>([
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "contains",
  "is_set",
  "is_not_set",
]);

function validateCondition(value: unknown, path: string, errors: string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} must be a condition object.`);
    return;
  }
  const condition = value as Record<string, unknown>;
  if ("all" in condition) {
    if (!Array.isArray(condition.all)) errors.push(`${path}.all must be an array.`);
    else condition.all.forEach((item, index) => validateCondition(item, `${path}.all[${index}]`, errors));
    return;
  }
  if ("any" in condition) {
    if (!Array.isArray(condition.any)) errors.push(`${path}.any must be an array.`);
    else condition.any.forEach((item, index) => validateCondition(item, `${path}.any[${index}]`, errors));
    return;
  }
  if ("not" in condition) {
    validateCondition(condition.not, `${path}.not`, errors);
    return;
  }
  if (typeof condition.field !== "string" || !condition.field.trim()) {
    errors.push(`${path}.field is required.`);
  }
  if (typeof condition.operator !== "string" || !CONDITION_OPERATORS.has(condition.operator as ConditionOperator)) {
    errors.push(`${path}.operator is unsupported.`);
  } else if (
    !["is_set", "is_not_set"].includes(condition.operator) &&
    !Object.prototype.hasOwnProperty.call(condition, "value")
  ) {
    errors.push(`${path}.value is required for this operator.`);
  }
}

export function validateWorkflowDefinition(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["Workflow definition must be an object."];
  }

  const definition = value as Partial<WorkflowDefinition>;
  if (typeof definition.key !== "string" || !/^[a-z0-9-]+$/.test(definition.key)) {
    errors.push("Workflow key must use lowercase letters, numbers, and hyphens.");
  }
  if (typeof definition.name !== "string" || !definition.name.trim()) {
    errors.push("Workflow name is required.");
  }
  if (!Number.isInteger(definition.version) || (definition.version ?? 0) < 1) {
    errors.push("Workflow version must be a positive integer.");
  }
  if (!Array.isArray(definition.fields) || definition.fields.length === 0) {
    errors.push("A workflow must define at least one question.");
  }
  if (!Array.isArray(definition.components)) {
    errors.push("Workflow components must be an array.");
  }

  const fieldIds = new Set<string>();
  for (const [index, rawField] of (Array.isArray(definition.fields) ? definition.fields : []).entries()) {
    if (!rawField || typeof rawField !== "object") {
      errors.push(`Question ${index + 1} is invalid.`);
      continue;
    }
    const field = rawField as WorkflowField;
    if (typeof field.id !== "string" || !field.id.trim() || typeof field.label !== "string" || !field.label.trim()) {
      errors.push("Every workflow question needs an ID and label.");
      continue;
    }
    if (fieldIds.has(field.id)) errors.push(`Duplicate workflow question ID: ${field.id}.`);
    fieldIds.add(field.id);
    if (!["text", "number", "boolean", "select", "multiselect"].includes(field.type)) {
      errors.push(`Question "${field.label}" has an unsupported type.`);
    }
    if (field.type === "select" || field.type === "multiselect") {
      if (!Array.isArray(field.options) || field.options.length === 0) {
        errors.push(`Question "${field.label}" must define at least one option.`);
      } else {
        const optionValues = new Set<string>();
        for (const option of field.options) {
          if (!option || typeof option.label !== "string" || typeof option.value !== "string") {
            errors.push(`Question "${field.label}" has an invalid option.`);
            continue;
          }
          if (optionValues.has(option.value)) errors.push(`Question "${field.label}" has duplicate option value "${option.value}".`);
          optionValues.add(option.value);
        }
      }
    }
    if (field.visibleWhen !== undefined) validateCondition(field.visibleWhen, `Question "${field.label}" visibility`, errors);
    if (field.requiredWhen !== undefined) validateCondition(field.requiredWhen, `Question "${field.label}" requiredness`, errors);
  }

  const componentIds = new Set<string>();
  for (const [index, rawComponent] of (Array.isArray(definition.components) ? definition.components : []).entries()) {
    if (!rawComponent || typeof rawComponent !== "object") {
      errors.push(`Generated work component ${index + 1} is invalid.`);
      continue;
    }
    const component = rawComponent as WorkflowComponentDefinition;
    if (
      typeof component.id !== "string" || !component.id.trim() ||
      typeof component.name !== "string" || !component.name.trim() ||
      typeof component.category !== "string" || !component.category.trim() ||
      typeof component.unit !== "string" || !component.unit.trim()
    ) {
      errors.push("Every generated work component needs an ID, name, category, and unit.");
      continue;
    }
    if (componentIds.has(component.id)) errors.push(`Duplicate work component ID: ${component.id}.`);
    componentIds.add(component.id);

    if (!component.quantity || typeof component.quantity !== "object") {
      errors.push(`Component "${component.name}" needs a quantity formula.`);
    } else if (component.quantity.kind === "constant") {
      if (!Number.isFinite(component.quantity.value)) errors.push(`Component "${component.name}" has an invalid constant quantity.`);
    } else if (component.quantity.kind === "field") {
      if (typeof component.quantity.field !== "string" || !component.quantity.field.trim()) {
        errors.push(`Component "${component.name}" must reference a quantity field.`);
      }
      if (component.quantity.multiplier !== undefined && !Number.isFinite(component.quantity.multiplier)) {
        errors.push(`Component "${component.name}" has an invalid quantity multiplier.`);
      }
      if (component.quantity.add !== undefined && !Number.isFinite(component.quantity.add)) {
        errors.push(`Component "${component.name}" has an invalid quantity addend.`);
      }
    } else {
      errors.push(`Component "${component.name}" uses an unsupported quantity formula.`);
    }
    const validCategories = ["Material", "Flashing", "Labour", "Underlay", "Accessory", "Fee"];
    if (!validCategories.includes(component.category)) {
      errors.push(`Component "${component.name}" has an unsupported costing category.`);
    }
    if (component.pricingMode !== undefined && !["costing_engine", "informational"].includes(component.pricingMode)) {
      errors.push(`Component "${component.name}" has an unsupported pricingMode.`);
    }
    if (component.pricing !== undefined && component.pricingMode !== undefined) {
      errors.push(`Component "${component.name}" must use pricing or pricingMode, not both.`);
    }
    if (component.pricing === undefined && component.pricingMode === undefined) {
      errors.push(`Component "${component.name}" must configure pricing or declare pricingMode as costing_engine or informational.`);
    }
    if (component.pricing !== undefined) {
      const pricing = component.pricing as WorkflowComponentPricing;
      if (!pricing || typeof pricing !== "object" || !Number.isFinite(pricing.unitCost) || pricing.unitCost < 0) {
        errors.push(`Component "${component.name}" has an invalid fixed unit cost.`);
      } else {
        const markupType = pricing.markupRuleType ?? "none";
        if (!["material_markup", "labour_markup", "none"].includes(markupType)) {
          errors.push(`Component "${component.name}" has an unsupported markup rule.`);
        }
        if (!pricing.section || !["Roofing", "Wall Cladding", "Accessories", "Fees"].includes(pricing.section)) {
          errors.push(`Component "${component.name}" must specify a valid pricing section.`);
        }
        if (markupType !== "none" && !["Roofing", "Wall Cladding"].includes(pricing.section ?? "")) {
          errors.push(`Component "${component.name}" must specify Roofing or Wall Cladding when applying a markup rule.`);
        }
        if (markupType === "labour_markup" && component.category !== "Labour") {
          errors.push(`Component "${component.name}" must use the Labour category with labour markup.`);
        }
        if (markupType === "material_markup" && !["Material", "Flashing", "Underlay", "Accessory"].includes(component.category)) {
          errors.push(`Component "${component.name}" must use a material category with material markup.`);
        }
        if (component.category === "Fee" && pricing.section !== "Fees") {
          errors.push(`Fee component "${component.name}" must use the Fees section.`);
        }
        if (component.category === "Labour" && !["Roofing", "Wall Cladding"].includes(pricing.section ?? "")) {
          errors.push(`Labour component "${component.name}" must use Roofing or Wall Cladding.`);
        }
        if (["Material", "Flashing", "Underlay"].includes(component.category) && !["Roofing", "Wall Cladding"].includes(pricing.section ?? "")) {
          errors.push(`Material component "${component.name}" must use Roofing or Wall Cladding.`);
        }
        if (component.category === "Accessory" && !["Accessories", "Roofing", "Wall Cladding"].includes(pricing.section ?? "")) {
          errors.push(`Accessory component "${component.name}" must use Accessories, Roofing, or Wall Cladding.`);
        }
      }
    }
    if (component.when !== undefined) validateCondition(component.when, `Component "${component.name}" condition`, errors);
  }

  return errors;
}
