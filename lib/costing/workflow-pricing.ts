import type { CatalogueSnapshot, CostLine, QuoteResult } from "@/lib/costing/types";
import type { GeneratedWorkComponent } from "@/lib/workflows/engine";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Turn workflow-generated components with an explicit fixed unit cost into
 * quote lines. Components without pricing remain workflow previews only.
 */
export function applyWorkflowPricing(
  source: QuoteResult,
  components: GeneratedWorkComponent[],
  catalogue: CatalogueSnapshot,
  workflowVersion: number,
): QuoteResult {
  const result: QuoteResult = {
    ...source,
    lines: [...source.lines],
    direct: { ...source.direct },
    sell: { ...source.sell },
    margins: { ...source.margins },
    warnings: [...source.warnings],
  };

  for (const component of components) {
    const pricing = component.pricing;
    if (!pricing) continue;

    const section = pricing.section;
    const ruleType = pricing.markupRuleType ?? "none";
    let markup = 0;

    if (ruleType !== "none") {
      const rule = catalogue.pricingRules.find(
        (candidate) => candidate.ruleType === ruleType && candidate.section === section,
      );
      if (!rule) {
        result.warnings.push(
          `${component.name}: no published ${ruleType.replace("_", " ")} rule for ${section}.`,
        );
        continue;
      }
      markup = rule.value;
    }

    const unitCost = round2(pricing.unitCost);
    const sellPrice = round2(unitCost * (1 + markup));
    const line: CostLine = {
      id: crypto.randomUUID(),
      section: section as CostLine["section"],
      category: component.category as CostLine["category"],
      description: component.name,
      quantity: component.quantity,
      unit: component.unit,
      unitCost,
      sellPrice,
      sortOrder: 1000 + result.lines.length,
      metadata: {
        ...component.metadata,
        kind: "workflow_component",
        workflowComponentId: component.id,
        workflowVersion,
        pricingRuleType: ruleType,
        pricingSection: section,
        markup,
      },
    };

    result.lines.push(line);
    const directAmount = round2(unitCost * component.quantity);
    if (line.category === "Labour") result.direct.labour = round2(result.direct.labour + directAmount);
    else if (line.category === "Fee") result.direct.fees = round2(result.direct.fees + directAmount);
    else result.direct.material = round2(result.direct.material + directAmount);
  }

  result.direct.total = round2(result.direct.material + result.direct.labour + result.direct.fees);
  result.sell.material = round2(
    result.lines
      .filter((line) => ["Material", "Flashing", "Underlay", "Accessory"].includes(line.category))
      .reduce((sum, line) => sum + (line.sellPrice == null ? 0 : line.sellPrice * line.quantity), 0),
  );
  result.sell.labour = round2(
    result.lines
      .filter((line) => line.category === "Labour")
      .reduce((sum, line) => sum + (line.sellPrice == null ? 0 : line.sellPrice * line.quantity), 0),
  );
  result.sell.fees = round2(
    result.lines
      .filter((line) => line.category === "Fee")
      .reduce((sum, line) => sum + (line.sellPrice == null ? 0 : line.sellPrice * line.quantity), 0),
  );
  result.sell.total = round2(result.sell.material + result.sell.labour + result.sell.fees);
  result.readyToIssue =
    result.readyToIssue &&
    result.warnings.length === 0 &&
    result.lines.length > 0 &&
    result.lines.every(
      (line) =>
        line.unitCost != null &&
        Number.isFinite(line.unitCost) &&
        line.sellPrice != null &&
        Number.isFinite(line.sellPrice),
    );

  return result;
}
