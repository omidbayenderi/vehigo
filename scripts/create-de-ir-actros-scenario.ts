import { createAdminClient } from "@/lib/supabase/admin";
import { calculateExportScenario, createExportScenario } from "@/lib/services/export-scenarios";

if (!process.argv.includes("--apply")) {
  throw new Error("Canli senaryo olusturmak icin --apply bayragi gerekli.");
}

async function main() {
const supabase = createAdminClient();
const scenarioName = "Actros 2019 · DE-IR çekici kabul senaryosu";

const [{ data: owners, error: ownerError }, { data: route, error: routeError }, { data: ruleSet, error: ruleSetError }, { data: vehicles, error: vehicleError }] = await Promise.all([
  supabase.from("users_profile").select("id").eq("role", "owner"),
  supabase.from("export_routes").select("id").eq("code", "DE-IR-ROAD").eq("active", true).single(),
  supabase.from("export_rule_sets").select("id").eq("code", "DE-IR-TRACTOR").eq("version", 1).eq("status", "active").single(),
  supabase.from("vehicles").select("id,brand,model,year,price,currency").ilike("model", "%Actros%"),
]);

if (ownerError) throw ownerError;
if (routeError) throw routeError;
if (ruleSetError) throw ruleSetError;
if (vehicleError) throw vehicleError;
if (owners.length !== 1) throw new Error(`Tam olarak bir owner bekleniyordu; bulunan: ${owners.length}.`);
if (vehicles.length !== 1) throw new Error(`Tam olarak bir Actros kaydi bekleniyordu; bulunan: ${vehicles.length}.`);

const ownerId = owners[0].id;
const vehicle = vehicles[0];

const { data: existing, error: existingError } = await supabase
  .from("export_scenarios")
  .select("*")
  .eq("name", scenarioName)
  .maybeSingle();

if (existingError) throw existingError;

const scenario = existing ?? await createExportScenario(supabase, {
  name: scenarioName,
  vehicle_id: vehicle.id,
  route_id: route.id,
  rule_set_id: ruleSet.id,
  origin_country_code: "DE",
  destination_country_code: "IR",
  transport_mode: "road",
  vehicle_category: "tractor_unit",
  buyer_profile: "commercial",
  calculation_currency: "EUR",
  vehicle_price: vehicle.price ?? 0,
  vehicle_currency: vehicle.currency,
  manual_costs: [],
  assumptions: {
    acceptance_key: "de-ir-actros-2019-v1",
    vehicle_origin_status: "unverified",
    vehicle_origin_note: "Araç kaydındaki satıcı ülkesi boş; DE çıkışı fatura ve araç konum belgesiyle doğrulanmalı.",
    vehicle_category_status: "unverified",
    vehicle_category_note: "Actros kaydı genel truck sınıfında; tractor_unit teknik belgeyle doğrulanmalı.",
    manual_cost_status: "pending_quotes",
    manual_cost_note: "Taşıma, sigorta, gümrük ve banka maliyetleri doğrulanmış teklif gelince eklenecek.",
  },
}, ownerId);

const result = await calculateExportScenario(supabase, scenario.id, ownerId);
const { data: documents, error: documentsError } = await supabase
  .from("export_scenario_documents")
  .select("required,status")
  .eq("scenario_id", scenario.id);

if (documentsError) throw documentsError;

console.log(JSON.stringify({
  scenario: {
    id: scenario.id,
    name: scenario.name,
    vehicle_id: scenario.vehicle_id,
    created: !existing,
  },
  result: {
    id: result.id,
    calculation_version: result.calculation_version,
    evidence_hash: result.evidence_hash,
    totals: result.totals,
    sensitivity: result.sensitivity,
    compliance: result.compliance,
  },
  documents: {
    total: documents.length,
    required: documents.filter((document) => document.required).length,
    verified: documents.filter((document) => document.status === "verified").length,
  },
}));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Senaryo olusturulamadi.");
  process.exitCode = 1;
});
