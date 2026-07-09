"use client";

import { useTransition } from "react";
import { toggleComplianceFieldAction } from "./actions";
import { cardClass } from "@/lib/ui";
import type { Database } from "@/lib/supabase/types";

type Compliance = Database["public"]["Tables"]["compliance_checklist"]["Row"];

export type ComplianceField =
  | "export_legality_checked"
  | "sanctioned_entity_check_done"
  | "vehicle_category_allowed"
  | "documents_checked"
  | "customs_partner_confirmed"
  | "payment_method_agreed"
  | "buyer_identity_verified";

const fields: { key: ComplianceField; label: string }[] = [
  { key: "export_legality_checked", label: "İhracat yasallığı kontrol edildi" },
  { key: "sanctioned_entity_check_done", label: "Yaptırım listesi kontrolü yapıldı" },
  { key: "vehicle_category_allowed", label: "Araç kategorisi izinli" },
  { key: "documents_checked", label: "Belgeler kontrol edildi" },
  { key: "customs_partner_confirmed", label: "Gümrük partneri onaylandı" },
  { key: "payment_method_agreed", label: "Ödeme yöntemi üzerinde anlaşıldı" },
  { key: "buyer_identity_verified", label: "Alıcı kimliği doğrulandı" },
];

export default function ComplianceChecklist({ offerId, compliance }: { offerId: string; compliance: Compliance }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className={`${cardClass} p-6`}>
      <h2 className="mb-3 text-sm font-medium text-ink-soft">Uyumluluk kontrol listesi</h2>
      <ul className="space-y-2">
        {fields.map((f) => (
          <li key={f.key} className="flex items-center gap-2">
            <input
              type="checkbox"
              id={f.key}
              defaultChecked={compliance[f.key]}
              disabled={pending}
              onChange={(e) =>
                startTransition(() => {
                  toggleComplianceFieldAction(offerId, f.key, e.target.checked);
                })
              }
              className="h-4 w-4 rounded border-line"
            />
            <label htmlFor={f.key} className="text-sm text-ink-soft">
              {f.label}
            </label>
          </li>
        ))}
      </ul>
      {compliance.all_clear ? (
        <div className="mt-4 flex items-center gap-3 rounded-md border border-success bg-success-wash px-4 py-3">
          <span className="flex items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-white">
            ✓ Onaylandı
          </span>
          <p className="text-sm font-medium text-success">Tüm kontroller tamam — PDF üretilebilir.</p>
        </div>
      ) : (
        <p className="mt-4 text-sm font-medium text-warning">
          PDF üretmeden önce tüm kutular işaretlenmeli.
        </p>
      )}
    </div>
  );
}
