import { LogOut, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { logout } from "./actions";
import NavLinks from "./nav-links";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: ownerMembership } = user ? await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .eq("status", "active")
    .limit(1)
    .maybeSingle() : { data: null };
  const isOwner = Boolean(ownerMembership);
  const initial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-paper md:flex-row">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line-soft bg-surface/90 px-4 py-3 backdrop-blur-xl md:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          <LanguageToggle compact persist />
          <ThemeToggle compact />
          <details className="group relative">
            <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-line bg-surface text-ink-soft hover:bg-surface-sunken" aria-label="Menüyü aç">
              <Menu className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 top-13 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
              <NavLinks mobile isOwner={isOwner} />
              <div className="border-t border-line-soft p-3">
                <p className="mb-2 truncate px-3 text-xs text-ink-faint">{user?.email}</p>
                <form action={logout}><LogoutButton /></form>
              </div>
            </div>
          </details>
        </div>
      </header>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line-soft bg-surface md:flex">
        <div className="border-b border-line-soft px-4 py-4">
          <Brand />
        </div>
        <NavLinks isOwner={isOwner} />
        <div className="border-t border-line-soft p-3">
          <LanguageToggle persist />
          <ThemeToggle />
          <div className="mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-wash text-xs font-semibold text-brand-ink">
              {initial}
            </span>
            <p className="truncate text-xs text-ink-faint">{user?.email}</p>
          </div>
          <form action={logout}><LogoutButton /></form>
        </div>
      </aside>
      <main id="main-content" className="min-w-0 flex-1 bg-paper px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[1500px]">{children}</div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
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
  );
}

function LogoutButton() {
  return (
    <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-ink-soft transition-colors hover:bg-danger-wash hover:text-danger">
      <LogOut className="h-4 w-4" strokeWidth={1.75} />
      Çıkış yap
    </button>
  );
}
