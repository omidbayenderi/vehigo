import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { updateScenarioDocument } from "@/lib/services/export-scenarios";

const schema = z.object({
  status: z.enum(["pending", "received", "verified", "rejected", "not_applicable"]),
  notes: z.string().trim().max(2000).optional(),
  evidence_reference: z.string().trim().max(2000).optional(),
  document_issued_at: z.string().date().optional(),
  valid_until: z.string().date().optional(),
}).superRefine((value, context) => {
  if (value.status === "verified" && (!value.evidence_reference || value.evidence_reference.length < 3)) {
    context.addIssue({ code: "custom", path: ["evidence_reference"], message: "Doğrulama için kanıt URL’si veya belge numarası gerekli." });
  }
  if (["rejected", "not_applicable"].includes(value.status) && (!value.notes || value.notes.length < 3)) {
    context.addIssue({ code: "custom", path: ["notes"], message: "Bu karar için açıklama gerekli." });
  }
  if (value.document_issued_at && value.valid_until && value.valid_until < value.document_issued_at) {
    context.addIssue({ code: "custom", path: ["valid_until"], message: "Geçerlilik tarihi düzenlenme tarihinden önce olamaz." });
  }
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz belge durumu." }, { status: 400 });
  if (["verified", "not_applicable"].includes(parsed.data.status)) {
    const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
    if (profile?.role !== "owner") return NextResponse.json({ error: "Belge incelemesini yalnız owner sonuçlandırabilir." }, { status: 403 });
  }
  const { id, documentId } = await params;
  try { return NextResponse.json({ document: await updateScenarioDocument(supabase, id, documentId, parsed.data, user.id) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Belge güncellenemedi." }, { status: 400 }); }
}
