"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/lib/actions/auth";

const input = "h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export function AuthForm({ mode, action, next }: { mode: "login" | "register"; action: (s: FormState, f: FormData) => Promise<FormState>; next: string }) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: null });
  const register = mode === "register";
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {/* Honeypot: hidden from people, tempting for bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Sitio web <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">Correo electrónico</label>
        <input id="email" name="email" type="email" required autoComplete="email" className={input} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">Contraseña</label>
        <input id="password" name="password" type="password" required minLength={10} autoComplete={register ? "new-password" : "current-password"} className={input} />
        {register && <p className="mt-1 text-xs text-fg-muted">Mínimo 10 caracteres.</p>}
      </div>
      {register && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="accept" className="mt-1" required />
          <span>
            Acepto las <Link href="/normas" className="text-primary hover:underline">normas de la comunidad</Link>: opiniones reales, sin spam ni contenido
            ofensivo.
          </span>
        </label>
      )}
      {state.message && (
        <p role="status" className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-success/12 text-success" : "bg-danger/12 text-danger"}`}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg transition hover:opacity-90 disabled:opacity-60">
        {pending ? "Un momento…" : register ? "Crear cuenta" : "Entrar"}
      </button>
    </form>
  );
}
