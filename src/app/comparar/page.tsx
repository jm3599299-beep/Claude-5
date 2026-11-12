import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Trophy, X } from "lucide-react";
import { getLatestRates, getModelsForCompare } from "@/lib/data/catalog";
import { MIN_COMPARE, bestIndex, buildRows, compareHref, parseCompareParam, type CompareItem } from "@/lib/compare";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { LaptopImage, primaryImage } from "@/components/ui/laptop-image";
import { StatusBadge } from "@/components/ui/badge";
import { ComparePicker } from "@/components/compare/picker";
import { ShareButton } from "@/components/compare/share-button";

export const metadata: Metadata = {
  title: "Comparador de laptops",
  description: "Compara de 2 a 4 laptops por procesador, GPU, RAM, SSD, pantalla, batería, peso, puertos y precio.",
  alternates: { canonical: "/comparar" },
};

async function Comparison({ searchParams }: { searchParams: PageProps<"/comparar">["searchParams"] }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.v) ? sp.v[0] : sp.v;
  const wanted = parseCompareParam(raw);
  const [res, rates] = await Promise.all([getModelsForCompare([...new Set(wanted.map((w) => w.slug))]), getLatestRates()]);

  const items: CompareItem[] = wanted.flatMap(({ slug, key }) => {
    const model = res.data.find((m) => m.slug === slug);
    const variant = model?.variants.find((v) => v.variant_key === key);
    return model && variant ? [{ model, variant }] : [];
  });
  const missing = wanted.length - items.length;
  const current = items.map((i) => ({ slug: i.model.slug, key: i.variant.variant_key }));
  const usd = Object.fromEntries(rates.data.map((r) => [r.quote, Number(r.rate)]));
  const rows = buildRows(usd);
  const winners = rows.map((r) => bestIndex(r, items));
  const groups = [...new Set(rows.map((r) => r.group))];

  return (
    <div className="space-y-6">
      <ComparePicker current={current} />
      {!res.ok && <EmptyState title="Comparador no disponible" reason={res.reason} />}
      {missing > 0 && <p className="text-sm text-warning">{missing} elemento(s) del enlace ya no están disponibles y se omitieron.</p>}

      {items.length < MIN_COMPARE ? (
        <EmptyState
          title={items.length ? "Añade al menos otra laptop" : "Elige laptops para comparar"}
          description="Busca un modelo arriba y elige la configuración exacta. Puedes comparar de 2 a 4."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg-muted">
              <Trophy className="mr-1 inline h-4 w-4 text-success" aria-hidden="true" />
              Resaltado: mejor valor conocido en cada fila. Los datos desconocidos nunca ganan.
            </p>
            <ShareButton />
          </div>
          <div className="relative overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
              <caption className="sr-only">Comparación de {items.length} laptops</caption>
              <thead>
                <tr className="bg-surface">
                  <th scope="col" className="w-44 p-3 text-left align-bottom text-xs font-medium text-fg-muted">
                    Configuración
                  </th>
                  {items.map((it, idx) => {
                    const strengths = rows.filter((_, r) => winners[r].includes(idx)).map((r) => r.label);
                    return (
                      <th key={`${it.model.slug}:${it.variant.variant_key}`} scope="col" className="p-3 text-left align-top font-normal">
                        <div className="relative">
                          <Link
                            href={compareHref(current.filter((_, i) => i !== idx))}
                            scroll={false}
                            aria-label={`Quitar ${it.model.name} de la comparación`}
                            className="absolute right-0 top-0 z-10 rounded-full border border-border bg-surface p-1 text-fg-muted hover:text-danger"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Link>
                          <LaptopImage image={primaryImage(it.model.images)} name={it.model.name} className="mb-2 rounded-xl" sizes="25vw" />
                          <p className="text-xs uppercase tracking-wider text-fg-muted">{it.model.brand?.name}</p>
                          <Link href={`/laptops/${it.model.slug}?variante=${it.variant.variant_key}`} className="font-display font-semibold hover:text-primary">
                            {it.model.name}
                          </Link>
                          <p className="text-xs text-fg-muted">{it.variant.name}</p>
                          <div className="mt-1">
                            <StatusBadge status={it.model.commercial_status} />
                          </div>
                          {strengths.length > 0 && (
                            <p className="mt-2 text-xs text-success">
                              <span className="font-semibold">Destaca en:</span> {strengths.join(", ")}
                            </p>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g} className="border-t border-border">
                  <tr className="bg-surface-2/60">
                    <th scope="colgroup" colSpan={items.length + 1} className="px-3 py-2 text-left font-display text-sm font-semibold">
                      {g}
                    </th>
                  </tr>
                  {rows.map((r, ri) =>
                    r.group !== g ? null : (
                      <tr key={r.label} className="border-t border-border bg-surface">
                        <th scope="row" className="px-3 py-2 text-left align-top font-normal text-fg-muted">
                          {r.label}
                          {r.note && <span className="mt-0.5 block text-[11px] leading-snug text-fg-muted/80">{r.note}</span>}
                        </th>
                        {items.map((it, idx) => {
                          const val = r.value(it);
                          const win = winners[ri].includes(idx);
                          return (
                            <td
                              key={idx}
                              className={`whitespace-pre-line px-3 py-2 align-top ${win ? "bg-success/10 font-semibold text-success" : ""} ${val ? "" : "italic text-fg-muted/70"}`}
                            >
                              {win && <span className="sr-only">Mejor valor: </span>}
                              {val ?? "Desconocido"}
                            </td>
                          );
                        })}
                      </tr>
                    ),
                  )}
                </tbody>
              ))}
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function ComparePage(props: PageProps<"/comparar">) {
  return (
    <Container className="py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Comparador</h1>
      <p className="mb-6 mt-2 max-w-2xl text-fg-muted">
        Compara de 2 a 4 configuraciones exactas. El enlace de la página contiene la comparación: compártelo tal cual.
      </p>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-surface-2" aria-busy="true" />}>
        <Comparison searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}
