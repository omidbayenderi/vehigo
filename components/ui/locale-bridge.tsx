"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { translateToFa } from "@/lib/i18n/fa";

export type AppLocale = "tr" | "fa";
const LocaleContext = createContext<{ locale: AppLocale; setLocale: (locale: AppLocale) => void }>({
  locale: "tr",
  setLocale: () => {},
});

export function useAppLocale() {
  return useContext(LocaleContext);
}

export function LocaleBridge({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(() =>
    typeof document !== "undefined" && document.documentElement.lang === "fa" ? "fa" : "tr"
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
    if (locale !== "fa") return;

    let queued = false;
    const translatePage = () => {
      queued = false;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
      for (const node of textNodes) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script,style,code,pre,[data-no-translate]")) continue;
        const translated = translateToFa(node.data);
        if (translated !== node.data) node.data = translated;
      }

      for (const element of document.querySelectorAll<HTMLElement>("[placeholder],[title],[aria-label]")) {
        if (element.closest("[data-no-translate]")) continue;
        for (const attribute of ["placeholder", "title", "aria-label"]) {
          const current = element.getAttribute(attribute);
          if (!current) continue;
          const translated = translateToFa(current);
          if (translated !== current) element.setAttribute(attribute, translated);
        }
      }
    };

    const schedule = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(translatePage);
    };
    translatePage();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}
