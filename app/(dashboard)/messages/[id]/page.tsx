import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DraftDetail from "./draft-detail";

export default async function MessageDraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: draft, error } = await supabase.from("message_drafts").select("*").eq("id", id).single();
  if (error || !draft) notFound();

  const { data: lead } = await supabase.from("leads").select("*").eq("id", draft.lead_id).single();

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Mesaj taslağı — {lead?.company_or_name}</h1>
      <DraftDetail draft={draft} />
    </div>
  );
}
