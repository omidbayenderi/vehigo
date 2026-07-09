import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLead } from "@/lib/services/leads";
import StatusSelect from "./status-select";
import NoteForm from "./note-form";

const activityLabel: Record<string, string> = {
  note: "Not",
  status_change: "Durum Değişikliği",
  manual_contact: "Manuel İletişim",
  offer_sent: "Teklif Gönderildi",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  let lead;
  try {
    lead = await getLead(supabase, id);
  } catch {
    notFound();
  }
  if (!lead) notFound();

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">{lead.company_or_name}</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/matches?lead_id=${lead.id}`}
            prefetch={false}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100"
          >
            Uygun araçları göster
          </Link>
          <StatusSelect leadId={lead.id} status={lead.status} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 bg-white p-6 text-sm">
        <InfoRow label="Şehir" value={lead.city} />
        <InfoRow label="WhatsApp" value={lead.phone_whatsapp} />
        <InfoRow label="Telegram" value={lead.telegram_handle} />
        <InfoRow label="Instagram" value={lead.instagram_handle} />
        <InfoRow label="İstenen araç tipi" value={lead.desired_vehicle_type} />
        <InfoRow
          label="Bütçe"
          value={`${lead.budget_min ?? "?"} - ${lead.budget_max ?? "?"} ${lead.budget_currency}`}
        />
        <InfoRow label="Kaynak" value={lead.source} />
        <InfoRow label="Ciddiyet skoru" value={String(lead.seriousness_score)} />
        {lead.notes ? (
          <div className="col-span-2">
            <p className="text-xs text-zinc-500">Notlar</p>
            <p className="text-zinc-900">{lead.notes}</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-medium text-zinc-700">Aktivite geçmişi</h2>
        <div className="mb-4">
          <NoteForm leadId={lead.id} />
        </div>
        <ul className="space-y-2">
          {lead.activity.map((a) => (
            <li key={a.id} className="border-b border-zinc-100 pb-2 text-sm last:border-0">
              <span className="mr-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                {activityLabel[a.activity_type ?? ""] ?? a.activity_type}
              </span>
              <span className="text-zinc-700">{a.detail}</span>
              <span className="ml-2 text-xs text-zinc-400">
                {new Date(a.created_at).toLocaleString("tr-TR")}
              </span>
            </li>
          ))}
          {lead.activity.length === 0 ? (
            <li className="text-sm text-zinc-500">Henüz aktivite yok.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-zinc-900">{value || "-"}</p>
    </div>
  );
}
