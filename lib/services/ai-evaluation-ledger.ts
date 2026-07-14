import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import type { IntelligenceSnapshot } from "./market-intelligence";

type Client = SupabaseClient<Database>;
const MARKET_PROMPT_VERSION = "market-review-v1";

export async function runAiMarketReview(supabase: Client, userId: string, snapshot: IntelligenceSnapshot) {
  const model = process.env.OPENAI_MARKET_MODEL ?? "gpt-5.6-luna";
  const inputEvidence = {
    snapshotId: snapshot.id,
    analysisVersion: snapshot.analysis_version,
    evidenceHash: snapshot.evidence_hash,
    sampleQuality: snapshot.sample_quality,
    claimEligible: snapshot.claim_eligible,
    comparableCount: snapshot.comparable_count,
    sourceCount: snapshot.source_count,
    distribution: snapshot.distribution,
    underpricingPercent: snapshot.underpricing_percent,
    riskScore: snapshot.risk_score,
    riskLevel: snapshot.risk_level,
    riskSignals: snapshot.risk_signals,
    priceTrend: snapshot.price_trend,
  };
  const { data: ledger, error: ledgerError } = await supabase.from("ai_evaluations").insert({
    user_id: userId,
    listing_id: snapshot.listing_id,
    intelligence_snapshot_id: snapshot.id,
    evaluation_type: "market_review",
    status: "pending",
    model,
    prompt_version: MARKET_PROMPT_VERSION,
    input_evidence: inputEvidence as unknown as Json,
  }).select("*").single();
  if (ledgerError) throw new Error(ledgerError.message);

  if (!snapshot.claim_eligible) return finishSkipped(supabase, ledger.id, "Örneklem kalitesi ticari yorum için yeterli değil.");
  if (!process.env.OPENAI_API_KEY) return finishSkipped(supabase, ledger.id, "OPENAI_API_KEY tanımlı değil; deterministik analiz korunuyor.");
  const spent = await currentMonthSpend(supabase);
  const hardLimit = Number.parseFloat(process.env.OPENAI_MONTHLY_BUDGET_USD ?? "10");
  if (spent >= hardLimit) return finishSkipped(supabase, ledger.id, `Aylık AI sert limiti doldu ($${hardLimit.toFixed(2)}).`);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        input: [
          { role: "system", content: "You are a conservative vehicle market evidence reviewer. Use only supplied evidence. Never declare a seller trustworthy, a vehicle damage-free, or a transaction legally safe. State uncertainty and require human review." },
          { role: "user", content: JSON.stringify(inputEvidence) },
        ],
        text: { format: { type: "json_schema", name: "market_review", strict: true, schema: { type: "object", additionalProperties: false, properties: { summary: { type: "string" }, cautions: { type: "array", items: { type: "string" } }, confidence: { type: "number", minimum: 0, maximum: 1 }, human_review_required: { type: "boolean" } }, required: ["summary", "cautions", "confidence", "human_review_required"] } } },
        max_output_tokens: 700,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => null) as OpenAIResponse | null;
    if (!response.ok || !payload) throw new Error(`OpenAI HTTP ${response.status}`);
    const outputText = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new Error("Yapılandırılmış cevap üretilmedi.");
    const output = JSON.parse(outputText) as { summary: string; cautions: string[]; confidence: number; human_review_required: boolean };
    const inputTokens = payload.usage?.input_tokens ?? 0;
    const outputTokens = payload.usage?.output_tokens ?? 0;
    const inputRate = Number.parseFloat(process.env.OPENAI_INPUT_USD_PER_MILLION ?? "1");
    const outputRate = Number.parseFloat(process.env.OPENAI_OUTPUT_USD_PER_MILLION ?? "6");
    const costUsd = (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
    const { data, error } = await supabase.from("ai_evaluations").update({
      status: "completed",
      output: output as unknown as Json,
      confidence: output.confidence,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      provider_response_id: payload.id ?? null,
      human_decision: output.human_review_required ? "needs_review" : "pending",
    }).eq("id", ledger.id).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI değerlendirmesi başarısız.";
    const { data, error: updateError } = await supabase.from("ai_evaluations").update({ status: "failed", error: message }).eq("id", ledger.id).select("*").single();
    if (updateError) throw new Error(updateError.message);
    return data;
  }
}

export async function recordAiHumanDecision(supabase: Client, evaluationId: string, userId: string, decision: "accepted" | "rejected" | "needs_review", reason?: string) {
  const { data, error } = await supabase.from("ai_evaluations").update({ human_decision: decision, human_decision_reason: reason?.trim() || null, reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", evaluationId).eq("user_id", userId).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("AI değerlendirmesi bulunamadı veya erişim izni yok.");
  return data;
}

export async function runAiDamageReview(supabase: Client, userId: string, snapshot: IntelligenceSnapshot) {
  const model = process.env.OPENAI_DAMAGE_MODEL ?? process.env.OPENAI_MARKET_MODEL ?? "gpt-5.6-luna";
  const images = await listAllowedDamageReviewImages(supabase, snapshot.listing_id);
  const inputEvidence = { snapshotId: snapshot.id, evidenceHash: snapshot.evidence_hash, images: images.map((image) => ({ url: image.image_url, rightsStatus: image.rights_status, rightsSource: image.rights_source, checkedAt: image.checked_at })) };
  const { data: ledger, error: ledgerError } = await supabase.from("ai_evaluations").insert({ user_id: userId, listing_id: snapshot.listing_id, intelligence_snapshot_id: snapshot.id, evaluation_type: "damage_review", status: "pending", model, prompt_version: "damage-review-v1", input_evidence: inputEvidence as unknown as Json }).select("*").single();
  if (ledgerError) throw new Error(ledgerError.message);
  if (images.length === 0) return finishSkipped(supabase, ledger.id, "Analiz izni verilmiş görsel bulunmuyor.");
  if (!process.env.OPENAI_API_KEY) return finishSkipped(supabase, ledger.id, "OPENAI_API_KEY tanımlı değil.");
  const spent = await currentMonthSpend(supabase);
  const hardLimit = Number.parseFloat(process.env.OPENAI_MONTHLY_BUDGET_USD ?? "10");
  if (spent >= hardLimit) return finishSkipped(supabase, ledger.id, `Aylık AI sert limiti doldu ($${hardLimit.toFixed(2)}).`);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content: [
          { type: "input_text", text: "Review only visible vehicle-condition evidence. Do not diagnose hidden damage or declare the vehicle safe. Separate observations from uncertainty and require professional inspection." },
          ...images.slice(0, 8).map((image) => ({ type: "input_image", image_url: image.image_url })),
        ] }],
        text: { format: { type: "json_schema", name: "damage_review", strict: true, schema: { type: "object", additionalProperties: false, properties: { summary: { type: "string" }, visible_observations: { type: "array", items: { type: "string" } }, limitations: { type: "array", items: { type: "string" } }, confidence: { type: "number", minimum: 0, maximum: 1 }, professional_inspection_required: { type: "boolean" } }, required: ["summary", "visible_observations", "limitations", "confidence", "professional_inspection_required"] } } },
        max_output_tokens: 900,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const payload = await response.json().catch(() => null) as OpenAIResponse | null;
    if (!response.ok || !payload) throw new Error(`OpenAI HTTP ${response.status}`);
    const outputText = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new Error("Görsel inceleme yapılandırılmış cevap üretmedi.");
    const output = JSON.parse(outputText) as { summary: string; confidence: number };
    const inputTokens = payload.usage?.input_tokens ?? 0;
    const outputTokens = payload.usage?.output_tokens ?? 0;
    const costUsd = (inputTokens * Number.parseFloat(process.env.OPENAI_INPUT_USD_PER_MILLION ?? "1") + outputTokens * Number.parseFloat(process.env.OPENAI_OUTPUT_USD_PER_MILLION ?? "6")) / 1_000_000;
    const { data, error } = await supabase.from("ai_evaluations").update({ status: "completed", output: output as unknown as Json, confidence: output.confidence, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd, provider_response_id: payload.id ?? null, human_decision: "needs_review" }).eq("id", ledger.id).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Görsel inceleme başarısız.";
    const { data, error: updateError } = await supabase.from("ai_evaluations").update({ status: "failed", error: message }).eq("id", ledger.id).select("*").single();
    if (updateError) throw new Error(updateError.message);
    return data;
  }
}

export async function listAllowedDamageReviewImages(supabase: Client, listingId: string) {
  const { data, error } = await supabase.from("listing_media_rights").select("image_url,rights_status,rights_source,checked_at").eq("listing_id", listingId).eq("analysis_allowed", true).in("rights_status", ["source_permitted", "partner_authorized", "user_authorized"]);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function finishSkipped(supabase: Client, id: string, errorMessage: string) {
  const { data, error } = await supabase.from("ai_evaluations").update({ status: "skipped", error: errorMessage }).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

async function currentMonthSpend(supabase: Client) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase.from("ai_evaluations").select("cost_usd").gte("created_at", start.toISOString()).limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + row.cost_usd, 0);
}

type OpenAIResponse = { id?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; usage?: { input_tokens?: number; output_tokens?: number } };
