"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";

export default function DeleteEntityButton({ label, action }: { label: string; action: (state: { error?: string }, formData: FormData) => Promise<{ error?: string }> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} onSubmit={(event) => { if (!window.confirm(`${label} kalıcı olarak silinsin mi?`)) event.preventDefault(); }}>
    <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-danger/30 px-3 text-sm font-medium text-danger hover:bg-danger/5 disabled:opacity-50"><Trash2 size={16} />{pending ? "Siliniyor..." : "Sil"}</button>
    {state.error ? <p role="alert" className="mt-2 text-xs text-danger">{state.error}</p> : null}
  </form>;
}
