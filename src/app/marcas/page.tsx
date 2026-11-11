import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getBrands } from "@/lib/data/catalog";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { CardGridSkeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Marcas de laptops",
  description: "Todas las marcas de laptops del mundo en LaptopVerse: Lenovo, HP, Dell, ASUS, Acer, MSI, Apple y muchas más.",
  alternates: { canonical: "/marcas" },
};

async function BrandList() {
  const res = await getBrands();
  if (!res.data.length) return <EmptyState title="No hay marcas disponibles" reason={res.ok ? "empty" : res.reason} />;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {res.data.map((b) => (
        <li key={b.id}>
          <Link href={`/marcas/${b.slug}`} className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition hover:border-primary">
            <span className="font-display text-xl font-semibold">{b.name}</span>
            {b.country && <span className="mt-1 text-sm text-fg-muted">{b.country}</span>}
            {b.description && <span className="mt-2 text-sm text-fg-muted">{b.description}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function BrandsPage() {
  return (
    <Container className="py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Marcas</h1>
      <p className="mt-2 max-w-2xl text-fg-muted">Fabricantes de laptops de todo el mundo y sus familias de productos.</p>
      <div className="mt-8">
        <Suspense fallback={<CardGridSkeleton count={6} />}>
          <BrandList />
        </Suspense>
      </div>
    </Container>
  );
}
