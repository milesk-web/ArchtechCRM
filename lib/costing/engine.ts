/**
 * Pure, deterministic costing engine.
 * No React, no database side-effects.
 *
 * Given a QuoteInput + CatalogueSnapshot → QuoteResult
 */

import type {
  CatalogueSnapshot,
  QuoteInput,
  QuoteResult,
  CostLine,
  SectionInput,
  Section,
  FlashingInput,
  MaterialRate,
  FlashingGirthBand,
  PricingRule,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function findRule(
  rules: PricingRule[],
  ruleType: PricingRule["ruleType"],
  section?: Section | null,
): number | null {
  const specific = rules.find(
    (r) => r.ruleType === ruleType && r.section === section,
  );
  if (specific) return specific.value;
  const global = rules.find(
    (r) => r.ruleType === ruleType && r.section == null,
  );
  return global ? global.value : null;
}

function resolveMaterialRate(
  scope: {
    materialId: string;
    profileId: string;
    profileOptionId: string;
    colourId?: string;
  },
  rates: MaterialRate[],
): MaterialRate | null {
  const { materialId, profileId, profileOptionId, colourId } = scope;
  if (!materialId || !profileId || !profileOptionId) return null;

  if (colourId) {
    const exact = rates.find(
      (r) =>
        r.materialId === materialId &&
        r.profileId === profileId &&
        r.profileOptionId === profileOptionId &&
        r.colourId === colourId,
    );
    if (exact) return exact;
  }

  const anyColour = rates.find(
    (r) =>
      r.materialId === materialId &&
      r.profileId === profileId &&
      r.profileOptionId === profileOptionId &&
      r.colourId == null,
  );
  return anyColour ?? null;
}

function getFlashingBand(
  girthMm: number,
  bands: FlashingGirthBand[],
): FlashingGirthBand | null {
  if (!Number.isFinite(girthMm) || girthMm <= 0) return null;
  const matches = bands
    .filter((b) => girthMm >= b.minGirth && girthMm <= b.maxGirth)
    .sort((a, b) => a.minGirth - b.minGirth);
  return matches[0] ?? null;
}

function resolveFlashingUnitCost(
  flashing: FlashingInput,
  catalogue: CatalogueSnapshot,
): { unitCost: number | null; bandId: string | null; surcharges: number } {
  const band = getFlashingBand(flashing.girthMm, catalogue.flashingBands);
  if (!band) {
    return { unitCost: null, bandId: null, surcharges: 0 };
  }

  let rate = catalogue.flashingRates.find(
    (r) =>
      r.girthBandId === band.id &&
      r.materialId === flashing.materialId &&
      r.flashingTypeId === flashing.flashingTypeId,
  );
  if (!rate) {
    rate = catalogue.flashingRates.find(
      (r) =>
        r.girthBandId === band.id &&
        r.materialId === flashing.materialId &&
        r.flashingTypeId == null,
    );
  }

  let surcharges = 0;
  const typeName =
    catalogue.flashingTypes.find((t) => t.id === flashing.flashingTypeId)
      ?.name ??
    flashing.customName ??
    "";
  for (const s of catalogue.flashingSurcharges) {
    if (
      typeName.toLowerCase().includes(s.matchPattern.toLowerCase()) ||
      (flashing.customName ?? "")
        .toLowerCase()
        .includes(s.matchPattern.toLowerCase())
    ) {
      surcharges += s.unitCostPerLm;
    }
  }

  return {
    unitCost: rate ? rate.unitCost : null,
    bandId: band.id,
    surcharges,
  };
}

function pitchMultiplier(
  pitchDegrees: number | undefined,
  factors: CatalogueSnapshot["labourFactors"],
): number {
  if (pitchDegrees == null || !Number.isFinite(pitchDegrees)) return 1;
  if (pitchDegrees <= 20) return 1;
  if (pitchDegrees <= 30) {
    const f = factors.find(
      (x) => x.factorType === "pitch" && x.matchValue === "21-30",
    );
    return f?.multiplier ?? 1.15;
  }
  if (pitchDegrees <= 40) {
    const f = factors.find(
      (x) => x.factorType === "pitch" && x.matchValue === "31-40",
    );
    return f?.multiplier ?? 1.3;
  }
  const f = factors.find(
    (x) => x.factorType === "pitch" && x.matchValue === "40+",
  );
  return f?.multiplier ?? 1.5;
}

// ---------------------------------------------------------------------------
// Section calculation
// ---------------------------------------------------------------------------

function calculateSection(
  section: Section,
  input: SectionInput,
  catalogue: CatalogueSnapshot,
  materialMarkup: number,
  labourMarkup: number,
  warnings: string[],
  sortBase: number,
): { lines: CostLine[]; directMaterial: number; directLabour: number } {
  const lines: CostLine[] = [];
  let directMaterial = 0;
  let directLabour = 0;
  let sort = sortBase;

  const profile = catalogue.profiles.find((p) => p.id === input.profileId);
  const option = catalogue.profileOptions.find(
    (o) => o.id === input.profileOptionId,
  );
  const material = catalogue.materials.find((m) => m.id === input.materialId);
  const colour = input.colourId
    ? catalogue.colours.find((c) => c.id === input.colourId)
    : null;

  const matRate = resolveMaterialRate(
    {
      materialId: input.materialId,
      profileId: input.profileId,
      profileOptionId: input.profileOptionId,
      colourId: input.colourId,
    },
    catalogue.materialRates,
  );

  const qty =
    matRate?.unit === "lm"
      ? input.linealMetres ?? input.areaM2
      : input.areaM2;

  if (matRate) {
    const cost = round2(matRate.unitCost * qty);
    directMaterial += cost;
    lines.push({
      id: crypto.randomUUID(),
      section,
      category: "Material",
      description: [profile?.name, option?.value, material?.name, colour?.name]
        .filter(Boolean)
        .join(" · "),
      quantity: qty,
      unit: matRate.unit,
      unitCost: matRate.unitCost,
      sellPrice: round2(matRate.unitCost * (1 + materialMarkup)),
      sortOrder: sort++,
      metadata: {
        kind: "profile",
        profileId: input.profileId,
        profileOptionId: input.profileOptionId,
        materialId: input.materialId,
        colourId: input.colourId ?? null,
        area: input.areaM2,
      },
    });
  } else if (input.profileId && input.materialId) {
    warnings.push(
      `${section}: No material rate found for selected profile/material/option combination.`,
    );
    lines.push({
      id: crypto.randomUUID(),
      section,
      category: "Material",
      description: [profile?.name, option?.value, material?.name, colour?.name]
        .filter(Boolean)
        .join(" · "),
      quantity: qty,
      unit: "m2",
      unitCost: null,
      sellPrice: null,
      sortOrder: sort++,
      metadata: { kind: "profile", missingRate: true },
    });
  }

  if (input.underlayId) {
    const underlay = catalogue.underlays.find((u) => u.id === input.underlayId);
    if (underlay && underlay.unitCost != null) {
      const factor = underlay.effectiveM2Factor ?? 1;
      const underlayQty = input.areaM2 * factor;
      const cost = round2(underlay.unitCost * underlayQty);
      directMaterial += cost;
      lines.push({
        id: crypto.randomUUID(),
        section,
        category: "Underlay",
        description: underlay.name,
        quantity: underlayQty,
        unit: underlay.unit || "m2",
        unitCost: underlay.unitCost,
        sellPrice: round2(underlay.unitCost * (1 + materialMarkup)),
        sortOrder: sort++,
        metadata: {
          kind: "underlay",
          underlayId: input.underlayId,
          effectiveM2Factor: factor,
        },
      });
    } else {
      warnings.push(`${section}: Underlay selected but no unit cost found.`);
    }
  }

  for (const fl of input.flashings) {
    const { unitCost, bandId, surcharges } = resolveFlashingUnitCost(
      fl,
      catalogue,
    );
    const typeName =
      catalogue.flashingTypes.find((t) => t.id === fl.flashingTypeId)?.name ??
      fl.customName ??
      "Custom flashing";

    const totalUnit = unitCost != null ? unitCost + surcharges : null;
    const lineQty = fl.lengthM * fl.quantity;

    if (totalUnit != null) {
      const cost = round2(totalUnit * lineQty);
      directMaterial += cost;
      lines.push({
        id: fl.id || crypto.randomUUID(),
        section,
        category: "Flashing",
        description: `${typeName} (${fl.girthMm}mm)`,
        quantity: lineQty,
        unit: "lm",
        unitCost: totalUnit,
        sellPrice: round2(totalUnit * (1 + materialMarkup)),
        sortOrder: sort++,
        metadata: {
          kind: "flashing",
          flashingTypeId: fl.flashingTypeId,
          customName: fl.customName,
          girth: fl.girthMm,
          materialId: fl.materialId,
          length: fl.lengthM,
          quantity: fl.quantity,
          bandId,
          surcharges,
        },
      });
    } else {
      warnings.push(
        `${section}: No flashing rate for "${typeName}" at ${fl.girthMm}mm / selected material.`,
      );
      lines.push({
        id: fl.id || crypto.randomUUID(),
        section,
        category: "Flashing",
        description: `${typeName} (${fl.girthMm}mm)`,
        quantity: lineQty,
        unit: "lm",
        unitCost: null,
        sellPrice: null,
        sortOrder: sort++,
        metadata: { kind: "flashing", missingRate: true },
      });
    }
  }

  const baseLabour = catalogue.labourRates.find(
    (r) =>
      r.section === section &&
      (r.name.toLowerCase().includes("longrun") ||
        r.name.toLowerCase().includes("tray") ||
        r.name.toLowerCase().includes("cladding")),
  );
  if (baseLabour && input.areaM2 > 0) {
    const pitchMult = pitchMultiplier(
      input.pitchDegrees,
      catalogue.labourFactors,
    );
    const labourUnit = round2(baseLabour.baseRate * pitchMult);
    const cost = round2(labourUnit * input.areaM2);
    directLabour += cost;
    lines.push({
      id: crypto.randomUUID(),
      section,
      category: "Labour",
      description: `${baseLabour.name}${input.pitchDegrees ? ` (pitch ${input.pitchDegrees}°)` : ""}`,
      quantity: input.areaM2,
      unit: "m2",
      unitCost: labourUnit,
      sellPrice: round2(labourUnit * (1 + labourMarkup)),
      sortOrder: sort++,
      metadata: {
        kind: "labour",
        labourRateId: baseLabour.id,
        pitchDegrees: input.pitchDegrees,
        pitchMultiplier: pitchMult,
      },
    });
  }

  return { lines, directMaterial, directLabour };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function calculateQuote(
  input: QuoteInput,
  catalogue: CatalogueSnapshot,
): QuoteResult {
  const warnings: string[] = [];
  const lines: CostLine[] = [];

  const materialRoof =
    input.margins?.materialRoof ??
    findRule(catalogue.pricingRules, "material_markup", "Roofing") ??
    0.15;
  const labourRoof =
    input.margins?.labourRoof ??
    findRule(catalogue.pricingRules, "labour_markup", "Roofing") ??
    0.15;
  const materialWall =
    input.margins?.materialWall ??
    findRule(catalogue.pricingRules, "material_markup", "Wall Cladding") ??
    0.3;
  const labourWall =
    input.margins?.labourWall ??
    findRule(catalogue.pricingRules, "labour_markup", "Wall Cladding") ??
    0.3;

  let directMaterial = 0;
  let directLabour = 0;
  let directFees = 0;

  if (input.roof) {
    const result = calculateSection(
      "Roofing",
      input.roof,
      catalogue,
      materialRoof,
      labourRoof,
      warnings,
      100,
    );
    lines.push(...result.lines);
    directMaterial += result.directMaterial;
    directLabour += result.directLabour;
  }

  if (input.wall) {
    const result = calculateSection(
      "Wall Cladding",
      input.wall,
      catalogue,
      materialWall,
      labourWall,
      warnings,
      200,
    );
    lines.push(...result.lines);
    directMaterial += result.directMaterial;
    directLabour += result.directLabour;
  }

  if (input.accessories?.length) {
    for (const acc of input.accessories) {
      const item = catalogue.accessories.find((a) => a.id === acc.accessoryId);
      if (item && item.unitCost != null) {
        const cost = round2(item.unitCost * acc.quantity);
        directMaterial += cost;
        lines.push({
          id: acc.id || crypto.randomUUID(),
          section: "Accessories",
          category: "Accessory",
          description: item.name,
          quantity: acc.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          sellPrice: round2(item.unitCost * (1 + materialRoof)),
          sortOrder: 300 + lines.length,
          metadata: { kind: "accessory", accessoryId: acc.accessoryId },
        });
      } else {
        warnings.push(`Accessory not found or missing rate: ${acc.accessoryId}`);
      }
    }
  }

  const ctx = input.jobContext ?? {};
  const smallJobFee = findRule(catalogue.pricingRules, "small_job_fee");
  if (ctx.isSmallJob && smallJobFee) {
    directFees += smallJobFee;
    lines.push({
      id: crypto.randomUUID(),
      section: "Fees",
      category: "Fee",
      description: "Small job fee",
      quantity: 1,
      unit: "each",
      unitCost: smallJobFee,
      sellPrice: smallJobFee,
      sortOrder: 900,
      metadata: { kind: "fee", feeType: "small_job" },
    });
  }

  const measureFee = findRule(catalogue.pricingRules, "measure_fee");
  if (ctx.measureRequired && measureFee) {
    directFees += measureFee;
    lines.push({
      id: crypto.randomUUID(),
      section: "Fees",
      category: "Fee",
      description: "Measure",
      quantity: 1,
      unit: "each",
      unitCost: measureFee,
      sellPrice: measureFee,
      sortOrder: 901,
      metadata: { kind: "fee", feeType: "measure" },
    });
  }

  if (ctx.distanceKm && ctx.distanceKm > 0) {
    const perKm = findRule(catalogue.pricingRules, "distance_rate_per_km") ?? 1.5;
    const travelCost = round2(ctx.distanceKm * perKm);
    directFees += travelCost;
    lines.push({
      id: crypto.randomUUID(),
      section: "Fees",
      category: "Fee",
      description: `Travel (${ctx.distanceKm} km)`,
      quantity: ctx.distanceKm,
      unit: "km",
      unitCost: perKm,
      sellPrice: perKm,
      sortOrder: 902,
      metadata: { kind: "fee", feeType: "travel" },
    });
  }

  const sellMaterial = round2(
    directMaterial * (1 + (input.roof ? materialRoof : materialWall)),
  );
  const sellLabour = round2(
    directLabour * (1 + (input.roof ? labourRoof : labourWall)),
  );
  const sellFees = directFees;

  return {
    lines,
    direct: {
      material: round2(directMaterial),
      labour: round2(directLabour),
      fees: round2(directFees),
      total: round2(directMaterial + directLabour + directFees),
    },
    sell: {
      material: sellMaterial,
      labour: sellLabour,
      fees: sellFees,
      total: round2(sellMaterial + sellLabour + sellFees),
    },
    margins: {
      materialRoof,
      labourRoof,
      materialWall,
      labourWall,
    },
    warnings,
    meta: {
      calculatedAt: new Date().toISOString(),
    },
  };
}
