import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Star } from "lucide-react";
import { getModelCommunity, type CommunityReview } from "@/lib/data/community";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { EXPERIENCE_TAGS } from "@/lib/community/validation";
import { formatDate } from "@/lib/format";
import { CommentForm, LikeButton, ReportButton } from "./interactions";
import { PhotoForm, ReviewForm, type OwnReview } from "./review-form";

const tagLabel = (id: string) => EXPERIENCE_TAGS.find((t) => t.id === id)?.label ?? id;
const authorName = (a: { display_name: string | null; username: string | null } | null) => a?.display_name ?? (a?.username ? `@${a.username}` : "Usuario");

function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value.toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= Math.round(value) ? "fill-warning text-warning" : "text-border"}`} aria-hidden="true" />
      ))}
    </span>
  );
}

function ReviewItem({ r, modelId, modelSlug }: { r: CommunityReview; modelId: string; modelSlug: string }) {
  const top = r.comments.filter((c) => !c.parent_id);
  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Stars value={r.rating} />
          {r.is_professional ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Prueba profesional
            </span>
          ) : (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg-muted">Opinión de usuario</span>
          )}
        </div>
        <p className="text-xs text-fg-muted">
          {authorName(r.author)} · <time dateTime={r.created_at}>{formatDate(r.created_at)}</time>
          {r.updated_at !== r.created_at && " (editada)"}
        </p>
      </header>
      <h4 className="mt-2 font-semibold">{r.title}</h4>
      {(r.variant || r.usage_months != null) && (
        <p className="text-xs text-fg-muted">
          {r.variant && <>Configuración: {r.variant.name}</>}
          {r.variant && r.usage_months != null && " · "}
          {r.usage_months != null && <>{r.usage_months} meses de uso</>}
        </p>
      )}
      <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>
      {(r.observed_temp_c != null || r.observed_battery_h != null) && (
        <p className="mt-2 rounded-lg bg-surface-2/70 px-3 py-1.5 text-xs text-fg-muted">
          Datos aportados por el usuario (no verificados):
          {r.observed_temp_c != null && <> temperatura máx. {r.observed_temp_c} °C</>}
          {r.observed_temp_c != null && r.observed_battery_h != null && " ·"}
          {r.observed_battery_h != null && <> autonomía {r.observed_battery_h} h</>}
        </p>
      )}
      {r.experience_tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {r.experience_tags.map((t) => (
            <li key={t} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-fg-muted">{tagLabel(t)}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2">
        <LikeButton targetType="review" targetId={r.id} modelId={modelId} count={r.likes_count} />
        <ReportButton targetType="review" targetId={r.id} modelSlug={modelSlug} />
      </div>
      {top.length > 0 && (
        <ul className="mt-3 space-y-3 border-l-2 border-border pl-4">
          {top.map((c) => (
            <li key={c.id}>
              <p className="text-xs text-fg-muted">{authorName(c.author)} · {formatDate(c.created_at)}</p>
              <p className="whitespace-pre-line text-sm">{c.body}</p>
              <div className="flex flex-wrap items-center gap-1">
                <LikeButton targetType="comment" targetId={c.id} modelId={modelId} count={c.likes_count} />
                <ReportButton targetType="comment" targetId={c.id} modelSlug={modelSlug} />
                <CommentForm modelId={modelId} modelSlug={modelSlug} reviewId={r.id} parentId={c.id} compact />
              </div>
              {r.comments.filter((x) => x.parent_id === c.id).map((x) => (
                <div key={x.id} className="ml-4 mt-2 border-l border-border pl-3">
                  <p className="text-xs text-fg-muted">{authorName(x.author)} · {formatDate(x.created_at)}</p>
                  <p className="whitespace-pre-line text-sm">{x.body}</p>
                  <div className="flex items-center gap-1">
                    <LikeButton targetType="comment" targetId={x.id} modelId={modelId} count={x.likes_count} />
                    <ReportButton targetType="comment" targetId={x.id} modelSlug={modelSlug} />
                  </div>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
      <CommentForm modelId={modelId} modelSlug={modelSlug} reviewId={r.id} compact />
    </article>
  );
}

/** Request-time part: depends on the visitor's session. */
async function Composer({ modelId, modelSlug, variants }: { modelId: string; modelSlug: string; variants: { id: string; name: string }[] }) {
  const user = await getCurrentUser();
  if (!user)
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-5 text-sm">
        <p className="font-semibold">¿Tienes esta laptop?</p>
        <p className="mt-1 text-fg-muted">Comparte tu experiencia real: rendimiento, temperaturas, autonomía o problemas.</p>
        <div className="mt-3 flex gap-2">
          <Link href={`/entrar?next=/laptops/${modelSlug}%23comunidad`} className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-fg">Entrar para opinar</Link>
          <Link href="/registro" className="rounded-lg border border-border px-4 py-2 font-semibold hover:border-primary">Crear cuenta</Link>
        </div>
      </div>
    );
  if (user.isBanned) return <p className="text-sm text-danger">Tu cuenta está suspendida y no puede publicar.</p>;
  const db = (await getServerClient())!;
  const { data: own } = await db
    .from("reviews")
    .select("rating, title, body, experience_tags, usage_months, observed_temp_c, observed_battery_h, variant_id, status")
    .eq("model_id", modelId)
    .eq("user_id", user.id)
    .maybeSingle<OwnReview>();
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="mb-3 font-display text-lg font-semibold">{own ? "Edita tu reseña" : "Escribe tu reseña"}</h3>
        <ReviewForm modelId={modelId} modelSlug={modelSlug} variants={variants} own={own ?? null} />
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="mb-3 font-display text-lg font-semibold">Comparte una foto</h3>
        <PhotoForm modelId={modelId} />
      </div>
    </div>
  );
}

export async function CommunitySection({ modelId, modelSlug, modelName, variants, tag }: { modelId: string; modelSlug: string; modelName: string; variants: { id: string; name: string }[]; tag?: string | null }) {
  const data = await getModelCommunity(modelId);
  const reviews = tag ? data.reviews.filter((r) => r.experience_tags.includes(tag)) : data.reviews;
  const tagCounts = EXPERIENCE_TAGS.map((t) => ({ ...t, n: data.reviews.filter((r) => r.experience_tags.includes(t.id)).length })).filter((t) => t.n > 0);
  const s = data.stats;
  return (
    <section id="comunidad" aria-labelledby="comunidad-title" className="mt-14 scroll-mt-20">
      <h2 id="comunidad-title" className="font-display text-2xl font-semibold">Comunidad {modelName}</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Opiniones de usuarios reales, separadas de las pruebas profesionales. <Link href="/normas" className="text-primary hover:underline">Normas</Link>
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-fg-muted">Opiniones de usuarios</p>
          {s?.user_reviews ? (
            <p className="mt-1 flex items-center gap-2">
              <span className="font-display text-3xl font-semibold">{Number(s.user_avg).toFixed(1)}</span>
              <Stars value={Number(s.user_avg)} size="h-5 w-5" />
              <span className="text-sm text-fg-muted">{s.user_reviews} reseña{s.user_reviews === 1 ? "" : "s"}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm italic text-fg-muted">Aún no hay opiniones publicadas.</p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-fg-muted">Pruebas profesionales</p>
          {s?.pro_reviews ? (
            <p className="mt-1 flex items-center gap-2">
              <span className="font-display text-3xl font-semibold">{Number(s.pro_avg).toFixed(1)}</span>
              <Stars value={Number(s.pro_avg)} size="h-5 w-5" />
            </p>
          ) : (
            <p className="mt-1 text-sm italic text-fg-muted">Sin pruebas profesionales verificadas.</p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-surface-2" aria-busy="true" />}>
          <Composer modelId={modelId} modelSlug={modelSlug} variants={variants} />
        </Suspense>
      </div>

      {data.photos.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 font-display text-lg font-semibold">Fotos de la comunidad</h3>
          <p className="mb-2 text-xs text-fg-muted">Fotos de usuarios, revisadas por moderación. No son fotos oficiales.</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.photos.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-xl border border-border bg-surface">
                <span className="relative block aspect-[4/3]">
                  <Image src={p.url} alt={p.caption ?? `Foto de ${authorName(p.author)}`} fill sizes="(min-width: 640px) 25vw, 50vw" className="object-cover" />
                </span>
                <p className="flex items-center justify-between gap-1 px-2 py-1 text-[11px] text-fg-muted">
                  <span className="truncate">{authorName(p.author)}</span>
                  <ReportButton targetType="photo" targetId={p.id} modelSlug={modelSlug} />
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tagCounts.length > 0 && (
        <nav aria-label="Filtrar experiencias" className="mt-6 flex flex-wrap gap-2">
          <Link href={`/laptops/${modelSlug}#comunidad`} scroll={false} className={`rounded-full border px-3 py-1 text-xs ${!tag ? "border-primary bg-primary-soft text-primary" : "border-border"}`}>
            Todas ({data.reviews.length})
          </Link>
          {tagCounts.map((t) => (
            <Link key={t.id} href={`/laptops/${modelSlug}?experiencia=${t.id}#comunidad`} scroll={false} className={`rounded-full border px-3 py-1 text-xs ${tag === t.id ? "border-primary bg-primary-soft text-primary" : "border-border"}`}>
              {t.label} ({t.n})
            </Link>
          ))}
        </nav>
      )}

      <div className="mt-4 space-y-4">
        {reviews.length ? (
          reviews.map((r) => <ReviewItem key={r.id} r={r} modelId={modelId} modelSlug={modelSlug} />)
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-fg-muted">
            {data.ok ? "Todavía no hay reseñas publicadas. ¡Sé el primero en compartir tu experiencia!" : "No se pudieron cargar las reseñas."}
          </p>
        )}
      </div>
    </section>
  );
}
