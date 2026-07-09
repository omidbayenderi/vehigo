"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Panel" },
  { href: "/vehicles", label: "Araçlar" },
  { href: "/leads", label: "Müşteriler" },
  { href: "/matches", label: "Eşleştirme" },
  { href: "/offers", label: "Teklifler" },
  { href: "/messages", label: "Mesajlar" },
  { href: "/alerts", label: "İlan alarmları" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={
              active
                ? "rounded-md bg-brand-wash px-3 py-2 text-sm font-medium text-brand-ink"
                : "rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-sunken hover:text-ink"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
