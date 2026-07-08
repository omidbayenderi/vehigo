"use client";

import { useActionState, useRef } from "react";
import { addLeadNoteAction, type FormState } from "../actions";

const initialState: FormState = {};

export default function NoteForm({ leadId }: { leadId: string }) {
  const action = addLeadNoteAction.bind(null, leadId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex gap-2"
    >
      <input
        name="note"
        placeholder="Not ekle..."
        required
        className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50"
      >
        Ekle
      </button>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
