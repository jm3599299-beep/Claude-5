"use client";

import { useActionState } from "react";
import { publishWeeklyAction, reviewNewsAction, type AdminState } from "@/lib/actions/news-admin";

const init: AdminState = { ok: false, message: null };
const field = "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm";

export function NewsReviewForm({ a, categories, officialSource }: { a: { id: string; title: string; summary_es: string; category: string; label: string; review_notes: string | null }; categories: [string, string][]; officialSource: boolean }) {
  const [state, action, pending] = useActionState(reviewNewsAction, init);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={a.id} />
      <label className="block text-xs font-medium">Título en español<input name="title" defaultValue={a.title} className={`${field} mt-1`} /></label>
      <label className="block text-xs font-medium">Resumen en español (solo con datos de la fuente)<textarea name="summary" rows={4} defaultValue={/pendiente de resumen/i.test(a.summary_es) ? "" : a.summary_es} className={`${field} mt-1`} /></label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium">Categoría
          <select name="category" defaultValue={a.category} className={`${field} mt-1`}>{categories.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select>
        </label>
        <label className="text-xs font-medium">Tipo
          <select name="label" defaultValue={a.label} className={`${field} mt-1`}>
            {officialSource && <option value="official">Oficial</option>}
            <option value="analysis">Análisis</option><option value="rumor">Rumor</option><option value="leak">Filtración</option>
          </select>
        </label>
      </div>
      <input name="notes" placeholder="Notas de revisión (internas)" defaultValue={a.review_notes ?? ""} className={field} />
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="publish" disabled={pending} className="rounded-lg bg-success px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">Aprobar y publicar</button>
        <button name="decision" value="save" disabled={pending} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold">Guardar</button>
        <button name="decision" value="reject" disabled={pending} className="rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">Rechazar</button>
      </div>
      {state.message && <p role="status" className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
    </form>
  );
}

export function WeeklyApproveForm({ id, intro }: { id: string; intro: string }) {
  const [state, action, pending] = useActionState(publishWeeklyAction, init);
  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="id" value={id} />
      <textarea name="intro" rows={3} defaultValue={intro} className={field} />
      <button disabled={pending} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg disabled:opacity-60">Publicar Weekly</button>
      {state.message && <p role="status" className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
    </form>
  );
}
