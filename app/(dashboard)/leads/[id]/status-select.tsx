"use client";

import { useTransition } from "react";
import { changeLeadStatusAction } from "../actions";
import type { LeadStatus } from "@/lib/supabase/types";

const statusOptions: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "Yeni" },
  { value: "contacted", label: "İletişime Geçildi" },
  { value: "interested", label: "İlgileniyor" },
  { value: "vehicle_proposed", label: "Araç Önerildi" },
  { value: "offer_sent", label: "Teklif Gönderildi" },
  { value: "deposit_requested", label: "Kapora İstendi" },
  { value: "in_progress", label: "İşlemde" },
  { value: "closed_won", label: "Kazanıldı" },
  { value: "closed_lost", label: "Kaybedildi" },
];

export default function StatusSelect({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) =>
        startTransition(() => {
          changeLeadStatusAction(leadId, e.target.value as LeadStatus);
        })
      }
      className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-50"
    >
      {statusOptions.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
