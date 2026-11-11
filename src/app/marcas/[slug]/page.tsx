import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getBrandWithFamilies, searchModels } from "@/lib/data/catalog";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { LaptopCard } from "@/components/ui/cards";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/marcas/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const res = await getBrandWithFamilies(slug);
  const name = res.data?.name ?? "Marca";
  return {
    title: `Laptops ${name}: familias, modelos y precios`,
    description: `Catálogo de laptops ${name} en ${site.name}: familias, modelos, especificaciones verificadas, precios y opiniones.`,
    alternates: { canonical: `/marcas/${slug}` },
  };
}

async function BrandContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await getBrandWithFamilies(slug);
  if (!res.ok) return <EmptyState title="Marca no disponible" reason={res.reason} />;
  const brand = res.data;
  if (!brand) notFound();
  const models = await searchModels({ brand: slug });

  return (
    <>
      <nav aria-label="Ruta" className="text-sm text-fg-muted">
        <Link href="/marcas" className="hover:text-fg">Marcas</Link> / <span className="text-fg">{brand.name}</span>
      </nav>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{brand.name}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-fg-muted">
        {brand.country && <span>{brand.country}</span>}
        {brand.website_url && (
          <a href={brand.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            Sitio oficial <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {brand.description && <p className="mt-4 max-w-2xl text-fg-muted">{brand.description}</p>}

      <h2 className="mt-10 font-display text-xl font-semibold">Familias</h2>
      {brand.families.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {brand.families.map((f) => (
            <li key={f.id}>
              <Link
                href={`/marcas/${brand.slug}/${f.slug}`}
                className="block rounded-xl border border-border bg-surface px-4 py-2 transition hover:border-primary hover:text-primary"
              >
                <span className="font-semibold">{f.name}</span>
                {f.segment && <span className="ml-2 text-xs text-fg-muted">{f.segment}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-fg-muted">Sin familias registradas.</p>
      )}

      <h2 className="mt-10 font-display text-xl font-semibold">Modelos</h2>
      <div className="mt-4">
        {models.data.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {models.data.map((m) => (
              <LaptopCard key={m.id} model={m} />
            ))}
          </div>
        ) : (
          <EmptyState title={`Aún no hay modelos ${brand.name} publicados`} description="Se publicarán cuando sus especificaciones estén verificadas con fuentes." />
        )}
      </div>
    </>
  );
}

export default function BrandPage(props: PageProps<"/marcas/[slug]">) {
  return (
    <Container className="py-12">
      <Suspense fallback={<CardGridSkeleton />}>
        <BrandContent params={props.params} />
      </Suspense>
    </Container>
  );
}
