import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getCommunityFeed } from "@/lib/data/community";
import { EXPERIENCE_TAGS, EXPERIENCE_TAG_IDS } from "@/lib/community/validation";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { ReviewCardView } from "@/components/ui/cards";
import { CardGridSkeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Comunidad: experiencias reales con laptops",
  description: "Reseñas y experiencias reales de usuarios: gaming, estudios, trabajo, programación, batería, temperaturas y problemas técnicos.",
  alternates: { canonical: "/comunidad" },
};

async function Feed({ searchParams }: { searchParams: PageProps<"/comunidad">["searchParams"] }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.experiencia) ? sp.experiencia[0] : sp.experiencia;
  const tag = raw && EXPERIENCE_TAG_IDS.includes(raw) ? raw : null;
  const res = await getCommunityFeed(tag);
  const chip = (active: boolean) => `rounded-full border px-3 py-1 text-sm ${active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-fg-muted hover:border-primary"}`;
  return (
    <>
      <nav aria-label="Tipo de experiencia" className="mb-6 flex flex-wrap gap-2">
        <Link href="/comunidad" className={chip(!tag)}>Todas</Link>
        {EXPERIENCE_TAGS.map((t) => (
          <Link key={t.id} href={`/comunidad?experiencia=${t.id}`} className={chip(tag === t.id)}>
            {t.label}
          </Link>
        ))}
      </nav>
      {res.data.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {res.data.map((r) => (
            <ReviewCardView key={r.id} review={r} />
          ))}
        </div>
      ) : (
        <EmptyState title="Aún no hay experiencias publicadas" reason={res.ok ? "empty" : res.reason} description="Las reseñas de la comunidad aparecerán aquí. Nunca mostramos reseñas ficticias." />
      )}
    </>
  );
}

export default function CommunityPage(props: PageProps<"/comunidad">) {
  return (
    <Container className="py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Comunidad LaptopVerse</h1>
      <p className="mb-6 mt-2 max-w-2xl text-fg-muted">
        Experiencias reales de usuarios. Cada laptop tiene su propia comunidad en su ficha. <Link href="/normas" className="text-primary hover:underline">Normas de la comunidad</Link>
      </p>
      <Suspense fallback={<CardGridSkeleton count={6} />}>
        <Feed searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}
