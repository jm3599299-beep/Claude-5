import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWeeklyIssue } from "@/lib/data/news";
import { Container } from "@/components/ui/container";
import { NewsLabelBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/weekly/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await getWeeklyIssue(slug);
  return data ? { title: data.title, description: data.intro_es ?? undefined, alternates: { canonical: `/weekly/${slug}` } } : { title: "Edición no encontrada" };
}

async function Issue({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await getWeeklyIssue(slug);
  const issue = res.data;
  if (!issue) notFound();
  const byId = new Map(res.articles.map((a) => [a.id, a]));
  return (
    <article>
      <nav aria-label="Ruta" className="text-sm text-fg-muted"><Link href="/weekly" className="hover:text-fg">LaptopVerse Weekly</Link></nav>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent">{formatDate(issue.week_start)} – {formatDate(issue.week_end)}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{issue.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-fg-muted">{issue.intro_es}</p>
      {issue.is_quiet_week && <p className="mt-4 rounded-xl border border-border bg-surface p-4 text-sm">Fue una semana con pocas novedades verificadas. No rellenamos esta edición con contenido de relleno.</p>}
      {issue.sections.map((s) => (
        <section key={s.id} className="mt-10" aria-labelledby={`s-${s.id}`}>
          <h2 id={`s-${s.id}`} className="font-display text-2xl font-semibold">{s.title}</h2>
          <ol className="mt-4 space-y-4">
            {s.article_ids.map((id) => byId.get(id)).filter(Boolean).map((a) => (
              <li key={a!.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-center gap-2"><NewsLabelBadge label={a!.label} /><span className="text-xs text-fg-muted">{a!.source?.name} · {formatDate(a!.published_at)}</span></div>
                <h3 className="mt-2 font-display text-lg font-semibold"><Link href={`/noticias/${a!.slug}`} className="hover:text-primary">{a!.title}</Link></h3>
                <p className="mt-1 text-sm text-fg-muted">{a!.summary_es}</p>
                <a href={a!.original_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary hover:underline">Fuente original ↗</a>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </article>
  );
}

export default function WeeklyIssuePage(props: PageProps<"/weekly/[slug]">) {
  return (
    <Container className="max-w-3xl py-12">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface-2" />}>
        <Issue params={props.params} />
      </Suspense>
    </Container>
  );
}
