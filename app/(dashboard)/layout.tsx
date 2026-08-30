import { Building2, LogOut, Menu, Sparkles } from "lucide-react";
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

      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-white/10 bg-[#0b1220] text-white shadow-[18px_0_50px_rgba(16,24,40,0.08)] md:flex">
        <div className="px-5 pb-4 pt-5">
          <Brand dark />
        </div>
        <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.055] px-3 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white shadow-lg shadow-brand/20"><Building2 className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">Vehigo Workspace</p><p className="mt-0.5 text-[10px] text-slate-400">Avrupa · Canlı operasyon</p></div>
          <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
        </div>
        <NavLinks isOwner={isOwner} />
        <div className="border-t border-white/10 p-3">
          <LanguageToggle persist />
          <ThemeToggle />
          <div className="mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
              {initial}
            </span>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
          </div>
          <form action={logout}><LogoutButton /></form>
        </div>
      </aside>
      <main id="main-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9 xl:px-12">
        <div className="mx-auto w-full max-w-[1500px]">{children}</div>
      </main>
    </div>
  );
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#6382ff] to-[#3157d5] font-serif text-sm font-semibold text-white shadow-[0_8px_24px_rgba(49,87,213,0.3)]">
            <span className="absolute inset-x-1 top-1 h-px bg-white/50" />V
          </span>
          <div>
            <span className={`block font-serif text-lg font-semibold leading-none ${dark ? "text-white" : "text-ink"}`}>Vehigo</span>
            <span className={`mt-1 block text-[11px] font-medium uppercase tracking-[0.14em] ${dark ? "text-slate-500" : "text-ink-faint"}`}>
              Intelligence OS
            </span>
          </div>
    </div>
  );
}

function LogoutButton() {
  return (
    <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
      <LogOut className="h-4 w-4" strokeWidth={1.75} />
      Çıkış yap
    </button>
  );
}
