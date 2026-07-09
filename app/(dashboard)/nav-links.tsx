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

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-3">
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
                ? "flex items-center gap-2.5 rounded-md border-l-2 border-brand bg-brand-wash py-2 pl-2.5 pr-3 text-sm font-medium text-brand-ink"
                : "flex items-center gap-2.5 rounded-md border-l-2 border-transparent py-2 pl-2.5 pr-3 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
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
