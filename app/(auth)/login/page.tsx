"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-paper px-4">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/3 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-brand-wash), transparent 70%)" }}
      />
      <form
        action={formAction}
        className="relative w-full max-w-sm rounded-xl border border-line-soft bg-white p-8 shadow-[0_1px_2px_rgba(23,24,43,0.04),0_8px_24px_rgba(23,24,43,0.06)]"
      >
        <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-brand font-serif text-base font-semibold text-white">
          V
        </span>
        <h1 className="mb-1 text-xl font-serif font-semibold text-ink">Vehigo</h1>
        <p className="mb-6 text-sm text-ink-faint">Araç ihracat komisyonculuğu iç aracı</p>

        <label className="mb-1 block text-sm font-medium text-ink-soft" htmlFor="email">
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mb-4 w-full rounded-md border border-line px-3 py-2 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
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
          className="mb-4 w-full rounded-md border border-line px-3 py-2 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />

        {state.error ? (
          <p className="mb-4 text-sm text-danger" role="alert">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ink active:scale-[0.99] disabled:opacity-50"
        >
          {pending ? "Giriş yapılıyor..." : "Giriş yap"}
        </button>
      </form>
    </div>
  );
}
