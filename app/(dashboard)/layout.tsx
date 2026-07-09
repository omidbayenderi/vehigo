import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import NavLinks from "./nav-links";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line-soft bg-white">
        <div className="border-b border-line-soft px-4 py-4">
          <span className="text-lg font-serif font-semibold text-ink">Vehigo</span>
        </div>
        <NavLinks />
        <div className="border-t border-line-soft p-3">
          <p className="mb-2 truncate px-1 text-xs text-ink-faint">{user?.email}</p>
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-surface-sunken"
            >
              Çıkış yap
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-paper p-6">{children}</main>
    </div>
  );
}
