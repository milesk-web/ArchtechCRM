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

export type WorkflowComponentDefinition = {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: QuantityFormula;
  when?: WorkflowCondition;
  metadata?: Record<string, unknown>;
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

export function validateWorkflowDefinition(definition: WorkflowDefinition): string[] {
  const errors: string[] = [];
  if (!definition.key.trim()) errors.push("Workflow key is required.");
  if (!definition.name.trim()) errors.push("Workflow name is required.");
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    errors.push("Workflow version must be a positive integer.");
  }
  if (!Array.isArray(definition.fields) || definition.fields.length === 0) {
    errors.push("A workflow must define at least one question.");
  }
  if (!Array.isArray(definition.components)) {
    errors.push("Workflow components must be an array.");
  }

  const fieldIds = new Set<string>();
  for (const field of definition.fields ?? []) {
    if (!field.id.trim() || !field.label.trim()) {
      errors.push("Every workflow question needs an ID and label.");
    }
    if (fieldIds.has(field.id)) errors.push(`Duplicate workflow question ID: ${field.id}.`);
    fieldIds.add(field.id);
    if (field.type === "select" && (!field.options || field.options.length === 0)) {
      errors.push(`Select question "${field.label}" must define at least one option.`);
    }
  }

  const componentIds = new Set<string>();
  for (const component of definition.components ?? []) {
    if (!component.id.trim() || !component.name.trim() || !component.unit.trim()) {
      errors.push("Every generated work component needs an ID, name, and unit.");
    }
    if (componentIds.has(component.id)) errors.push(`Duplicate work component ID: ${component.id}.`);
    componentIds.add(component.id);
  }

  return errors;
}
