"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { clearAllAlertsAction, deleteAlertsAction } from "./actions";

type SelectionContextValue = {
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const clear = () => setSelected(new Set());
  return <SelectionContext.Provider value={{ selected, toggle, clear }}>{children}</SelectionContext.Provider>;
}

export function AlertCheckbox({ alertId }: { alertId: string }) {
  const ctx = useContext(SelectionContext);
  if (!ctx) return null;
  return (
    <input
      type="checkbox"
      checked={ctx.selected.has(alertId)}
      onChange={() => ctx.toggle(alertId)}
      aria-label="İlanı seç"
      className="h-4 w-4 shrink-0 rounded border-line text-brand focus:ring-brand"
    />
  );
}

export function SelectionToolbar({ allIds }: { allIds: string[] }) {
  const ctx = useContext(SelectionContext);
  const [pending, startTransition] = useTransition();
  if (!ctx || allIds.length === 0) return null;
  const { selected, clear } = ctx;

  const deleteSelected = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`${ids.length} ilan fırsat akışından silinsin mi?`)) return;
    startTransition(async () => {
      const result = await deleteAlertsAction(ids);
      if (result.error) window.alert(result.error);
      else clear();
    });
  };

  const clearAll = () => {
    if (!window.confirm(`Fırsat akışındaki tüm ${allIds.length} ilan silinsin mi? Bu işlem geri alınamaz.`)) return;
    startTransition(async () => {
      const result = await clearAllAlertsAction();
      if (result.error) window.alert(result.error);
      else clear();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || selected.size === 0}
        onClick={deleteSelected}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-danger/30 px-3 text-xs font-medium text-danger hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 size={14} aria-hidden="true" /> Seçilenleri sil{selected.size > 0 ? ` (${selected.size})` : ""}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={clearAll}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-danger/30 px-3 text-xs font-medium text-danger hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 size={14} aria-hidden="true" /> Tümünü temizle
      </button>
    </div>
  );
}
