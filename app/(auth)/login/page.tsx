"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-paper px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,color-mix(in_srgb,var(--brand)_16%,transparent),transparent_36%),radial-gradient(circle_at_80%_90%,color-mix(in_srgb,var(--brand)_10%,transparent),transparent_32%)]" />
      <div className="absolute right-4 top-4"><ThemeToggle compact /></div>
      <form
        action={formAction}
        className="relative w-full max-w-md rounded-3xl border border-line-soft bg-surface/90 p-7 shadow-[0_24px_80px_rgba(9,11,18,0.14)] backdrop-blur-xl sm:p-10"
      >
        <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-brand font-serif text-base font-semibold text-white shadow-[0_8px_18px_rgba(45,63,224,0.18)]">
          V
        </span>
        <h1 className="mb-1 font-serif text-3xl font-semibold text-ink">Vehigo</h1>
        <p className="mb-8 text-sm leading-6 text-ink-faint">Avrupa’daki doğru aracı rakiplerinizden önce bulun ve ticaretini tek yerden yönetin.</p>

        <label className="mb-1 block text-sm font-medium text-ink-soft" htmlFor="email">
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mb-5 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink transition-colors focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
        />

        <label className="mb-1 block text-sm font-medium text-ink-soft" htmlFor="password">
          Şifre
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mb-5 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink transition-colors focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
        />

        {state.error ? (
          <p className="mb-4 text-sm text-danger" role="alert">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="min-h-12 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition-all hover:-translate-y-0.5 hover:bg-brand-ink active:translate-y-0 disabled:opacity-50"
        >
          {pending ? "Giriş yapılıyor..." : "Giriş yap"}
        </button>
      </form>
    </div>
  );
}
