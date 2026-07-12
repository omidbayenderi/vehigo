"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteMatchAction, updateMatchAction } from "./actions";

export default function MatchManager({ id, score }: { id: string; score: number | null }) {
  const [updateState, updateAction, updating] = useActionState(updateMatchAction.bind(null, id), {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteMatchAction.bind(null, id), {});
  return <div className="flex flex-col items-end gap-2">
    <form action={updateAction} className="flex items-center gap-2"><label className="text-xs text-ink-faint">Skor <input name="match_score" type="number" min="0" max="100" defaultValue={score ?? 0} className="ml-1 min-h-11 w-20 rounded-md border border-line px-2 text-sm" /></label><button disabled={updating} className="min-h-11 rounded-md border border-line px-3 text-xs font-medium hover:bg-surface-sunken">Güncelle</button></form>
    <form action={deleteAction} onSubmit={(event) => { if (!window.confirm("Bu eşleştirme silinsin mi?")) event.preventDefault(); }}><button disabled={deleting} className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-xs font-medium text-danger hover:bg-danger/5"><Trash2 size={14} />Sil</button></form>
    {updateState.error || deleteState.error ? <p role="alert" className="text-xs text-danger">{updateState.error ?? deleteState.error}</p> : null}
    {updateState.ok || deleteState.ok ? <p aria-live="polite" className="text-xs text-success">{updateState.ok ?? deleteState.ok}</p> : null}
  </div>;
}
