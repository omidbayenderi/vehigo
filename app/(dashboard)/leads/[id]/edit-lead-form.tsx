"use client";

import { useActionState, useState } from "react";
import type { Database } from "@/lib/supabase/types";
import { updateLeadAction } from "../actions";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
const inputClass = "min-h-11 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export default function EditLeadForm({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateLeadAction.bind(null, lead.id), {});
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-md border border-line px-3 text-sm font-medium text-ink-soft hover:bg-surface-sunken">Düzenle</button>;
  return <form action={action} className="mb-6 space-y-4 rounded-lg border border-brand/30 bg-surface p-5">
    <h2 className="font-medium text-ink">Müşteriyi düzenle</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="İsim / Şirket" name="company_or_name" value={lead.company_or_name} required />
      <Field label="Şehir" name="city" value={lead.city} />
      <Field label="WhatsApp" name="phone_whatsapp" value={lead.phone_whatsapp} />
      <Field label="Telegram" name="telegram_handle" value={lead.telegram_handle} />
      <Field label="Instagram" name="instagram_handle" value={lead.instagram_handle} />
      <Field label="İşletme tipi" name="business_type" value={lead.business_type} />
      <Field label="İstenen araç tipi" name="desired_vehicle_type" value={lead.desired_vehicle_type} />
      <Field label="Min bütçe" name="budget_min" type="number" value={lead.budget_min} />
      <Field label="Max bütçe" name="budget_max" type="number" value={lead.budget_max} />
      <Field label="Para birimi" name="budget_currency" value={lead.budget_currency} required />
      <Field label="Ciddiyet skoru" name="seriousness_score" type="number" value={lead.seriousness_score} />
      <label className="text-sm"><span className="mb-1 block text-ink-soft">Durum</span><select name="status" defaultValue={lead.status} className={inputClass}>{["new","contacted","interested","vehicle_proposed","offer_sent","deposit_requested","in_progress","closed_won","closed_lost"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
      <label className="text-sm"><span className="mb-1 block text-ink-soft">Kaynak</span><select name="source" defaultValue={lead.source ?? ""} className={inputClass}><option value="">Seçin</option>{["instagram","telegram","divar","sheypoor","google_maps","referral","manual"].map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
    </div>
    <label className="block text-sm"><span className="mb-1 block text-ink-soft">Notlar</span><textarea name="notes" rows={3} defaultValue={lead.notes ?? ""} className={inputClass} /></label>
    <div className="flex gap-2"><button type="submit" disabled={pending} className="min-h-11 rounded-md bg-brand px-4 text-sm font-medium text-white disabled:opacity-50">{pending ? "Kaydediliyor..." : "Kaydet"}</button><button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-md border border-line px-4 text-sm">İptal</button></div>
    {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
  </form>;
}

function Field({ label, name, value, type = "text", required }: { label: string; name: string; value: string | number | null; type?: string; required?: boolean }) { return <label className="text-sm"><span className="mb-1 block text-ink-soft">{label}</span><input className={inputClass} name={name} type={type} defaultValue={value ?? ""} required={required} /></label>; }
