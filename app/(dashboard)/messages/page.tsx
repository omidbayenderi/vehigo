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
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Mesaj taslakları</h1>
      <p className="mb-4 text-sm text-zinc-500">
        Bu sistem hiçbir mesajı otomatik göndermez — her mesaj onaylandıktan sonra elle kopyalanıp
        gönderilir.
      </p>
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Kanal</th>
              <th className="px-4 py-3">Önizleme</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {drafts?.map((draft) => (
              <tr key={draft.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link href={`/messages/${draft.id}`} prefetch={false} className="font-medium text-zinc-900 hover:underline">
                    {new Date(draft.created_at).toLocaleDateString("tr-TR")}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600">{channelLabel[draft.channel ?? ""] ?? draft.channel}</td>
                <td className="max-w-xs truncate px-4 py-3 text-zinc-600">{draft.draft_text}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                    {statusLabel[draft.status] ?? draft.status}
                  </span>
                </td>
              </tr>
            ))}
            {drafts?.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
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
