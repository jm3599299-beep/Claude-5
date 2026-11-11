import Link from "next/link";
import { Star, BadgeCheck } from "lucide-react";
import type { ModelCard, NewsCard, ReviewCard } from "@/lib/data/types";
import { LaptopImage, primaryImage } from "./laptop-image";
import { NewsLabelBadge, StatusBadge } from "./badge";
import { formatDate } from "@/lib/format";

export function LaptopCard({ model }: { model: ModelCard }) {
  return (
    <Link
      href={`/laptops/${model.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
    >
      <LaptopImage image={primaryImage(model.images)} name={model.name} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">
          {model.brand?.name}
          {model.family ? ` · ${model.family.name}` : ""}
        </p>
        <h3 className="font-display font-semibold leading-snug group-hover:text-primary">{model.name}</h3>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <StatusBadge status={model.commercial_status} />
          {model.release_year && <span className="text-xs text-fg-muted">{model.release_year}</span>}
        </div>
      </div>
    </Link>
  );
}

export function NewsCardView({ article }: { article: NewsCard }) {
  return (
    <Link
      href={`/noticias/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-primary/50"
    >
      {article.image_url && article.image_authorized ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.image_url} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
      ) : null}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <NewsLabelBadge label={article.label} />
          <span className="text-xs text-fg-muted">{article.category}</span>
        </div>
        <h3 className="font-display font-semibold leading-snug group-hover:text-primary">{article.title}</h3>
        <p className="line-clamp-3 text-sm text-fg-muted">{article.summary_es}</p>
        <p className="mt-auto pt-2 text-xs text-fg-muted">
          {article.source?.name} · <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
        </p>
      </div>
    </Link>
  );
}

export function ReviewCardView({ review }: { review: ReviewCard }) {
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex" aria-label={`${review.rating} de 5 estrellas`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-warning text-warning" : "text-border"}`} aria-hidden="true" />
          ))}
        </div>
        {review.is_professional ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <BadgeCheck className="h-3.5 w-3.5" /> Prueba profesional
          </span>
        ) : (
          <span className="text-xs text-fg-muted">Opinión de usuario</span>
        )}
      </div>
      <h3 className="font-semibold">{review.title}</h3>
      <p className="line-clamp-3 text-sm text-fg-muted">{review.body}</p>
      <p className="mt-auto pt-2 text-xs text-fg-muted">
        {review.author?.display_name ?? review.author?.username ?? "Usuario"} sobre{" "}
        {review.model ? (
          <Link href={`/laptops/${review.model.slug}`} className="font-medium text-fg hover:text-primary">
            {review.model.name}
          </Link>
        ) : (
          "—"
        )}
      </p>
    </article>
  );
}
