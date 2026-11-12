import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getComparisonBySlug } from "@/lib/data/community";
import { compareHref } from "@/lib/compare";
import { Container } from "@/components/ui/container";

/** Saved/featured comparisons resolve to the shareable URL form. */
async function Resolve({ params }: { params: Promise<{ slug: string }> }): Promise<null> {
  const { slug } = await params;
  const res = await getComparisonBySlug(slug);
  if (!res.data) notFound();
  redirect(compareHref(res.data));
  return null;
}

export default function SavedComparison(props: PageProps<"/comparar/[slug]">) {
  return (
    <Container className="py-12">
      <Suspense fallback={<p className="text-fg-muted">Cargando comparación…</p>}>
        <Resolve params={props.params} />
      </Suspense>
    </Container>
  );
}
