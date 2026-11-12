"use client";

import { useActionState, useState, useTransition } from "react";
import { Flag, MessageSquare, ThumbsUp } from "lucide-react";
import { reportAction, submitCommentAction, toggleLikeAction, type ActionState } from "@/lib/actions/community";
import { REPORT_REASONS } from "@/lib/community/validation";

const init: ActionState = { ok: false, message: null };
const Msg = ({ s }: { s: ActionState }) =>
  s.message ? <p role="status" className={`mt-1 text-xs ${s.ok ? "text-success" : "text-danger"}`}>{s.message}</p> : null;

export function LikeButton({ targetType, targetId, modelId, count }: { targetType: "review" | "comment"; targetId: string; modelId: string; count: number }) {
  const [n, setN] = useState(count);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        aria-pressed={liked ?? undefined}
        onClick={() =>
          start(async () => {
            const r = await toggleLikeAction(targetType, targetId, modelId);
            if (!r.ok) return setMsg(r.message);
            setMsg(null);
            setLiked(r.liked ?? null);
            setN((x) => Math.max(0, x + (r.liked ? 1 : -1)));
          })
        }
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition hover:bg-surface-2 ${liked ? "text-primary" : "text-fg-muted"}`}
      >
        <ThumbsUp className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} aria-hidden="true" /> Útil{n > 0 ? ` · ${n}` : ""}
      </button>
      {msg && <span className="text-xs text-danger">{msg}</span>}
    </span>
  );
}

export function ReportButton({ targetType, targetId, modelSlug }: { targetType: "review" | "comment" | "photo"; targetId: string; modelSlug: string }) {
  const [state, action, pending] = useActionState(reportAction, init);
  return (
    <details className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1 text-xs text-fg-muted hover:bg-surface-2">
        <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Reportar
      </summary>
      <form action={action} className="absolute right-0 z-20 mt-1 w-64 space-y-2 rounded-xl border border-border bg-surface p-3 shadow-lg">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="modelSlug" value={modelSlug} />
        <label className="block text-xs font-medium">
          Motivo
          <select name="reason" required className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-xs">
            {REPORT_REASONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <textarea name="details" maxLength={1000} rows={2} placeholder="Detalles (opcional)" className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-xs" />
        <button disabled={pending} className="w-full rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
          Enviar reporte
        </button>
        <Msg s={state} />
      </form>
    </details>
  );
}

export function CommentForm({ modelId, modelSlug, reviewId, parentId, compact = false }: { modelId: string; modelSlug: string; reviewId: string; parentId?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState(submitCommentAction, init);
  const [open, setOpen] = useState(!compact);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-fg-muted hover:bg-surface-2">
        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Responder
      </button>
    );
  return (
    <form action={action} className="mt-2 space-y-1">
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="modelSlug" value={modelSlug} />
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="parentId" value={parentId ?? ""} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" className="hidden" aria-hidden="true" />
      <label className="sr-only" htmlFor={`c-${reviewId}-${parentId ?? "root"}`}>Comentario</label>
      <div className="flex gap-2">
        <input
          id={`c-${reviewId}-${parentId ?? "root"}`}
          name="body"
          required
          minLength={2}
          maxLength={2000}
          placeholder={parentId ? "Escribe una respuesta…" : "Pregunta o comenta sobre esta reseña…"}
          className="h-9 flex-1 rounded-lg border border-border bg-bg px-3 text-sm focus:border-primary focus:outline-none"
        />
        <button disabled={pending} className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-fg disabled:opacity-60">
          Publicar
        </button>
      </div>
      <Msg s={state} />
    </form>
  );
}
