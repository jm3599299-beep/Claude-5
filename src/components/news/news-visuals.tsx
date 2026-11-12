import Link from "next/link";
import Image from "next/image";
import { Cpu, Gamepad2, Laptop, Monitor, Newspaper, Sparkles, BatteryCharging, Briefcase, GraduationCap, Apple, Wrench, Fan, Star, MonitorCog } from "lucide-react";
import type { NewsArticle } from "@/lib/data/news";
import { CATEGORIES, type Category } from "@/lib/news/rules";
import { NewsLabelBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { isAllowedImageUrl } from "@/lib/images/hosts";

const ICONS: Record<string, typeof Laptop> = {
  lanzamientos: Sparkles, procesadores: Cpu, gpu: MonitorCog, gaming: Gamepad2, empresariales: Briefcase, estudiantes: GraduationCap,
  macbook: Apple, resenas: Star, ia: Sparkles, pantallas: Monitor, refrigeracion: Fan, baterias: BatteryCharging, sistemas: Laptop, actualizaciones: Wrench, general: Newspaper,
};
export const categoryLabel = (c: string) => CATEGORIES[c as Category] ?? c;

/** Authorized image, or a branded illustration (never someone else's photo without permission). */
export function NewsImage({ a, className = "" }: { a: Pick<NewsArticle, "image_url" | "image_authorized" | "category" | "title">; className?: string }) {
  if (a.image_url && a.image_authorized && isAllowedImageUrl(a.image_url))
    return (
      <span className={`relative block aspect-[16/9] overflow-hidden ${className}`}>
        <Image src={a.image_url} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
      </span>
    );
  const Icon = ICONS[a.category] ?? Newspaper;
  return (
    <span aria-hidden="true" className={`lv-hero-bg relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-surface-2 ${className}`}>
      <Icon className="h-10 w-10 text-primary/70" />
    </span>
  );
}

export function NewsItemCard({ a }: { a: NewsArticle }) {
  return (
    <Link href={`/noticias/${a.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-primary/50">
      <NewsImage a={a} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <NewsLabelBadge label={a.label} />
          <span className="text-xs text-fg-muted">{categoryLabel(a.category)}</span>
        </div>
        <h3 className="font-display font-semibold leading-snug group-hover:text-primary">{a.title}</h3>
        <p className="line-clamp-3 text-sm text-fg-muted">{a.summary_es}</p>
        <p className="mt-auto pt-2 text-xs text-fg-muted">
          {a.source?.name} · <time dateTime={a.published_at}>{formatDate(a.published_at)}</time>
        </p>
      </div>
    </Link>
  );
}
