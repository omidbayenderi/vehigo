import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

const ruleSchema = z.object({
  rule_code: z.string().trim().min(1).max(80).regex(/^[a-z0-9_\-]+$/i),
  label: z.string().trim().min(1).max(160),
  category: z.enum(["tax", "customs", "logistics", "insurance", "service", "compliance", "other"]),
  calculation_type: z.enum(["fixed", "percentage"]),
  base_key: z.enum(["vehicle_price", "customs_value", "subtotal"]).optional(),
  amount: z.number().min(0).optional(),
  rate_percent: z.number().min(0).max(1000).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  minimum_amount: z.number().min(0).optional(),
  maximum_amount: z.number().min(0).optional(),
  conditions: z.record(z.string(), z.unknown()).default({}),
  blocking: z.boolean().default(false),
  evidence_required: z.boolean().default(true),
  sort_order: z.number().int().default(0),
}).superRefine((rule, context) => {
  if (rule.calculation_type === "fixed" && (rule.amount === undefined || !rule.currency)) context.addIssue({ code: "custom", message: "Sabit kural tutar ve para birimi gerektirir." });
  if (rule.calculation_type === "percentage" && (rule.rate_percent === undefined || !rule.base_key)) context.addIssue({ code: "custom", message: "Yüzde kuralı oran ve hesap tabanı gerektirir." });
});

const schema = z.object({
  code: z.string().trim().min(1).max(80).regex(/^[a-z0-9_\-]+$/i),
  name: z.string().trim().min(2).max(160),
  version: z.number().int().positive(),
  activate: z.boolean().default(false),
  origin_country_code: z.string().regex(/^[A-Z]{2}$/).optional(),
  destination_country_code: z.string().regex(/^[A-Z]{2}$/).optional(),
  vehicle_category: z.string().trim().max(80).optional(),
  buyer_profile: z.string().trim().max(80).optional(),
  effective_from: z.string().date().optional(),
  effective_to: z.string().date().optional(),
  source_references: z.array(z.object({ label: z.string().min(1).max(160), url: z.string().url(), checked_at: z.string().datetime({ offset: true }) })).max(50),
  assumptions: z.record(z.string(), z.unknown()).default({}),
  required_documents: z.array(z.object({ code: z.string().regex(/^[a-z0-9_\-]+$/i), label: z.string().min(1).max(160), required: z.boolean().default(true) })).max(100).default([]),
  rules: z.array(ruleSchema).max(200).default([]),
}).superRefine((value, context) => {
  if (value.activate && value.source_references.length === 0) context.addIssue({ code: "custom", path: ["source_references"], message: "Aktif kural seti en az bir kaynak referansı gerektirir." });
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data, error } = await supabase.from("export_rule_sets").select("*").order("created_at", { ascending: false });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ruleSets: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
  if (profile?.role !== "owner") return NextResponse.json({ error: "Kural setini yalnız hesap yöneticisi oluşturabilir." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz kural seti." }, { status: 400 });
  const { rules, activate, ...set } = parsed.data;
  const { data: created, error } = await supabase.from("export_rule_sets").insert({ ...set, status: activate ? "active" : "draft", source_references: set.source_references as unknown as Json, assumptions: set.assumptions as Json, required_documents: set.required_documents as unknown as Json, created_by: user.id, approved_by: activate ? user.id : null, approved_at: activate ? new Date().toISOString() : null }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (rules.length) {
    const { error: rulesError } = await supabase.from("export_rules").insert(rules.map((rule) => ({ ...rule, rule_set_id: created.id, conditions: rule.conditions as Json })));
    if (rulesError) {
      await supabase.from("export_rule_sets").delete().eq("id", created.id);
      return NextResponse.json({ error: rulesError.message }, { status: 400 });
    }
  }
  return NextResponse.json({ ruleSet: created }, { status: 201 });
}
