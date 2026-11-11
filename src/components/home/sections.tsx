import Link from "next/link";
import { getBrands, getModelCards, type ModelListOrder } from "@/lib/data/catalog";
import { getFeaturedComparisons, getLatestNews, getRecentReviews } from "@/lib/data/community";
import { EmptyState } from "@/components/ui/empty-state";
import { LaptopCard, NewsCardView, ReviewCardView } from "@/components/ui/cards";

const grid = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4";

export async function ModelGrid({ order, limit = 4, emptyTitle }: { order: ModelListOrder; limit?: number; emptyTitle: string }) {
  const res = await getModelCards(order, limit);
  if (!res.data.length)
    return (
      <EmptyState
        title={emptyTitle}
        reason={res.ok ? "empty" : res.reason}
        description="Los modelos aparecen aquí cuando se importan con especificaciones y fuentes verificadas."
      />
    );
  return (
    <div className={grid}>
      {res.data.map((m) => (
        <LaptopCard key={m.id} model={m} />
      ))}
    </div>
  );
}

export async function BrandsStrip() {
  const res = await getBrands();
  if (!res.data.length) return <EmptyState title="Marcas no disponibles" reason={res.ok ? "empty" : res.reason} />;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {res.data.map((b) => (
        <li key={b.id}>
          <Link
            href={`/marcas/${b.slug}`}
            className="flex h-16 items-center justify-center rounded-xl border border-border bg-surface px-3 text-center font-display font-semibold transition hover:border-primary hover:text-primary"
          >
            {b.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export async function LatestNews() {
  const res = await getLatestNews(4);
  if (!res.data.length)
    return (
      <EmptyState
        title="Aún no hay noticias publicadas"
        reason={res.ok ? "empty" : res.reason}
        description="La recopilación semanal automática publicará aquí noticias verificadas con enlace a su fuente."
      />
    );
  return (
    <div className={grid}>
      {res.data.map((a) => (
        <NewsCardView key={a.id} article={a} />
      ))}
    </div>
  );
}

export async function RecentReviews() {
  const res = await getRecentReviews(4);
  if (!res.data.length)
    return (
      <EmptyState
        title="Todavía no hay reseñas"
        reason={res.ok ? "empty" : res.reason}
        description="Las reseñas de la comunidad aparecerán aquí. Nunca mostramos reseñas ficticias."
      />
    );
  return (
    <div className={grid}>
      {res.data.map((r) => (
        <ReviewCardView key={r.id} review={r} />
      ))}
    </div>
  );
}

export async function FeaturedComparisons() {
  const res = await getFeaturedComparisons(4);
  if (!res.data.length)
    return (
      <EmptyState
        title="Sin comparaciones destacadas"
        reason={res.ok ? "empty" : res.reason}
        description="Las comparaciones destacadas por el equipo editorial aparecerán aquí."
      />
    );
  return (
    <ul className={grid}>
      {res.data.map((c) => (
        <li key={c.id}>
          <Link href={`/comparar/${c.slug}`} className="block rounded-2xl border border-border bg-surface p-5 font-semibold hover:border-primary">
            {c.title ?? `Comparación de ${c.variant_ids.length} laptops`}
          </Link>
        </li>
      ))}
    </ul>
  );
}
