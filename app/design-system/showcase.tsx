"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}

const palette = [
  { name: "Marka / Aksiyon", hex: "#2D3FE0", var: "--color-brand" },
  { name: "Mürekkep", hex: "#0F1222", var: "--color-ink" },
  { name: "Zemin", hex: "#FAF9F7", var: "--color-paper", border: true },
  { name: "Onaylandı", hex: "#15803D", var: "--color-success" },
  { name: "Beklemede", hex: "#B45309", var: "--color-warning" },
  { name: "Risk", hex: "#B91C1C", var: "--color-danger" },
];

function Swatch({ name, hex, border }: { name: string; hex: string; border?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(hex).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="group text-left"
    >
      <div
        className={`h-20 rounded-xl transition-transform duration-300 group-hover:scale-[1.03] ${border ? "border border-line" : ""}`}
        style={{ backgroundColor: hex }}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{name}</span>
        <span className="font-mono text-xs text-ink-faint">{copied ? "kopyalandı" : hex}</span>
      </div>
    </button>
  );
}

export default function DesignSystemShowcase() {
  return (
    <div className="bg-paper">
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2"><LanguageToggle compact /><ThemeToggle compact /></div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#0c1020] text-white">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]" aria-hidden="true">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #7c8bff, transparent 70%)" }}
        />
        <div className="relative mx-auto flex max-w-5xl flex-col gap-8 px-6 py-28 sm:py-36">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-ink" style={{ color: "#a9b3ff" }}>
            Vehigo · Tasarım Sistemi
          </span>
          <h1 className="max-w-3xl font-serif text-5xl font-semibold leading-[1.08] sm:text-7xl">
            Sessiz güven duyan bir iş aracı.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed" style={{ color: "#c3c7dc" }}>
            Avrupa genelinde otomobilden ağır vasıtaya kadar doğru fırsatı bulmak, değerlendirmek ve
            ticaretini yönetmek için tasarlanmış modern operasyon platformu. Bu sayfa, sistemin renk,
            tipografi ve bileşen dilini gösteriyor.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Link
              href="/login"
              className="rounded-md bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-ink"
            >
              Uygulamaya giriş yap →
            </Link>
            <a href="#palet" className="text-sm font-medium text-white/70 hover:text-white">
              Sistemi incele ↓
            </a>
          </div>
        </div>
      </section>

      {/* PALETTE */}
      <section id="palet" className="mx-auto max-w-5xl px-6 py-24">
        <Reveal className="mb-10 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-brand">Renk</span>
          <h2 className="font-serif text-3xl font-semibold text-ink">Kısıtlı palet, anlamlı roller</h2>
          <p className="max-w-2xl text-sm text-ink-faint">
            Lacivert-indigo tek marka rengi olarak aksiyon ve aktif durumlarda kullanılır. Bir renge tıkla,
            hex kodunu kopyala.
          </p>
        </Reveal>
        <Reveal>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {palette.map((s) => (
              <Swatch key={s.hex} name={s.name} hex={s.hex} border={s.border} />
            ))}
          </div>
        </Reveal>
      </section>

      {/* TYPE */}
      <section className="border-y border-line-soft bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <Reveal className="mb-10 flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-brand">Tipografi</span>
            <h2 className="font-serif text-3xl font-semibold text-ink">Fraunces başlıkta, Geist her yerde</h2>
            <p className="max-w-2xl text-sm text-ink-faint">
              Serif başlık nadir ve kasıtlı kullanılır. Gövde, tablo ve formlarda her zaman Geist; rakamlar
              tabular hizalı.
            </p>
          </Reveal>
          <Reveal className="divide-y divide-line-soft">
            <div className="flex flex-col gap-2 py-6 sm:flex-row sm:items-baseline sm:gap-8">
              <span className="w-28 shrink-0 text-xs uppercase tracking-wide text-ink-faint">Başlık</span>
              <span className="font-serif text-4xl font-semibold text-ink">
                Teklif — Ahmadi Trading Co.
              </span>
            </div>
            <div className="flex flex-col gap-2 py-6 sm:flex-row sm:items-baseline sm:gap-8">
              <span className="w-28 shrink-0 text-xs uppercase tracking-wide text-ink-faint">Gövde</span>
              <span className="max-w-xl text-base leading-relaxed text-ink">
                Uyumluluk kontrol listesi tamamlanmadan PDF üretilemez; bu, ihracat mevzuatına uyumu garanti
                eden tasarım kararıdır.
              </span>
            </div>
            <div className="flex flex-col gap-2 py-6 sm:flex-row sm:items-baseline sm:gap-8">
              <span className="w-28 shrink-0 text-xs uppercase tracking-wide text-ink-faint">Veri</span>
              <span className="font-variant-numeric-tabular text-base text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
                45.000 EUR · 350.000 km · 2019
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* MOCKUPS */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <Reveal className="mb-10 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-brand">Uygulama</span>
          <h2 className="font-serif text-3xl font-semibold text-ink">Gerçek ekranlar</h2>
        </Reveal>

        <Reveal className="mb-6 overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-sm">
          <div className="border-b border-line-soft px-6 py-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Panel</span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-4">
            {[
              ["Aktif müşteri", "18"],
              ["Açık teklif", "6"],
              ["Beklenen komisyon", "24.500"],
              ["Uygun araç", "32 / 41"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line-soft p-4">
                <p className="text-xs text-ink-faint">{label}</p>
                <p className="mt-1 font-serif text-2xl font-semibold text-ink">{value}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="mb-6 overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-sm">
          <div className="border-b border-line-soft px-6 py-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Araçlar</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-6 py-3 font-semibold">Marka / Model</th>
                <th className="px-6 py-3 font-semibold">Yıl</th>
                <th className="px-6 py-3 font-semibold">Fiyat</th>
                <th className="px-6 py-3 font-semibold">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              <tr>
                <td className="px-6 py-3 font-medium text-ink">Mercedes-Benz Actros</td>
                <td className="px-6 py-3 text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>2019</td>
                <td className="px-6 py-3 text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>45.000 EUR</td>
                <td className="px-6 py-3">
                  <span className="rounded-full bg-success-wash px-2.5 py-1 text-xs font-semibold text-success">
                    Uygun
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </Reveal>

        <Reveal className="overflow-hidden rounded-2xl border border-success bg-success-wash p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full bg-success px-3 py-1.5 text-xs font-semibold text-white">
                ✓ Onaylandı
              </span>
              <p className="text-sm font-medium text-success">
                Tüm uyumluluk kontrolleri tamam — PDF üretilebilir.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FOOTER CTA */}
      <section className="border-t border-line-soft bg-surface">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-6 py-20">
          <h2 className="font-serif text-3xl font-semibold text-ink">Kullanmaya hazır.</h2>
          <Link
            href="/login"
            className="rounded-md bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-ink"
          >
            Uygulamaya giriş yap →
          </Link>
        </div>
      </section>
    </div>
  );
}
