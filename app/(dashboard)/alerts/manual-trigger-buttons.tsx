"use client";

import { useActionState } from "react";
import { RefreshCw, Send } from "lucide-react";
import { runScannerNowAction, sendDigestNowAction, type FormState } from "./actions";

const initialState: FormState = {};

export default function ManualTriggerButtons({ canRunScanner }: { canRunScanner: boolean }) {
  const [scanState, scanAction, scanPending] = useActionState(runScannerNowAction, initialState);
  const [digestState, digestAction, digestPending] = useActionState(sendDigestNowAction, initialState);

  return (
    <div className="p-5">
      <h2 className="mb-1 text-sm font-medium text-ink">Manuel çalıştırma</h2>
      <p className="mb-4 text-sm text-ink-faint">
        {canRunScanner
          ? "Otomatik taramayı beklemeden şimdi çalıştırın veya bekleyen yeni eşleşmeleri Telegram’a gönderin."
          : "Bekleyen yeni eşleşmeleri Telegram’a şimdi gönderin."}
      </p>
      <div className="flex flex-wrap gap-2">
        {canRunScanner ? <form action={scanAction}>
          <button
            type="submit"
            disabled={scanPending}
            className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${scanPending ? "animate-spin" : ""}`} strokeWidth={1.75} />
            {scanPending ? "Taranıyor..." : "Şimdi tara"}
          </button>
        </form> : null}
        <form action={digestAction}>
          <button
            type="submit"
            disabled={digestPending}
            className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-50"
          >
            <Send className="h-4 w-4" strokeWidth={1.75} />
            {digestPending ? "Gönderiliyor..." : "Özet gönder"}
          </button>
        </form>
      </div>
      {scanState.error ? <p className="mt-3 text-sm text-danger">{scanState.error}</p> : null}
      {scanState.ok ? <p className="mt-3 text-sm text-success">{scanState.ok}</p> : null}
      {digestState.error ? <p className="mt-3 text-sm text-danger">{digestState.error}</p> : null}
      {digestState.ok ? <p className="mt-3 text-sm text-success">{digestState.ok}</p> : null}
    </div>
  );
}
