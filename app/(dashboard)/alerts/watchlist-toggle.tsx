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
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
    >
      {active ? "Durdur" : "Aktifleştir"}
    </button>
  );
}
