import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listMessageDrafts } from "@/lib/services/messages";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cardClass, pillClasses, type PillTone } from "@/lib/ui";

const statusLabel: Record<string, string> = {
  draft: "Taslak",
  approved: "Onaylandı",
  sent: "Gönderildi",
  discarded: "İptal Edildi",
};

const statusTone: Record<string, PillTone> = {
  draft: "neutral",
  approved: "brand",
  sent: "success",
  discarded: "danger",
};

const channelLabel: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
};

export default async function MessagesPage() {
  const supabase = await createClient();
  const drafts = await listMessageDrafts(supabase);

  return (
    <div>
      <PageHeader
        eyebrow="İletişim"
        title="Mesaj taslakları"
        description="Bu sistem hiçbir mesajı otomatik göndermez — her mesaj onaylandıktan sonra elle kopyalanıp gönderilir."
      />
      <div className={`overflow-hidden ${cardClass}`}>
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Kanal</th>
              <th className="px-4 py-3">Önizleme</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {drafts?.map((draft) => (
              <tr key={draft.id} className="transition-colors hover:bg-surface-sunken">
                <td className="px-4 py-3">
                  <Link href={`/messages/${draft.id}`} prefetch={false} className="font-medium text-ink hover:underline">
                    {new Date(draft.created_at).toLocaleDateString("tr-TR")}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-soft">{channelLabel[draft.channel ?? ""] ?? draft.channel}</td>
                <td className="max-w-xs truncate px-4 py-3 text-ink-soft">{draft.draft_text}</td>
                <td className="px-4 py-3">
                  <span className={pillClasses(statusTone[draft.status])}>
                    {statusLabel[draft.status] ?? draft.status}
                  </span>
                </td>
              </tr>
            ))}
            {drafts?.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState icon={MessageCircle} title="Henüz mesaj taslağı yok" description="Bir teklif onaylandığında mesaj taslağı oluşturabilirsiniz." />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
