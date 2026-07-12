import { BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfitReport } from "@/lib/services/offers";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cardClass, pillClasses } from "@/lib/ui";

export default async function ReportsPage() {
  const supabase = await createClient();
  const rows = await getProfitReport(supabase);

  const totals = rows.reduce(
    (acc, row) => ({
      won: acc.won + row.wonCount,
      lost: acc.lost + row.lostCount,
      expected: acc.expected + row.expectedProfitSum,
      realized: acc.realized + row.realizedProfitSum,
    }),
    { won: 0, lost: 0, expected: 0, realized: 0 },
  );

  return (
    <div>
      <PageHeader
        eyebrow="Raporlama"
        title="Kâr raporu"
        description="Kapatılan işlemlerde beklenen kâr (komisyon hesabı) ile gerçekleşen kârı ülke, kaynak ve model bazında karşılaştırın."
      />

      {rows.length > 0 ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <Stat label="Kazanılan" value={String(totals.won)} />
          <Stat label="Kaybedilen" value={String(totals.lost)} />
          <Stat label="Beklenen kâr toplamı" value={totals.expected.toLocaleString("tr-TR")} />
          <Stat
            label="Gerçekleşen kâr toplamı"
            value={totals.realized.toLocaleString("tr-TR")}
            tone={totals.realized >= totals.expected ? "success" : "danger"}
          />
        </div>
      ) : null}

      <div className={`overflow-x-auto ${cardClass}`}>
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3">Ülke</th>
              <th className="px-4 py-3">Kaynak</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Kazanılan / Kaybedilen</th>
              <th className="px-4 py-3">Beklenen kâr</th>
              <th className="px-4 py-3">Gerçekleşen kâr</th>
              <th className="px-4 py-3">Fark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-surface-sunken">
                <td className="px-4 py-3 text-ink-soft">{row.country}</td>
                <td className="px-4 py-3 text-ink-soft">{row.source}</td>
                <td className="px-4 py-3 font-medium text-ink">{row.model}</td>
                <td className="px-4 py-3 text-ink-soft">
                  {row.wonCount} / {row.lostCount}
                </td>
                <td className="px-4 py-3 text-ink-soft">{row.expectedProfitSum.toLocaleString("tr-TR")}</td>
                <td className="px-4 py-3 font-medium text-ink">{row.realizedProfitSum.toLocaleString("tr-TR")}</td>
                <td className="px-4 py-3">
                  <span className={pillClasses(row.variance >= 0 ? "success" : "danger")}>
                    {row.variance >= 0 ? "+" : ""}
                    {row.variance.toLocaleString("tr-TR")}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={BarChart3}
                    title="Henüz kapatılmış işlem yok"
                    description="Bir teklifin sonucunu (kazanıldı/kaybedildi) kaydettiğinizde burada raporlanır."
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className={`${cardClass} p-4`}>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}
