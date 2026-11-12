import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { getNewsArticle } from "@/lib/data/news";
import { Container } from "@/components/ui/container";
import { NewsLabelBadge } from "@/components/ui/badge";
import { NewsImage, categoryLabel } from "@/components/news/news-visuals";
import { JsonLd } from "@/components/seo/json-ld";
import { formatDate } from "@/lib/format";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/noticias/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { data: a } = await getNewsArticle(slug);
  if (!a) return { title: "Noticia no encontrada" };
  return { title: a.title, description: a.summary_es.slice(0, 160), alternates: { canonical: `/noticias/${a.slug}` }, openGraph: { type: "article", title: a.title, description: a.summary_es.slice(0, 160), publishedTime: a.published_at } };
}

async function Article({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: a } = await getNewsArticle(slug);
  if (!a) notFound();
  const corroborated = a.verification?.corroborated_by ?? [];
  const speculative = a.label === "rumor" || a.label === "leak";
  return (
    <article className="mx-auto max-w-3xl">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: a.title,
          datePublished: a.published_at,
          dateModified: a.collected_at,
          inLanguage: "es",
          isBasedOn: a.original_url,
          publisher: { "@type": "Organization", name: site.name, url: site.url },
          ...(a.source && { sourceOrganization: { "@type": "Organization", name: a.source.name } }),
          mainEntityOfPage: `${site.url}/noticias/${a.slug}`,
        }}
      />
      <nav aria-label="Ruta" className="text-sm text-fg-muted">
        <Link href="/noticias" className="hover:text-fg">Noticias</Link> / <Link href={`/noticias?categoria=${a.category}`} className="hover:text-fg">{categoryLabel(a.category)}</Link>
      </nav>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <NewsLabelBadge label={a.label} />
        <span className="text-sm text-fg-muted">{categoryLabel(a.category)}</span>
      </div>
      <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{a.title}</h1>
      {a.original_title && a.original_title !== a.title && <p className="mt-2 text-sm text-fg-muted">Título original: «{a.original_title}»</p>}
      <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm text-fg-muted sm:grid-cols-2">
        <div><dt className="inline">Publicada por la fuente: </dt><dd className="inline font-medium text-fg"><time dateTime={a.published_at}>{formatDate(a.published_at)}</time></dd></div>
        <div><dt className="inline">Recopilada por LaptopVerse: </dt><dd className="inline font-medium text-fg"><time dateTime={a.collected_at}>{formatDate(a.collected_at)}</time></dd></div>
        <div><dt className="inline">Fuente: </dt><dd className="inline font-medium text-fg">{a.source?.name}{a.source?.is_official && " (oficial)"}</dd></div>
      </dl>
      <NewsImage a={a} className="mt-6 rounded-2xl border border-border" />
      {a.image_url && a.image_authorized && a.image_credit && <p className="mt-1 text-xs text-fg-muted">Imagen: {a.image_credit}</p>}
      {speculative && (
        <p className="mt-6 flex gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {a.label === "rumor" ? "Rumor: información no confirmada por el fabricante." : "Filtración: información no oficial que puede no ser exacta."}
        </p>
      )}
      <div className="mt-6">
        <h2 className="sr-only">Resumen</h2>
        <p className="text-lg leading-relaxed">{a.summary_es}</p>
        <p className="mt-2 text-xs text-fg-muted">Resumen propio de LaptopVerse en español, basado únicamente en la fuente original.</p>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a href={a.original_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-fg">
          Leer el artículo original <ExternalLink className="h-4 w-4" />
        </a>
        {a.weekly && <Link href={`/weekly/${a.weekly.slug}`} className="text-sm font-medium text-primary hover:underline">Incluida en {a.weekly.title}</Link>}
      </div>
      <aside className="mt-8 rounded-2xl border border-border bg-surface p-4 text-sm">
        <p className="flex items-center gap-1.5 font-semibold"><ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" /> Verificación</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
          <li>Fecha comprobada en la fuente: {formatDate(a.published_at)}.</li>
          <li>{a.source?.is_official ? "Anuncio publicado por la fuente oficial." : "Publicada por un medio especializado."}</li>
          {corroborated.length > 0 && <li>También informaron: {corroborated.join(", ")}.</li>}
          {a.verification?.summary_model && <li>Resumen generado con IA y revisado automáticamente (cifras contrastadas con la fuente).</li>}
        </ul>
      </aside>
    </article>
  );
}

export default function NewsArticlePage(props: PageProps<"/noticias/[slug]">) {
  return (
    <Container className="py-12">
      <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse rounded-2xl bg-surface-2" />}>
        <Article params={props.params} />
      </Suspense>
    </Container>
  );
}
