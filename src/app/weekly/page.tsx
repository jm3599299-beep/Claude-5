import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getWeeklyIssues } from "@/lib/data/news";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "LaptopVerse Weekly — resumen semanal",
  description: "Cada semana, lo más importante del mundo de las laptops: lanzamientos, procesadores, GPU y tecnologías, verificado y con fuentes.",
  alternates: { canonical: "/weekly" },
};

async function Issues() {
  const res = await getWeeklyIssues();
  if (!res.data.length) return <EmptyState title="Aún no hay ediciones publicadas" reason={res.ok ? "empty" : res.reason} description="La primera edición se publicará tras la revisión editorial de la semana." />;
  const [latest, ...rest] = res.data;
  return (
    <>
      <Link href={`/weekly/${latest.slug}`} className="block rounded-3xl border border-border bg-surface p-6 transition hover:border-primary">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Última edición · {formatDate(latest.week_start)} – {formatDate(latest.week_end)}</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">{latest.title}</h2>
        <p className="mt-2 text-fg-muted">{latest.intro_es}</p>
      </Link>
      {rest.length > 0 && (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
          {rest.map((i) => (
            <li key={i.id}>
              <Link href={`/weekly/${i.slug}`} className="flex justify-between gap-3 px-5 py-3 hover:text-primary">
                <span className="font-medium">{i.title}</span>
                <span className="text-sm text-fg-muted">{i.is_quiet_week ? "Semana tranquila" : `${i.sections.reduce((n, s) => n + s.article_ids.length, 0)} noticias`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function WeeklyIndex() {
  return (
    <Container className="max-w-4xl py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">LaptopVerse Weekly</h1>
      <p className="mb-8 mt-2 text-fg-muted">El resumen semanal de lo que importa en el mundo de las laptops.</p>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl bg-surface-2" />}>
        <Issues />
      </Suspense>
    </Container>
  );
}
