"use client";

import { useTransition } from "react";
import { toggleWatchlistAction } from "./actions";

export default function WatchlistToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleWatchlistAction(id, !active))}
      className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-sunken disabled:opacity-50"
    >
      {active ? "Durdur" : "Aktifleştir"}
    </button>
  );
}
