"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitReviewAction, uploadPhotoAction, type ActionState } from "@/lib/actions/community";
import { EXPERIENCE_TAGS } from "@/lib/community/validation";

const init: ActionState = { ok: false, message: null };
const field = "w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export interface OwnReview {
  rating: number;
  title: string;
  body: string;
  experience_tags: string[];
  usage_months: number | null;
  observed_temp_c: number | null;
  observed_battery_h: number | null;
  variant_id: string | null;
  status: string;
}

export function ReviewForm({ modelId, modelSlug, variants, own }: { modelId: string; modelSlug: string; variants: { id: string; name: string }[]; own: OwnReview | null }) {
  const [state, action, pending] = useActionState(submitReviewAction, init);
  const [rating, setRating] = useState(own?.rating ?? 0);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="modelSlug" value={modelSlug} />
      <input type="hidden" name="rating" value={rating || ""} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" className="hidden" aria-hidden="true" />
      {own && (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-muted">
          Ya publicaste una reseña de este modelo ({own.status === "pending" ? "pendiente de moderación" : own.status === "visible" ? "publicada" : "oculta por moderación"}). Al guardar la
          actualizarás.
        </p>
      )}
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Tu valoración</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Valoración de 1 a 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} estrella${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className="rounded p-0.5">
              <Star className={`h-7 w-7 ${n <= rating ? "fill-warning text-warning" : "text-border"}`} />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Configuración que usas
          <select name="variantId" defaultValue={own?.variant_id ?? ""} className={`${field} mt-1`}>
            <option value="">No lo sé / otra</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Meses de uso
          <input name="usageMonths" type="number" min={0} max={240} defaultValue={own?.usage_months ?? ""} className={`${field} mt-1`} />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Título
        <input name="title" required minLength={3} maxLength={120} defaultValue={own?.title} className={`${field} mt-1`} />
      </label>
      <label className="block text-sm font-medium">
        Tu experiencia real
        <textarea name="body" required minLength={30} maxLength={8000} rows={6} defaultValue={own?.body} className={`${field} mt-1`} placeholder="¿Para qué la usas? ¿Qué te gusta y qué no? ¿Ha tenido problemas?" />
      </label>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Tu experiencia trata sobre…</legend>
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_TAGS.map((t) => (
            <label key={t.id} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary">
              <input type="checkbox" name="tags" value={t.id} defaultChecked={own?.experience_tags.includes(t.id)} className="sr-only" />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Temperatura máxima que has medido (°C, opcional)
          <input name="tempC" type="number" min={0} max={120} defaultValue={own?.observed_temp_c ?? ""} className={`${field} mt-1`} />
        </label>
        <label className="text-sm font-medium">
          Autonomía real en tu uso (horas, opcional)
          <input name="batteryH" type="number" min={0} max={48} step={0.5} defaultValue={own?.observed_battery_h ?? ""} className={`${field} mt-1`} />
        </label>
      </div>
      {state.message && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-success/12 text-success" : "bg-danger/12 text-danger"}`}>{state.message}</p>}
      <button disabled={pending} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-fg disabled:opacity-60">
        {pending ? "Enviando…" : own ? "Actualizar reseña" : "Publicar reseña"}
      </button>
    </form>
  );
}

export function PhotoForm({ modelId }: { modelId: string }) {
  const [state, action, pending] = useActionState(uploadPhotoAction, init);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="modelId" value={modelId} />
      <label className="block text-sm font-medium">
        Foto de tu laptop (JPEG, PNG o WebP, máx. 5 MB)
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-primary" />
      </label>
      <input name="caption" maxLength={300} placeholder="Descripción (opcional)" className={field} />
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" name="own" required className="mt-0.5" /> Confirmo que la foto es mía y no muestra datos personales.
      </label>
      {state.message && <p role="status" className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
      <button disabled={pending} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-primary disabled:opacity-60">
        {pending ? "Subiendo…" : "Enviar foto a moderación"}
      </button>
    </form>
  );
}
