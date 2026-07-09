"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex flex-1 items-center justify-center bg-paper px-4">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-xl border border-line-soft bg-white p-8 shadow-sm"
      >
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
          className="mb-4 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
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
          className="mb-4 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />

        {state.error ? (
          <p className="mb-4 text-sm text-danger" role="alert">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
        >
          {pending ? "Giriş yapılıyor..." : "Giriş yap"}
        </button>
      </form>
    </div>
  );
}
