import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listMessageDrafts } from "@/lib/services/messages";

const statusLabel: Record<string, string> = {
  draft: "Taslak",
  approved: "Onaylandı",
  sent: "Gönderildi",
  discarded: "İptal Edildi",
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
      <h1 className="mb-6 text-2xl font-serif font-semibold text-ink">Mesaj taslakları</h1>
      <p className="mb-4 text-sm text-ink-faint">
        Bu sistem hiçbir mesajı otomatik göndermez — her mesaj onaylandıktan sonra elle kopyalanıp
        gönderilir.
      </p>
      <div className="overflow-hidden rounded-lg border border-line-soft bg-white">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase text-ink-faint">
            <tr>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Kanal</th>
              <th className="px-4 py-3">Önizleme</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {drafts?.map((draft) => (
              <tr key={draft.id} className="hover:bg-paper">
                <td className="px-4 py-3">
                  <Link href={`/messages/${draft.id}`} prefetch={false} className="font-medium text-ink hover:underline">
                    {new Date(draft.created_at).toLocaleDateString("tr-TR")}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-soft">{channelLabel[draft.channel ?? ""] ?? draft.channel}</td>
                <td className="max-w-xs truncate px-4 py-3 text-ink-soft">{draft.draft_text}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-surface-sunken px-2 py-1 text-xs text-ink-soft">
                    {statusLabel[draft.status] ?? draft.status}
                  </span>
                </td>
              </tr>
            ))}
            {drafts?.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ink-faint">
                  Henüz mesaj taslağı yok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
