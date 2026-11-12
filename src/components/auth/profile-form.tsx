"use client";

import { useActionState } from "react";
import { updateProfileAction, type FormState } from "@/lib/actions/auth";

const field = "h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm focus:border-primary focus:outline-none";

export function ProfileForm({ displayName, username }: { displayName: string; username: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, { ok: false, message: null });
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium">
        Nombre visible
        <input name="displayName" required minLength={2} maxLength={60} defaultValue={displayName} className={`${field} mt-1`} />
      </label>
      <label className="block text-sm font-medium">
        Nombre de usuario (opcional)
        <input name="username" pattern="[a-z0-9_]{3,24}" defaultValue={username} className={`${field} mt-1`} />
      </label>
      {state.message && <p role="status" className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
      <button disabled={pending} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg disabled:opacity-60">Guardar</button>
    </form>
  );
}
