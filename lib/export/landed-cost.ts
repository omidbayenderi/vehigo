export const LANDED_COST_VERSION = "landed-cost-v1";

export type ExchangeRate = {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  provider: string;
  observedAt: string;
  sourceReference?: string | null;
};

export type ExportRule = {
  id: string;
  code: string;
  label: string;
  category: "tax" | "customs" | "logistics" | "insurance" | "service" | "compliance" | "other";
  calculationType: "fixed" | "percentage";
  baseKey?: "vehicle_price" | "customs_value" | "subtotal" | null;
  amount?: number | null;
  ratePercent?: number | null;
  currency?: string | null;
  minimumAmount?: number | null;
  maximumAmount?: number | null;
  conditions?: Record<string, unknown>;
  blocking?: boolean;
  evidenceRequired?: boolean;
  sortOrder?: number;
};

export type ManualCost = {
  code: string;
  label: string;
  category: ExportRule["category"];
  amount: number;
  currency: string;
  evidence?: string | null;
};

export type LandedCostInput = {
  vehiclePrice: number;
  vehicleCurrency: string;
  calculationCurrency: string;
  originCountryCode: string;
  destinationCountryCode: string;
  transportMode: string;
  vehicleCategory: string;
  buyerProfile: string;
  manualCosts: ManualCost[];
  rules: ExportRule[];
  exchangeRates: ExchangeRate[];
};

export type CostLine = {
  code: string;
  label: string;
  category: string;
  amount: number;
  currency: string;
  source: "vehicle" | "manual" | "rule";
  ruleId?: string;
  calculation?: string;
  evidence?: string | null;
};

export type LandedCostResult = {
  calculationVersion: typeof LANDED_COST_VERSION;
  costLines: CostLine[];
  totals: {
    vehicle: number;
    logistics: number;
    taxesAndCustoms: number;
    servicesAndOther: number;
    landedCost: number;
    currency: string;
  };
  sensitivity: Array<{ code: string; label: string; landedCost: number; delta: number; deltaPercent: number }>;
  compliance: {
    calculationComplete: boolean;
    blockers: string[];
    warnings: string[];
    manualEvidenceMissing: string[];
  };
  usedExchangeRates: ExchangeRate[];
};

export function calculateLandedCost(input: LandedCostInput): LandedCostResult {
  assertInput(input);
  const usedRates = new Map<string, ExchangeRate>();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const manualEvidenceMissing: string[] = [];
  const convert = (amount: number, from: string) => convertMoney(amount, from, input.calculationCurrency, input.exchangeRates, usedRates);
  const vehicleAmount = convert(input.vehiclePrice, input.vehicleCurrency);
  const costLines: CostLine[] = [{ code: "vehicle_price", label: "Araç alış fiyatı", category: "vehicle", amount: round(vehicleAmount), currency: input.calculationCurrency, source: "vehicle", calculation: `${input.vehiclePrice} ${input.vehicleCurrency}` }];

  for (const cost of input.manualCosts) {
    if (cost.amount < 0) throw new Error(`${cost.code} maliyeti negatif olamaz.`);
    const amount = convert(cost.amount, cost.currency);
    costLines.push({ code: cost.code, label: cost.label, category: cost.category, amount: round(amount), currency: input.calculationCurrency, source: "manual", evidence: cost.evidence ?? null });
    if (!cost.evidence?.trim()) manualEvidenceMissing.push(cost.code);
  }

  for (const rule of [...input.rules].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.code.localeCompare(b.code))) {
    if (!ruleApplies(rule, input)) continue;
    if (rule.category === "compliance" && rule.blocking) {
      blockers.push(`${rule.label}: manuel uygunluk onayı gerekli.`);
      continue;
    }
    let amount: number;
    let calculation: string;
    if (rule.calculationType === "fixed") {
      if (rule.amount === null || rule.amount === undefined || !rule.currency) throw new Error(`${rule.code} sabit kuralı tutar/para birimi içermiyor.`);
      amount = convert(rule.amount, rule.currency);
      calculation = `${rule.amount} ${rule.currency} sabit`;
    } else {
      if (rule.ratePercent === null || rule.ratePercent === undefined || !rule.baseKey) throw new Error(`${rule.code} yüzde kuralı oran/taban içermiyor.`);
      const base = baseAmount(rule.baseKey, costLines);
      amount = base * rule.ratePercent / 100;
      calculation = `${round(base)} × %${rule.ratePercent}`;
    }
    if (rule.minimumAmount !== null && rule.minimumAmount !== undefined) amount = Math.max(amount, convert(rule.minimumAmount, rule.currency ?? input.calculationCurrency));
    if (rule.maximumAmount !== null && rule.maximumAmount !== undefined) amount = Math.min(amount, convert(rule.maximumAmount, rule.currency ?? input.calculationCurrency));
    costLines.push({ code: rule.code, label: rule.label, category: rule.category, amount: round(amount), currency: input.calculationCurrency, source: "rule", ruleId: rule.id, calculation });
    if (rule.evidenceRequired === false) warnings.push(`${rule.label}: kaynak kanıtı zorunlu değil olarak işaretlenmiş.`);
  }

  if (manualEvidenceMissing.length) warnings.push(`${manualEvidenceMissing.length} manuel maliyetin kaynak/teklif kanıtı eksik.`);
  const totals = summarize(costLines, input.calculationCurrency);
  const sensitivity = calculateSensitivity(input, totals.landedCost);
  return {
    calculationVersion: LANDED_COST_VERSION,
    costLines,
    totals,
    sensitivity,
    compliance: { calculationComplete: blockers.length === 0, blockers, warnings, manualEvidenceMissing },
    usedExchangeRates: [...usedRates.values()],
  };
}

export function convertMoney(amount: number, fromCurrency: string, toCurrency: string, rates: ExchangeRate[], used?: Map<string, ExchangeRate>) {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return amount;
  const direct = latestRate(rates.filter((rate) => rate.baseCurrency === from && rate.quoteCurrency === to));
  if (direct) { used?.set(direct.id, direct); return amount * direct.rate; }
  const inverse = latestRate(rates.filter((rate) => rate.baseCurrency === to && rate.quoteCurrency === from));
  if (inverse) { used?.set(inverse.id, inverse); return amount / inverse.rate; }
  throw new Error(`${from}/${to} için kur snapshot'ı bulunamadı.`);
}

function baseAmount(key: NonNullable<ExportRule["baseKey"]>, lines: CostLine[]) {
  if (key === "vehicle_price") return lines.find((line) => line.code === "vehicle_price")?.amount ?? 0;
  if (key === "customs_value") return lines.filter((line) => line.code === "vehicle_price" || line.category === "logistics" || line.category === "insurance").reduce((sum, line) => sum + line.amount, 0);
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

function summarize(lines: CostLine[], currency: string) {
  const sum = (predicate: (line: CostLine) => boolean) => round(lines.filter(predicate).reduce((total, line) => total + line.amount, 0));
  return {
    vehicle: sum((line) => line.source === "vehicle"),
    logistics: sum((line) => line.category === "logistics" || line.category === "insurance"),
    taxesAndCustoms: sum((line) => line.category === "tax" || line.category === "customs"),
    servicesAndOther: sum((line) => !["vehicle", "logistics", "insurance", "tax", "customs"].includes(line.category)),
    landedCost: sum(() => true),
    currency,
  };
}

function calculateSensitivity(input: LandedCostInput, baseline: number) {
  const variants = [
    { code: "fx_plus_5", label: "Kur maliyeti +%5", fx: 1.05, logistics: 1, vehicle: 1 },
    { code: "logistics_plus_10", label: "Lojistik +%10", fx: 1, logistics: 1.1, vehicle: 1 },
    { code: "vehicle_plus_5", label: "Araç fiyatı +%5", fx: 1, logistics: 1, vehicle: 1.05 },
    { code: "combined_stress", label: "Birleşik stres", fx: 1.05, logistics: 1.1, vehicle: 1.05 },
  ];
  return variants.map((variant) => {
    const stressedRates = input.exchangeRates.map((rate) => ({
      ...rate,
      rate: rate.quoteCurrency === input.calculationCurrency
        ? rate.rate * variant.fx
        : rate.baseCurrency === input.calculationCurrency
          ? rate.rate / variant.fx
          : rate.rate,
    }));
    const stressedInput = { ...input, vehiclePrice: input.vehiclePrice * variant.vehicle, manualCosts: input.manualCosts.map((cost) => cost.category === "logistics" || cost.category === "insurance" ? { ...cost, amount: cost.amount * variant.logistics } : cost), exchangeRates: stressedRates };
    const landedCost = calculateWithoutSensitivity(stressedInput);
    const delta = round(landedCost - baseline);
    return { code: variant.code, label: variant.label, landedCost, delta, deltaPercent: baseline ? round(delta / baseline * 100) : 0 };
  });
}

function calculateWithoutSensitivity(input: LandedCostInput) {
  const used = new Map<string, ExchangeRate>();
  const convert = (amount: number, currency: string) => convertMoney(amount, currency, input.calculationCurrency, input.exchangeRates, used);
  const lines: CostLine[] = [{ code: "vehicle_price", label: "Araç alış fiyatı", category: "vehicle", amount: convert(input.vehiclePrice, input.vehicleCurrency), currency: input.calculationCurrency, source: "vehicle" }];
  for (const cost of input.manualCosts) lines.push({ code: cost.code, label: cost.label, category: cost.category, amount: convert(cost.amount, cost.currency), currency: input.calculationCurrency, source: "manual" });
  for (const rule of [...input.rules].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
    if (!ruleApplies(rule, input) || rule.category === "compliance") continue;
    let amount = rule.calculationType === "fixed" ? convert(rule.amount ?? 0, rule.currency ?? input.calculationCurrency) : baseAmount(rule.baseKey ?? "subtotal", lines) * (rule.ratePercent ?? 0) / 100;
    if (rule.minimumAmount !== null && rule.minimumAmount !== undefined) amount = Math.max(amount, convert(rule.minimumAmount, rule.currency ?? input.calculationCurrency));
    if (rule.maximumAmount !== null && rule.maximumAmount !== undefined) amount = Math.min(amount, convert(rule.maximumAmount, rule.currency ?? input.calculationCurrency));
    lines.push({ code: rule.code, label: rule.label, category: rule.category, amount, currency: input.calculationCurrency, source: "rule" });
  }
  return round(lines.reduce((sum, line) => sum + line.amount, 0));
}

function ruleApplies(rule: ExportRule, input: LandedCostInput) {
  const conditions = rule.conditions ?? {};
  return matches(conditions.originCountryCodes, input.originCountryCode)
    && matches(conditions.destinationCountryCodes, input.destinationCountryCode)
    && matches(conditions.transportModes, input.transportMode)
    && matches(conditions.vehicleCategories, input.vehicleCategory)
    && matches(conditions.buyerProfiles, input.buyerProfile);
}

function matches(value: unknown, actual: string) {
  return !Array.isArray(value) || value.length === 0 || value.some((item) => String(item).toLowerCase() === actual.toLowerCase());
}

function latestRate(rates: ExchangeRate[]) {
  return [...rates].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
}

function assertInput(input: LandedCostInput) {
  if (!Number.isFinite(input.vehiclePrice) || input.vehiclePrice < 0) throw new Error("Araç fiyatı geçersiz.");
  if (input.originCountryCode === input.destinationCountryCode) throw new Error("Çıkış ve hedef ülke farklı olmalıdır.");
  for (const currency of [input.vehicleCurrency, input.calculationCurrency]) if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`Geçersiz para birimi: ${currency}`);
}

function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
