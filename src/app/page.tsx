import { Suspense } from "react";
import Link from "next/link";
import { Hero } from "@/components/home/hero";
import { Section } from "@/components/ui/section";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { BrandsStrip, FeaturedComparisons, LatestNews, ModelGrid, RecentReviews } from "@/components/home/sections";
import { useCases } from "@/lib/site";

export default function HomePage() {
  return (
    <>
      <Hero />

      <Section id="destacadas" eyebrow="Selección" title="Laptops destacadas" href="/laptops">
        <Suspense fallback={<CardGridSkeleton />}>
          <ModelGrid order="featured" emptyTitle="Aún no hay laptops destacadas" />
        </Suspense>
      </Section>

      <Section id="lanzamientos" eyebrow="Novedades" title="Últimos lanzamientos" href="/laptops">
        <Suspense fallback={<CardGridSkeleton />}>
          <ModelGrid order="latest" emptyTitle="Aún no hay lanzamientos registrados" />
        </Suspense>
      </Section>

      <Section id="populares" eyebrow="Tendencia" title="Modelos más populares" href="/laptops">
        <Suspense fallback={<CardGridSkeleton />}>
          <ModelGrid order="popular" emptyTitle="Aún no hay datos de popularidad" />
        </Suspense>
      </Section>

      <Section id="comparaciones" eyebrow="Cara a cara" title="Comparaciones destacadas">
        <Suspense fallback={<CardGridSkeleton />}>
          <FeaturedComparisons />
        </Suspense>
      </Section>

      <Section id="noticias" eyebrow="LaptopVerse Weekly" title="Últimas noticias">
        <Suspense fallback={<CardGridSkeleton />}>
          <LatestNews />
        </Suspense>
      </Section>

      <Section id="resenas" eyebrow="Comunidad" title="Reseñas recientes">
        <Suspense fallback={<CardGridSkeleton />}>
          <RecentReviews />
        </Suspense>
      </Section>

      <Section id="marcas" eyebrow="Fabricantes" title="Marcas principales" href="/marcas" hrefLabel="Todas las marcas">
        <Suspense fallback={<CardGridSkeleton count={6} />}>
          <BrandsStrip />
        </Suspense>
      </Section>

      <Section
        id="recomendadas"
        eyebrow="Encuentra la tuya"
        title="Laptops recomendadas por uso"
        description="Explora el catálogo filtrado según lo que necesitas hacer."
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((u) => (
            <li key={u.slug}>
              <Link
                href={`/laptops?uso=${u.slug}`}
                className="group flex items-center justify-between rounded-2xl border border-border bg-surface p-5 transition hover:border-primary"
              >
                <span className="font-display text-lg font-semibold group-hover:text-primary">{u.label}</span>
                <span aria-hidden="true" className="text-fg-muted transition group-hover:translate-x-1 group-hover:text-primary">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
