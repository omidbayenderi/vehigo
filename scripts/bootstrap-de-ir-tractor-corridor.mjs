import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--apply")) {
  throw new Error("Canli kayit olusturmak icin --apply bayragi gerekli.");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: owners, error: ownerError } = await supabase
  .from("users_profile")
  .select("id,role")
  .eq("role", "owner");

if (ownerError) throw ownerError;
if (owners.length !== 1) {
  throw new Error(`Tam olarak bir owner bekleniyordu; bulunan: ${owners.length}.`);
}

const ownerId = owners[0].id;
const checkedAt = "2026-07-13T00:00:00.000Z";

const { data: route, error: routeError } = await supabase
  .from("export_routes")
  .upsert(
    {
      code: "DE-IR-ROAD",
      name: "Almanya - İran karayolu",
      origin_country_code: "DE",
      destination_country_code: "IR",
      transit_country_codes: [],
      transport_mode: "road",
      default_currency: "EUR",
      assumptions: {
        transit_route_status: "unverified",
        transit_route_note:
          "Transit ülkeleri taşıyıcı teklifi ve yaptırım kontrolü tamamlanmadan sabitlenmez.",
      },
      active: true,
      created_by: ownerId,
    },
    { onConflict: "code" },
  )
  .select("id,code")
  .single();

if (routeError) throw routeError;

const requiredDocuments = [
  { code: "vehicle_identity_vin", label: "VIN ve araç kimlik belgeleri", required: true },
  { code: "vehicle_classification", label: "Çekici sınıfı ile HS/CN sınıflandırma kanıtı", required: true },
  { code: "purchase_invoice", label: "Satın alma faturası veya satış sözleşmesi", required: true },
  { code: "eori", label: "Geçerli EORI kaydı", required: true },
  { code: "atlas_export_mrn", label: "ATLAS ihracat beyannamesi ve MRN", required: true },
  { code: "bafa_classification", label: "BAFA ihracat kontrol sınıflandırması", required: true },
  { code: "bafa_license_or_basis", label: "Gerekliyse BAFA lisansı veya lisans gerekmeme dayanağı", required: true },
  { code: "end_use_statement", label: "Alıcı ve son kullanım beyanı", required: true },
  { code: "sanctions_screening", label: "Alıcı, son kullanıcı, banka ve taşıyıcı yaptırım taraması", required: true },
  { code: "iran_import_eligibility", label: "İran ithalat uygunluğu ve sipariş kayıt belgesi", required: true },
  { code: "iran_customs_tariff", label: "IRICA veya yetkili müşavirden güncel tarife ve vergi teyidi", required: true },
  { code: "iran_standards_environment", label: "İran standart ve çevre uygunluk onayları", required: true },
  { code: "scrappage_eligibility", label: "Yenileme programı kullanılıyorsa hurda araç uygunluk kanıtı", required: false },
  { code: "bank_payment_compliance", label: "Banka ve ödeme kanalı uygunluk teyidi", required: true },
  { code: "transport_insurance_quote", label: "Rota, taşıma ve sigorta teklifi", required: true },
];

const { data: ruleSet, error: ruleSetError } = await supabase
  .from("export_rule_sets")
  .upsert(
    {
      code: "DE-IR-TRACTOR",
      name: "Almanya - İran çekici ihracatı",
      version: 1,
      status: "active",
      origin_country_code: "DE",
      destination_country_code: "IR",
      vehicle_category: "tractor_unit",
      buyer_profile: "commercial",
      effective_from: "2026-07-13",
      effective_to: null,
      source_references: [
        {
          label: "Alman Gümrüğü - motorlu araç ihracatı",
          url: "https://www.zoll.de/DE/Privatpersonen/Reisen/Reisen-nach-Deutschland-aus-einem-nicht-eu-Staat/Zoll-und-Steuern/Kauf-von-Kraftfahrzeugen/kauf-von-kraftfahrzeugen.html",
          checked_at: checkedAt,
        },
        {
          label: "BAFA - İran ambargosu ve ihracat kontrolü",
          url: "https://www.bafa.de/DE/Aussenwirtschaft/Ausfuhrkontrolle/Embargos/Iran/iran_node.html",
          checked_at: checkedAt,
        },
        {
          label: "BAFA - İran kısıtlayıcı tedbirleri",
          url: "https://www.bafa.de/DE/Aussenwirtschaft/Ausfuhrkontrolle/Embargos/Iran/Restriktive_Massnahmen_Iran/restriktive_massnahmen_iran.html",
          checked_at: checkedAt,
        },
        {
          label: "EUR-Lex - Konsey Tüzüğü (AB) 2025/1975",
          url: "https://eur-lex.europa.eu/eli/reg/2025/1975/oj",
          checked_at: checkedAt,
        },
      ],
      assumptions: {
        vehicle_scope:
          "Yalnız teknik belgelerle tractor_unit olduğu doğrulanan araçlar için kullanılabilir.",
        iran_tariff_status:
          "Güncel IRICA tarife ve vergi oranı doğrulanmadı; sayısal gümrük kuralı tanımlanmadı.",
        cost_policy:
          "Taşıma, sigorta, gümrük, hizmet ve banka maliyetleri kaynak belgesiyle manuel girilir.",
        sanctions_policy:
          "Taraf, son kullanım, banka ve taşıyıcı taraması her işlem tarihinde yeniden yapılır.",
        approval_policy:
          "Tüm zorunlu belgeler doğrulanmadan senaryo onaylanamaz.",
      },
      required_documents: requiredDocuments,
      created_by: ownerId,
      approved_by: ownerId,
      approved_at: new Date().toISOString(),
    },
    { onConflict: "code,version" },
  )
  .select("id,code,version,status")
  .single();

if (ruleSetError) throw ruleSetError;

console.log(
  JSON.stringify({
    owner_id: ownerId,
    route,
    rule_set: ruleSet,
    numeric_rules: 0,
    required_documents: requiredDocuments.length,
  }),
);
