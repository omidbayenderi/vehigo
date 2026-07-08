"use client";

import { useActionState, useRef, useState } from "react";
import { importVehiclesCsvAction, type ImportState } from "./actions";

const initialState: ImportState = {};

export default function ImportCsvForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(importVehiclesCsvAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
      >
        CSV içe aktar
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
          <p className="mb-2 text-xs text-zinc-500">
            Sütunlar: brand, model, year, mileage_km, price, currency, vehicle_type, condition, notes...
          </p>
          <form ref={formRef} action={formAction}>
            <input
              type="file"
              name="file"
              accept=".csv"
              required
              className="mb-3 w-full text-sm"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {pending ? "İçe aktarılıyor..." : "Yükle"}
            </button>
          </form>
          {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
          {state.report ? (
            <div className="mt-2 text-sm">
              <p className="text-green-700">{state.report.inserted} araç eklendi.</p>
              {state.report.errors.length > 0 ? (
                <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-red-600">
                  {state.report.errors.map((e, i) => (
                    <li key={i}>
                      Satır {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
