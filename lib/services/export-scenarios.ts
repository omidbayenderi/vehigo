import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateLandedCost, LANDED_COST_VERSION, type ExchangeRate, type ExportRule, type ManualCost } from "@/lib/export/landed-cost";
import { canonicalCountryCode } from "@/lib/normalization/normalize-listing";
import type { Database, Json } from "@/lib/supabase/types";
import { exchangeRateSnapshotSchema, exportScenarioSchema } from "@/lib/validation/schemas";

type Client = SupabaseClient<Database>;
type Scenario = Database["public"]["Tables"]["export_scenarios"]["Row"];
type Result = Database["public"]["Tables"]["export_scenario_results"]["Row"];
type ScenarioDocument = Database["public"]["Tables"]["export_scenario_documents"]["Row"];
export type ExportScenarioListItem = Scenario & { latestResult: Result | null; documents: ScenarioDocument[] };

export async function createExportScenario(supabase: Client, input: unknown, userId: string) {
  const parsed = exportScenarioSchema.parse(input);
  await validateReferences(supabase, parsed.rule_set_id, parsed.route_id, parsed.origin_country_code, parsed.destination_country_code);
  const { data, error } = await supabase.from("export_scenarios").insert({ ...parsed, manual_costs: parsed.manual_costs as unknown as Json, assumptions: parsed.assumptions as Json, created_by: userId }).select("*").single();
  if (error) throw new Error(error.message);
  await syncScenarioDocuments(supabase, data);
  return data;
}

export async function createScenarioFromLegacyOffer(supabase: Client, offerId: string, userId: string) {
  const { data: offer, error: offerError } = await supabase.from("offers").select("*").eq("id", offerId).single();
  if (offerError) throw new Error(offerError.message);
  if (!offer.vehicle_id) throw new Error("Teklif bir araca bağlı değil.");
  const [{ data: vehicle, error: vehicleError }, { data: lead }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", offer.vehicle_id).single(),
    offer.lead_id ? supabase.from("leads").select("business_type").eq("id", offer.lead_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (vehicleError) throw new Error(vehicleError.message);
  const origin = canonicalCountryCode(vehicle.seller_country);
  if (!origin) throw new Error("Teklif aracının çıkış ülkesi iki harfli ülke koduna dönüştürülemedi.");
  const currency = offer.currency || vehicle.currency || "EUR";
  const manualCosts: ManualCost[] = [
    legacyCost("export_company_fee", "İhracat şirketi ücreti", "service", offer.export_company_fee, currency),
    legacyCost("transport_cost", "Nakliye", "logistics", offer.transport_cost, currency),
    legacyCost("insurance_cost", "Sigorta", "insurance", offer.insurance_cost, currency),
    legacyCost("customs_estimate", "Gümrük tahmini", "customs", offer.iran_customs_estimate, currency),
    legacyCost("internal_service_fee", "İç hizmet ücreti", "service", offer.internal_service_fee, currency),
  ].filter((cost) => cost.amount > 0);
  const { data: ruleSet } = await supabase.from("export_rule_sets").select("id").eq("status", "active").eq("destination_country_code", "IR").or(`origin_country_code.eq.${origin},origin_country_code.is.null`).order("version", { ascending: false }).limit(1).maybeSingle();
  return createExportScenario(supabase, {
    name: `Teklif ${offer.id.slice(0, 8)} · İran senaryosu`,
    vehicle_id: vehicle.id,
    offer_id: offer.id,
    rule_set_id: ruleSet?.id,
    origin_country_code: origin,
    destination_country_code: "IR",
    transport_mode: "road",
    vehicle_category: vehicle.vehicle_type ?? "other",
    buyer_profile: lead?.business_type?.trim() || "commercial_buyer",
    calculation_currency: currency,
    vehicle_price: offer.base_vehicle_price ?? vehicle.price ?? 0,
    vehicle_currency: vehicle.currency || currency,
    manual_costs: manualCosts,
    assumptions: { migratedFromLegacyOffer: offer.id, legacyFieldMapping: { iran_customs_estimate: "customs_estimate" } },
  }, userId);
}

export async function calculateExportScenario(supabase: Client, scenarioId: string, userId: string): Promise<Result> {
  const scenario = await getScenario(supabase, scenarioId);
  const [{ data: ruleSet, error: ruleSetError }, { data: rules, error: rulesError }, { data: rates, error: ratesError }] = await Promise.all([
    scenario.rule_set_id ? supabase.from("export_rule_sets").select("*").eq("id", scenario.rule_set_id).single() : Promise.resolve({ data: null, error: null }),
    scenario.rule_set_id ? supabase.from("export_rules").select("*").eq("rule_set_id", scenario.rule_set_id).order("sort_order") : Promise.resolve({ data: [], error: null }),
    supabase.from("exchange_rate_snapshots").select("*").order("observed_at", { ascending: false }).limit(500),
  ]);
  if (ruleSetError) throw new Error(ruleSetError.message);
  if (rulesError) throw new Error(rulesError.message);
  if (ratesError) throw new Error(ratesError.message);
  validateRuleSetForScenario(ruleSet, scenario);
  await syncScenarioDocuments(supabase, scenario, ruleSet?.required_documents);
  const { data: documents, error: documentsError } = await supabase.from("export_scenario_documents").select("*").eq("scenario_id", scenario.id).order("document_code");
  if (documentsError) throw new Error(documentsError.message);

  const engineInput = {
    vehiclePrice: scenario.vehicle_price,
    vehicleCurrency: scenario.vehicle_currency,
    calculationCurrency: scenario.calculation_currency,
    originCountryCode: scenario.origin_country_code,
    destinationCountryCode: scenario.destination_country_code,
    transportMode: scenario.transport_mode,
    vehicleCategory: scenario.vehicle_category,
    buyerProfile: scenario.buyer_profile,
    manualCosts: readManualCosts(scenario.manual_costs),
    rules: (rules ?? []).map(toRule),
    exchangeRates: (rates ?? []).map(toRate),
  };
  const result = calculateLandedCost(engineInput);
  const pendingDocuments = (documents ?? []).filter((document) => document.required && document.status !== "verified" && document.status !== "not_applicable").map((document) => document.document_code);
  if (!ruleSet) result.compliance.blockers.push("Onaylı ve sürümlü bir kural seti seçilmedi.");
  if (pendingDocuments.length) result.compliance.warnings.push(`${pendingDocuments.length} zorunlu belge henüz doğrulanmadı.`);
  result.compliance.calculationComplete = result.compliance.blockers.length === 0;
  const inputSnapshot = { scenarioId: scenario.id, name: scenario.name, originCountryCode: scenario.origin_country_code, destinationCountryCode: scenario.destination_country_code, transportMode: scenario.transport_mode, vehicleCategory: scenario.vehicle_category, buyerProfile: scenario.buyer_profile, vehiclePrice: scenario.vehicle_price, vehicleCurrency: scenario.vehicle_currency, calculationCurrency: scenario.calculation_currency, manualCosts: engineInput.manualCosts, assumptions: scenario.assumptions };
  const ruleSnapshot = ruleSet ? { id: ruleSet.id, code: ruleSet.code, version: ruleSet.version, approvedAt: ruleSet.approved_at, sources: ruleSet.source_references, assumptions: ruleSet.assumptions, rules: rules ?? [] } : { status: "missing" };
  const fxSnapshot = result.usedExchangeRates;
  const evidenceHash = createHash("sha256").update(stableStringify({ inputSnapshot, ruleSnapshot, fxSnapshot, version: LANDED_COST_VERSION })).digest("hex");
  const insert = { scenario_id: scenario.id, calculation_version: LANDED_COST_VERSION, evidence_hash: evidenceHash, input_snapshot: inputSnapshot as unknown as Json, rule_snapshot: ruleSnapshot as unknown as Json, exchange_rate_snapshot: fxSnapshot as unknown as Json, cost_lines: result.costLines as unknown as Json, totals: result.totals as unknown as Json, sensitivity: result.sensitivity as unknown as Json, compliance: result.compliance as unknown as Json, calculated_by: userId } satisfies Database["public"]["Tables"]["export_scenario_results"]["Insert"];
  const { data: created, error: createError } = await supabase.from("export_scenario_results").upsert(insert, { onConflict: "scenario_id,calculation_version,evidence_hash", ignoreDuplicates: true }).select("*").maybeSingle();
  if (createError) throw new Error(createError.message);
  let stored = created;
  if (!stored) {
    const { data, error } = await supabase.from("export_scenario_results").select("*").eq("scenario_id", scenario.id).eq("calculation_version", LANDED_COST_VERSION).eq("evidence_hash", evidenceHash).single();
    if (error) throw new Error(error.message);
    stored = data;
  }
  const { error: updateError } = await supabase.from("export_scenarios").update({ status: "calculated", approval_status: pendingDocuments.length || !result.compliance.calculationComplete ? "needs_review" : "pending", approved_by: null, approved_at: null }).eq("id", scenario.id);
  if (updateError) throw new Error(updateError.message);
  return stored;
}

export async function createExchangeRateSnapshot(supabase: Client, input: unknown, userId: string) {
  const parsed = exchangeRateSnapshotSchema.parse(input);
  const { data, error } = await supabase.from("exchange_rate_snapshots").insert({ ...parsed, source_reference: parsed.source_reference || null, created_by: userId }).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function approveExportScenario(supabase: Client, scenarioId: string, userId: string, reason?: string) {
  const [{ data: latest, error: resultError }, { data: pending, error: documentsError }] = await Promise.all([
    supabase.from("export_scenario_results").select("*").eq("scenario_id", scenarioId).order("calculated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("export_scenario_documents").select("id").eq("scenario_id", scenarioId).eq("required", true).not("status", "in", "(verified,not_applicable)"),
  ]);
  if (resultError) throw new Error(resultError.message);
  if (documentsError) throw new Error(documentsError.message);
  if (!latest) throw new Error("Onay için önce senaryoyu hesaplayın.");
  const compliance = latest.compliance && typeof latest.compliance === "object" && !Array.isArray(latest.compliance) ? latest.compliance : {};
  if (compliance.calculationComplete !== true) throw new Error("Hesap uygunluk blokajları çözülmeden onaylanamaz.");
  if ((pending ?? []).length) throw new Error("Zorunlu belgeler doğrulanmadan senaryo onaylanamaz.");
  const { data, error } = await supabase.from("export_scenarios").update({ status: "approved", approval_status: "approved", approval_reason: reason?.trim() || null, approved_by: userId, approved_at: new Date().toISOString() }).eq("id", scenarioId).select("*").single();
  if (error) throw new Error(error.message);
  if (data.offer_id) await supabase.from("offers").update({ export_scenario_result_id: latest.id }).eq("id", data.offer_id);
  return data;
}

export async function updateScenarioDocument(supabase: Client, scenarioId: string, documentId: string, input: { status: "pending" | "received" | "verified" | "rejected" | "not_applicable"; notes?: string; evidence_reference?: string; document_issued_at?: string; valid_until?: string }, userId: string) {
  const { data, error } = await supabase.from("export_scenario_documents").update({
    status: input.status,
    notes: input.notes?.trim() || null,
    evidence_reference: input.evidence_reference?.trim() || null,
    document_issued_at: input.document_issued_at || null,
    valid_until: input.valid_until || null,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  }).eq("id", documentId).eq("scenario_id", scenarioId).select("*").single();
  if (error) throw new Error(error.message);
  await supabase.from("export_scenarios").update({ approval_status: "needs_review", approved_by: null, approved_at: null, status: "calculated" }).eq("id", scenarioId);
  return data;
}

export async function listExportScenarios(supabase: Client): Promise<ExportScenarioListItem[]> {
  const { data: scenarios, error } = await supabase.from("export_scenarios").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!scenarios?.length) return [];
  const ids = scenarios.map((scenario) => scenario.id);
  const [{ data: results, error: resultsError }, { data: documents, error: documentsError }] = await Promise.all([
    supabase.from("export_scenario_results").select("*").in("scenario_id", ids).order("calculated_at", { ascending: false }),
    supabase.from("export_scenario_documents").select("*").in("scenario_id", ids),
  ]);
  if (resultsError) throw new Error(resultsError.message);
  if (documentsError) throw new Error(documentsError.message);
  const latest = new Map<string, Result>();
  for (const result of results ?? []) if (!latest.has(result.scenario_id)) latest.set(result.scenario_id, result);
  return scenarios.map((scenario) => ({ ...scenario, latestResult: latest.get(scenario.id) ?? null, documents: (documents ?? []).filter((document) => document.scenario_id === scenario.id) }));
}

export async function getScenario(supabase: Client, id: string): Promise<Scenario> {
  const { data, error } = await supabase.from("export_scenarios").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

async function validateReferences(supabase: Client, ruleSetId: string | undefined, routeId: string | undefined, origin: string, destination: string) {
  if (ruleSetId) {
    const { data, error } = await supabase.from("export_rule_sets").select("*").eq("id", ruleSetId).single();
    if (error) throw new Error(error.message);
    if (data.status !== "active") throw new Error("Yalnız onaylanmış aktif kural seti senaryoya bağlanabilir.");
    if (data.origin_country_code && data.origin_country_code !== origin) throw new Error("Kural seti çıkış ülkesiyle eşleşmiyor.");
    if (data.destination_country_code && data.destination_country_code !== destination) throw new Error("Kural seti hedef ülkeyle eşleşmiyor.");
  }
  if (routeId) {
    const { data, error } = await supabase.from("export_routes").select("*").eq("id", routeId).eq("active", true).single();
    if (error) throw new Error(error.message);
    if (data.origin_country_code !== origin || data.destination_country_code !== destination) throw new Error("Rota çıkış/hedef ülkeleriyle eşleşmiyor.");
  }
}

function validateRuleSetForScenario(ruleSet: Database["public"]["Tables"]["export_rule_sets"]["Row"] | null, scenario: Scenario) {
  if (!ruleSet) return;
  if (ruleSet.status !== "active" || !ruleSet.approved_at) throw new Error("Kural seti aktif ve onaylı değil.");
  const today = new Date().toISOString().slice(0, 10);
  if (ruleSet.effective_from && ruleSet.effective_from > today) throw new Error("Kural seti henüz yürürlükte değil.");
  if (ruleSet.effective_to && ruleSet.effective_to < today) throw new Error("Kural setinin yürürlük süresi dolmuş.");
  if (ruleSet.origin_country_code && ruleSet.origin_country_code !== scenario.origin_country_code) throw new Error("Kural seti çıkış ülkesiyle eşleşmiyor.");
  if (ruleSet.destination_country_code && ruleSet.destination_country_code !== scenario.destination_country_code) throw new Error("Kural seti hedef ülkesiyle eşleşmiyor.");
  if (ruleSet.vehicle_category && ruleSet.vehicle_category !== scenario.vehicle_category) throw new Error("Kural seti araç kategorisiyle eşleşmiyor.");
  if (ruleSet.buyer_profile && ruleSet.buyer_profile !== scenario.buyer_profile) throw new Error("Kural seti alıcı profiliyle eşleşmiyor.");
}

async function syncScenarioDocuments(supabase: Client, scenario: Scenario, rawDocuments?: Json) {
  let documentsValue = rawDocuments;
  if (documentsValue === undefined && scenario.rule_set_id) {
    const { data } = await supabase.from("export_rule_sets").select("required_documents").eq("id", scenario.rule_set_id).maybeSingle();
    documentsValue = data?.required_documents;
  }
  const documents = readRequiredDocuments(documentsValue);
  if (!documents.length) return;
  const { error } = await supabase.from("export_scenario_documents").upsert(documents.map((document) => ({ scenario_id: scenario.id, document_code: document.code, label: document.label, required: document.required })), { onConflict: "scenario_id,document_code", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

function readRequiredDocuments(value: Json | undefined) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => item && typeof item === "object" && !Array.isArray(item) && typeof item.code === "string" && typeof item.label === "string" ? [{ code: item.code, label: item.label, required: item.required !== false }] : []);
}

function readManualCosts(value: Json): ManualCost[] {
  const parsed = exportScenarioSchema.shape.manual_costs.safeParse(value);
  if (!parsed.success) throw new Error("Senaryonun manuel maliyet snapshot'ı geçersiz.");
  return parsed.data;
}

function toRule(row: Database["public"]["Tables"]["export_rules"]["Row"]): ExportRule {
  return { id: row.id, code: row.rule_code, label: row.label, category: row.category, calculationType: row.calculation_type, baseKey: row.base_key, amount: row.amount, ratePercent: row.rate_percent, currency: row.currency, minimumAmount: row.minimum_amount, maximumAmount: row.maximum_amount, conditions: row.conditions && typeof row.conditions === "object" && !Array.isArray(row.conditions) ? row.conditions as Record<string, unknown> : {}, blocking: row.blocking, evidenceRequired: row.evidence_required, sortOrder: row.sort_order };
}

function toRate(row: Database["public"]["Tables"]["exchange_rate_snapshots"]["Row"]): ExchangeRate {
  return { id: row.id, baseCurrency: row.base_currency, quoteCurrency: row.quote_currency, rate: row.rate, provider: row.provider, observedAt: row.observed_at, sourceReference: row.source_reference };
}

function legacyCost(code: string, label: string, category: ManualCost["category"], amount: number, currency: string): ManualCost {
  return { code, label, category, amount, currency, evidence: "legacy_offer_migration" };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(",")}}`;
  return JSON.stringify(value);
}
