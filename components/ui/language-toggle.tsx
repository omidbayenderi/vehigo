"use client";

import { Languages } from "lucide-react";
import { useAppLocale } from "./locale-bridge";

export function LanguageToggle({ compact = false, persist = false }: { compact?: boolean; persist?: boolean }) {
  const { locale, setLocale } = useAppLocale();
  const next = locale === "fa" ? "tr" : "fa";
  const label = locale === "fa" ? "Türkçe" : "فارسی";

  function switchLanguage() {
    localStorage.setItem("vehigo-locale", next);
    if (persist) {
      import("@/app/(dashboard)/user-locale-actions").then(({ updateUserLocaleAction }) => {
        void updateUserLocaleAction(next);
      });
    }
    if (next === "fa") setLocale("fa");
    else window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      aria-label={locale === "fa" ? "تغییر زبان به ترکی" : "Farsça diline geç"}
      className={compact
        ? "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
        : "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"}
    >
      <Languages className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
