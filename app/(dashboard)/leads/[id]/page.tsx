import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLead } from "@/lib/services/leads";
import { PageHeader } from "@/components/ui/page-header";
import { cardClass, pillClasses, type PillTone } from "@/lib/ui";
import StatusSelect from "./status-select";
import NoteForm from "./note-form";
import EditLeadForm from "./edit-lead-form";
import DeleteEntityButton from "@/components/ui/delete-entity-button";
import { deleteLeadAction } from "../actions";

const activityLabel: Record<string, string> = {
  note: "Not",
  status_change: "Durum Değişikliği",
  manual_contact: "Manuel İletişim",
  offer_sent: "Teklif Gönderildi",
};

const activityTone: Record<string, PillTone> = {
  note: "neutral",
  status_change: "brand",
  manual_contact: "warning",
  offer_sent: "success",
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
      <PageHeader
        eyebrow="Müşteri"
        title={lead.company_or_name}
        actions={
          <>
            <Link
              href={`/matches?lead_id=${lead.id}`}
              prefetch={false}
              className="rounded-md border border-line px-3 py-2 text-sm transition-colors hover:bg-surface-sunken"
            >
              Uygun araçları göster
            </Link>
            <StatusSelect leadId={lead.id} status={lead.status} />
            <DeleteEntityButton label={lead.company_or_name} action={deleteLeadAction.bind(null, lead.id)} />
          </>
        }
      />

      <EditLeadForm lead={lead} />

      <div className={`mb-6 grid grid-cols-2 gap-4 ${cardClass} p-6 text-sm`}>
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
            <p className="text-xs text-ink-faint">Notlar</p>
            <p className="text-ink">{lead.notes}</p>
          </div>
        ) : null}
      </div>

      <div className={`${cardClass} p-6`}>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Aktivite geçmişi</h2>
        <div className="mb-4">
          <NoteForm leadId={lead.id} />
        </div>
        <ul className="space-y-2">
          {lead.activity.map((a) => (
            <li key={a.id} className="border-b border-line-soft pb-2 text-sm last:border-0">
              <span className={`mr-2 ${pillClasses(activityTone[a.activity_type ?? ""])}`}>
                {activityLabel[a.activity_type ?? ""] ?? a.activity_type}
              </span>
              <span className="text-ink-soft">{a.detail}</span>
              <span className="ml-2 text-xs text-ink-faint">
                {new Date(a.created_at).toLocaleString("tr-TR")}
              </span>
            </li>
          ))}
          {lead.activity.length === 0 ? (
            <li className="text-sm text-ink-faint">Henüz aktivite yok.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="text-ink">{value || "-"}</p>
    </div>
  );
}
