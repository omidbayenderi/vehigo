import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { LocaleBridge } from "@/components/ui/locale-bridge";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Vehigo",
  description: "Avrupa genelinde kârlı araç fırsatlarını bulma ve ticaretini yönetme platformu",
};

const themeScript = `(() => { try { const saved = localStorage.getItem('vehigo-theme'); const dark = saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.classList.toggle('dark', dark); const locale = localStorage.getItem('vehigo-locale') === 'fa' ? 'fa' : 'tr'; document.documentElement.lang = locale; document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr'; } catch {} })();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      dir="ltr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        <Script id="vehigo-preferences" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body className="flex min-h-full flex-col">
        <LocaleBridge>{children}</LocaleBridge>
        <footer className="px-4 py-3 text-center text-xs text-ink-faint">
          Web discovery powered by{" "}
          <a href="https://brave.com/search/api/" target="_blank" rel="noreferrer" className="underline hover:text-ink">
            Brave Search API
          </a>
        </footer>
      </body>
    </html>
  );
}
