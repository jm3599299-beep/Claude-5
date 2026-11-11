import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFamily, getModelsByFamily } from "@/lib/data/catalog";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { LaptopCard } from "@/components/ui/cards";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/marcas/[slug]/[familia]">): Promise<Metadata> {
  const { slug, familia } = await params;
  const { data: f } = await getFamily(slug, familia);
  if (!f) return { title: "Familia no encontrada" };
  return {
    title: `${f.brand.name} ${f.name}: modelos y generaciones`,
    description: `Todos los modelos y generaciones de ${f.brand.name} ${f.name} en ${site.name}, con especificaciones verificadas por variante.`,
    alternates: { canonical: `/marcas/${slug}/${familia}` },
  };
}

async function FamilyContent({ params }: { params: Promise<{ slug: string; familia: string }> }) {
  const { slug, familia } = await params;
  const res = await getFamily(slug, familia);
  if (!res.ok) return <EmptyState title="Familia no disponible" reason={res.reason} />;
  const family = res.data;
  if (!family) notFound();
  const models = await getModelsByFamily(family.id);

  // Group by release year so generations read chronologically.
  const byYear = new Map<string, typeof models.data>();
  for (const m of models.data) {
    const k = m.release_year ? String(m.release_year) : "Año sin verificar";
    byYear.set(k, [...(byYear.get(k) ?? []), m]);
  }

  return (
    <>
      <nav aria-label="Ruta" className="text-sm text-fg-muted">
        <Link href="/marcas" className="hover:text-fg">Marcas</Link> /{" "}
        <Link href={`/marcas/${family.brand.slug}`} className="hover:text-fg">{family.brand.name}</Link> /{" "}
        <span className="text-fg">{family.name}</span>
      </nav>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {family.brand.name} {family.name}
      </h1>
      {family.segment && <p className="mt-2 text-fg-muted">Segmento: {family.segment}</p>}
      {family.description && <p className="mt-4 max-w-2xl text-fg-muted">{family.description}</p>}

      <div className="mt-10 space-y-10">
        {models.data.length ? (
          [...byYear.entries()].map(([year, list]) => (
            <section key={year} aria-labelledby={`y-${year}`}>
              <h2 id={`y-${year}`} className="mb-4 font-display text-xl font-semibold">{year}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {list.map((m) => (
                  <LaptopCard key={m.id} model={m} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState
            title={`Aún no hay modelos ${family.name} publicados`}
            reason={models.ok ? "empty" : models.reason}
            description="Se publicarán cuando sus especificaciones estén verificadas con fuentes."
          />
        )}
      </div>
    </>
  );
}

export default function FamilyPage(props: PageProps<"/marcas/[slug]/[familia]">) {
  return (
    <Container className="py-12">
      <Suspense fallback={<CardGridSkeleton />}>
        <FamilyContent params={props.params} />
      </Suspense>
    </Container>
  );
}
