import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import NavLinks from "./nav-links";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const initial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex flex-1 bg-paper">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line-soft bg-surface">
        <div className="flex items-center gap-2.5 border-b border-line-soft px-4 py-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand font-serif text-sm font-semibold text-white shadow-[0_8px_18px_rgba(45,63,224,0.18)]">
            V
          </span>
          <div>
            <span className="block font-serif text-lg font-semibold leading-none text-ink">Vehigo</span>
            <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              Market Ops
            </span>
          </div>
        </div>
        <NavLinks />
        <div className="border-t border-line-soft p-3">
          <div className="mb-2 flex items-center gap-2.5 rounded-md px-1 py-1">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-wash text-xs font-semibold text-brand-ink">
              {initial}
            </span>
            <p className="truncate text-xs text-ink-faint">{user?.email}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Çıkış yap
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-paper p-6">{children}</main>
    </div>
  );
}
