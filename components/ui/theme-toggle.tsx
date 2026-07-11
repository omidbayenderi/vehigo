"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setDark(document.documentElement.classList.contains("dark"));
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("vehigo-theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"}
      title={dark ? "Açık tema" : "Koyu tema"}
      className={compact
        ? "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
        : "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"}
    >
      {ready && dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact ? <span>{ready && dark ? "Açık tema" : "Koyu tema"}</span> : null}
    </button>
  );
}
