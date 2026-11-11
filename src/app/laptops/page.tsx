import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import { getBrands, searchModels, type CatalogFilters } from "@/lib/data/catalog";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { LaptopCard } from "@/components/ui/cards";
import { SearchBar } from "@/components/layout/search-bar";
import { useCases } from "@/lib/site";

export const metadata: Metadata = {
  title: "Catálogo mundial de laptops",
  description: "Busca y filtra laptops por marca, uso, categoría, año y estado comercial.",
  alternates: { canonical: "/laptops" },
};

const slug = z.string().regex(/^[a-z0-9-]{1,40}$/);
const filterSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  marca: slug.optional().catch(undefined),
  uso: slug.optional().catch(undefined),
  categoria: slug.optional().catch(undefined),
  estado: z.enum(["current", "in_stores", "legacy", "discontinued", "unverified"]).optional().catch(undefined),
  anio: z.coerce.number().int().min(1980).max(2100).optional().catch(undefined),
});

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

async function Results({ searchParams }: { searchParams: PageProps<"/laptops">["searchParams"] }) {
  const raw = await searchParams;
  const p = filterSchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, first(v) || undefined])));
  const filters: CatalogFilters = { q: p.q, brand: p.marca, useCase: p.uso, category: p.categoria, status: p.estado, year: p.anio };
  const [res, brands] = await Promise.all([searchModels(filters), getBrands()]);

  const qs = (patch: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    const merged = { q: p.q, marca: p.marca, uso: p.uso, categoria: p.categoria, estado: p.estado, anio: p.anio?.toString(), ...patch };
    Object.entries(merged).forEach(([k, v]) => v && s.set(k, v));
    const str = s.toString();
    return str ? `/laptops?${str}` : "/laptops";
  };
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition ${active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-fg-muted hover:border-primary"}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside aria-label="Filtros" className="space-y-6">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Uso recomendado</h2>
          <div className="flex flex-wrap gap-2">
            {useCases.map((u) => (
              <Link key={u.slug} href={qs({ uso: p.uso === u.slug ? undefined : u.slug })} className={chip(p.uso === u.slug)}>
                {u.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Marca</h2>
          <div className="flex flex-wrap gap-2">
            {brands.data.map((b) => (
              <Link key={b.id} href={qs({ marca: p.marca === b.slug ? undefined : b.slug })} className={chip(p.marca === b.slug)}>
                {b.name}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Estado comercial</h2>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["current", "A la venta"],
                ["in_stores", "En tiendas"],
                ["legacy", "Antiguos"],
                ["discontinued", "Descatalogados"],
              ] as const
            ).map(([v, label]) => (
              <Link key={v} href={qs({ estado: p.estado === v ? undefined : v })} className={chip(p.estado === v)}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <Link href="/laptops" className="inline-block text-sm text-primary hover:underline">
          Limpiar filtros
        </Link>
      </aside>
      <section aria-live="polite">
        <p className="mb-4 text-sm text-fg-muted">
          {res.ok ? `${res.data.length} resultado${res.data.length === 1 ? "" : "s"}` : ""}
          {p.q ? ` para “${p.q}”` : ""}
        </p>
        {res.data.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {res.data.map((m) => (
              <LaptopCard key={m.id} model={m} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No se encontraron laptops"
            reason={res.ok ? "empty" : res.reason}
            description="Prueba con otros filtros. El catálogo crece a medida que se importan modelos verificados."
          />
        )}
      </section>
    </div>
  );
}

export default function CatalogPage(props: PageProps<"/laptops">) {
  return (
    <Container className="py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Catálogo de laptops</h1>
      <p className="mt-2 max-w-2xl text-fg-muted">Modelos actuales, disponibles en tiendas, antiguos y descatalogados de fabricantes de todo el mundo.</p>
      <div className="my-6 max-w-2xl">
        <SearchBar size="lg" />
      </div>
      <Suspense fallback={<CardGridSkeleton count={6} />}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}
