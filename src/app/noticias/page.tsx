import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getNews } from "@/lib/data/news";
import { CATEGORIES } from "@/lib/news/rules";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { NewsItemCard } from "@/components/news/news-visuals";

export const metadata: Metadata = {
  title: "Noticias de laptops",
  description: "Noticias verificadas sobre laptops, procesadores, GPU y tecnología: anuncios oficiales, análisis, rumores y filtraciones claramente etiquetados.",
  alternates: { canonical: "/noticias" },
};

const LABELS = [
  ["official", "Oficiales"],
  ["analysis", "Análisis"],
  ["rumor", "Rumores"],
  ["leak", "Filtraciones"],
] as const;

async function List({ searchParams }: { searchParams: PageProps<"/noticias">["searchParams"] }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const category = one(sp.categoria) && one(sp.categoria)! in CATEGORIES ? one(sp.categoria) : null;
  const label = LABELS.some(([id]) => id === one(sp.tipo)) ? one(sp.tipo) : null;
  const res = await getNews({ category, label });
  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const m = { categoria: category, tipo: label, ...patch };
    Object.entries(m).forEach(([k, v]) => v && q.set(k, v));
    return q.size ? `/noticias?${q}` : "/noticias";
  };
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-fg-muted hover:border-primary"}`;
  return (
    <>
      <nav aria-label="Tipo de noticia" className="mb-3 flex flex-wrap gap-2">
        <Link href={href({ tipo: null })} className={chip(!label)}>Todas</Link>
        {LABELS.map(([id, l]) => (
          <Link key={id} href={href({ tipo: label === id ? null : id })} className={chip(label === id)}>{l}</Link>
        ))}
      </nav>
      <nav aria-label="Categoría" className="mb-6 flex flex-wrap gap-2">
        {Object.entries(CATEGORIES).map(([id, l]) => (
          <Link key={id} href={href({ categoria: category === id ? null : id })} className={chip(category === id)}>{l}</Link>
        ))}
      </nav>
      {res.data.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {res.data.map((a) => (
            <NewsItemCard key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <EmptyState title="No hay noticias publicadas con estos filtros" reason={res.ok ? "empty" : res.reason} description="Las noticias se recopilan cada semana y se publican tras verificarse." />
      )}
    </>
  );
}

export default function NewsPage(props: PageProps<"/noticias">) {
  return (
    <Container className="py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Noticias</h1>
          <p className="mt-2 max-w-2xl text-fg-muted">Resúmenes propios en español, con fecha, fuente y enlace al artículo original. Rumores y filtraciones siempre etiquetados.</p>
        </div>
        <Link href="/weekly" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg">LaptopVerse Weekly →</Link>
      </div>
      <div className="mt-8">
        <Suspense fallback={<CardGridSkeleton count={6} />}>
          <List searchParams={props.searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}
