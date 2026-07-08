"use client";

import { useTransition } from "react";
import { toggleComplianceFieldAction } from "./actions";
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
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h2 className="mb-3 text-sm font-medium text-zinc-700">Uyumluluk kontrol listesi</h2>
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
              className="h-4 w-4 rounded border-zinc-300"
            />
            <label htmlFor={f.key} className="text-sm text-zinc-700">
              {f.label}
            </label>
          </li>
        ))}
      </ul>
      <p className={`mt-4 text-sm font-medium ${compliance.all_clear ? "text-green-700" : "text-amber-700"}`}>
        {compliance.all_clear
          ? "Tüm kontroller tamam — PDF üretilebilir."
          : "PDF üretmeden önce tüm kutular işaretlenmeli."}
      </p>
    </div>
  );
}
