import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

const navItems = [
  { href: "/dashboard", label: "Panel" },
  { href: "/vehicles", label: "Araçlar" },
  { href: "/leads", label: "Müşteriler" },
  { href: "/matches", label: "Eşleştirme" },
  { href: "/offers", label: "Teklifler" },
  { href: "/messages", label: "Mesajlar" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-4">
          <span className="text-lg font-semibold text-zinc-900">Vehigo</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-200 p-3">
          <p className="mb-2 truncate px-1 text-xs text-zinc-500">{user?.email}</p>
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Çıkış yap
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-zinc-50 p-6">{children}</main>
    </div>
  );
}
