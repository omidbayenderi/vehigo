"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  Users,
  GitCompareArrows,
  FileText,
  MessageCircle,
  BellRing,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/vehicles", label: "Araçlar", icon: Truck },
  { href: "/leads", label: "Müşteriler", icon: Users },
  { href: "/matches", label: "Eşleştirme", icon: GitCompareArrows },
  { href: "/offers", label: "Teklifler", icon: FileText },
  { href: "/messages", label: "Mesajlar", icon: MessageCircle },
  { href: "/alerts", label: "İlan alarmları", icon: BellRing },
];

export default function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={mobile ? "grid gap-1 p-3" : "flex flex-1 flex-col gap-1 p-3"} aria-label="Ana navigasyon">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={
              active
                ? "flex min-h-11 items-center gap-3 rounded-xl bg-brand-wash px-3 text-sm font-semibold text-brand-ink"
                : "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
            }
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
