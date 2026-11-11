import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ExternalLink, ShieldCheck } from "lucide-react";
import { getModelDetail } from "@/lib/data/catalog";
import type { ModelDetail, Variant } from "@/lib/data/types";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { LaptopImage, imageSrc } from "@/components/ui/laptop-image";
import { Gallery, type GalleryImage } from "@/components/laptop/gallery";
import { SpecTable } from "@/components/laptop/spec-table";
import { VariantTabs } from "@/components/laptop/variant-tabs";
import { JsonLd } from "@/components/seo/json-ld";
import { cpuName, differingRows, formatStorage, gpuName } from "@/lib/specs";
import { formatDate } from "@/lib/format";
import { site, useCases } from "@/lib/site";

const categoryLabels: Record<string, string> = {
  gaming: "Gaming",
  business: "Empresarial",
  ultrabook: "Ultrabook",
  workstation: "Workstation",
  student: "Estudiantes",
  creator: "Creadores",
  "2in1": "2 en 1",
  chromebook: "Chromebook",
  rugged: "Rugerizada",
  budget: "Económica",
  mainstream: "Uso general",
};

function galleryImages(model: ModelDetail, variantId: string | null): GalleryImage[] {
  return model.images
    .filter((i) => i.verified && !i.is_placeholder && i.variant_id === variantId)
    .flatMap((i) => {
      const src = imageSrc(i);
      return src
        ? [{ id: i.id, src, alt: i.alt, angle: i.angle, isOfficial: i.is_official, credit: i.credit, sourceUrl: i.source_url, license: i.license }]
        : [];
    });
}

function variantSublabel(v: Variant) {
  return [cpuName(v.cpu)?.replace(/^(Intel|AMD|Apple|Qualcomm) /, ""), v.ram_gb && `${v.ram_gb} GB`, formatStorage(v.storage_gb)].filter(Boolean).join(" · ");
}

export async function generateMetadata({ params }: PageProps<"/laptops/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { data: m } = await getModelDetail(slug);
  if (!m) return { title: "Laptop no encontrada" };
  const title = `${m.name}${m.release_year ? ` (${m.release_year})` : ""}: ficha técnica, variantes y precios`;
  const description =
    m.summary?.slice(0, 160) ??
    `Especificaciones verificadas de ${m.name} de ${m.brand?.name ?? "su fabricante"}: procesador, GPU, RAM, pantalla, batería, variantes, fotos oficiales y opiniones.`;
  const og = galleryImages(m, null)[0];
  return {
    title,
    description,
    alternates: { canonical: `/laptops/${m.slug}` },
    openGraph: { title: `${m.name} | ${site.name}`, description, type: "article", images: og ? [{ url: og.src, alt: og.alt }] : undefined },
  };
}

function KeySpecs({ variant }: { variant: Variant | undefined }) {
  const items: [string, string | null][] = variant
    ? [
        ["Procesador", cpuName(variant.cpu)],
        ["GPU", gpuName(variant.gpu) ?? gpuName(variant.igpu)],
        ["RAM", variant.ram_gb ? `${variant.ram_gb} GB${variant.ram_type ? ` ${variant.ram_type}` : ""}` : null],
        ["Almacenamiento", formatStorage(variant.storage_gb)],
        ["Pantalla", [variant.display_size_in && `${variant.display_size_in}"`, variant.display_resolution, variant.display_refresh_hz && `${variant.display_refresh_hz} Hz`].filter(Boolean).join(" · ") || null],
        ["Peso", variant.weight_kg ? `${variant.weight_kg} kg` : null],
      ]
    : [];
  if (!items.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-3">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-xl border border-border bg-surface p-3">
          <dt className="text-xs text-fg-muted">{k}</dt>
          <dd className={`mt-0.5 text-sm font-medium ${v ? "" : "italic text-fg-muted/70"}`}>{v ?? "Desconocido"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Analysis({ model }: { model: ModelDetail }) {
  const blocks: [string, string | null][] = [
    ["Rendimiento", model.performance_notes],
    ["Temperaturas", model.thermals_notes],
    ["Posibilidades de actualización", model.upgradeability_notes],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="font-display font-semibold text-success">Ventajas</h3>
        {model.pros.length ? (
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">{model.pros.map((p) => <li key={p}>{p}</li>)}</ul>
        ) : (
          <p className="mt-2 text-sm italic text-fg-muted">Aún no hay análisis editorial verificado.</p>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="font-display font-semibold text-danger">Desventajas</h3>
        {model.cons.length ? (
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">{model.cons.map((p) => <li key={p}>{p}</li>)}</ul>
        ) : (
          <p className="mt-2 text-sm italic text-fg-muted">Aún no hay análisis editorial verificado.</p>
        )}
      </div>
      {blocks.map(([t, body]) => (
        <div key={t} className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="font-display font-semibold">{t}</h3>
          <p className={`mt-2 whitespace-pre-line text-sm ${body ? "" : "italic text-fg-muted"}`}>{body ?? "Sin información verificada todavía."}</p>
        </div>
      ))}
    </div>
  );
}

function VariantDiff({ variants }: { variants: Variant[] }) {
  const rows = differingRows(variants);
  if (!rows.length) return null;
  return (
    <section aria-labelledby="diferencias" className="mt-12">
      <h2 id="diferencias" className="font-display text-2xl font-semibold">Diferencias entre variantes</h2>
      <p className="mt-1 text-sm text-fg-muted">Solo se muestran las especificaciones que cambian entre configuraciones.</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-surface-2/60 text-left">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Especificación</th>
              {variants.map((v) => (
                <th key={v.id} scope="col" className="px-4 py-2.5 font-semibold">
                  {v.name}
                  {v.sku && <span className="block text-xs font-normal text-fg-muted">{v.sku}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {rows.map(({ group, row }) => (
              <tr key={`${group}-${row.label}`}>
                <th scope="row" className="px-4 py-2.5 text-left font-normal text-fg-muted">
                  {group} · {row.label}
                </th>
                {variants.map((v) => {
                  const val = row.value(v);
                  return (
                    <td key={v.id} className={`px-4 py-2.5 ${val ? "" : "italic text-fg-muted/70"}`}>
                      {val ?? "Desconocido"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function ModelContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await getModelDetail(slug);
  if (!res.ok) return <EmptyState title="Ficha no disponible" reason={res.reason} />;
  const model = res.data;
  if (!model) notFound();

  const variants = model.variants ?? [];
  const defaultVariant = variants[0];
  const images = galleryImages(model, null);
  const url = `${site.url}/laptops/${model.slug}`;
  const usageLabels = model.use_cases.map((u) => useCases.find((c) => c.slug === u)).filter(Boolean);

  const breadcrumb = [
    { name: "Marcas", path: "/marcas" },
    model.brand && { name: model.brand.name, path: `/marcas/${model.brand.slug}` },
    model.brand && model.family && { name: model.family.name, path: `/marcas/${model.brand.slug}/${model.family.slug}` },
  ].filter(Boolean) as { name: string; path: string }[];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: model.name,
          url,
          category: "Laptop",
          ...(model.brand && { brand: { "@type": "Brand", name: model.brand.name } }),
          ...(model.summary && { description: model.summary }),
          ...(images.length && { image: images.map((i) => i.src) }),
          ...(defaultVariant?.sku && { sku: defaultVariant.sku }),
          ...(model.release_date && { releaseDate: model.release_date }),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [...breadcrumb, { name: model.name, path: `/laptops/${model.slug}` }].map((b, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: b.name,
            item: `${site.url}${b.path}`,
          })),
        }}
      />

      <nav aria-label="Ruta" className="text-sm text-fg-muted">
        {breadcrumb.map((b) => (
          <span key={b.path}>
            <Link href={b.path} className="hover:text-fg">{b.name}</Link> /{" "}
          </span>
        ))}
        <span className="text-fg">{model.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          {images.length ? (
            <Gallery images={images} name={model.name} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <LaptopImage image={null} name={model.name} />
              <p className="border-t border-border bg-surface px-4 py-2 text-xs text-fg-muted">
                No hay fotografías verificadas del modelo exacto. No mostramos imágenes de modelos parecidos.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-fg-muted">
              {model.brand?.name}
              {model.family && ` · ${model.family.name}`}
              {model.generation && ` · ${model.generation}`}
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{model.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={model.commercial_status} />
            {model.category && <Badge tone="primary">{categoryLabels[model.category] ?? model.category}</Badge>}
            {model.release_year && (
              <span className="inline-flex items-center gap-1 text-sm text-fg-muted">
                <CalendarDays className="h-4 w-4" /> {model.release_date ? formatDate(model.release_date) : model.release_year}
              </span>
            )}
          </div>
          {(model.commercial_status === "current" || model.commercial_status === "in_stores") && model.status_verified_at && (
            <p className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Estado comprobado el {formatDate(model.status_verified_at)}
              {model.status_source && <> en {model.status_source.homepage_url ? <a href={model.status_source.homepage_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{model.status_source.name}</a> : model.status_source.name}</>}
            </p>
          )}
          {model.summary && <p className="text-fg-muted">{model.summary}</p>}
          {usageLabels.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Uso recomendado">
              {usageLabels.map((u) => (
                <li key={u!.slug}>
                  <Link href={`/laptops?uso=${u!.slug}`} className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary hover:text-primary">
                    {u!.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {defaultVariant && (
            <div>
              <p className="mb-2 text-xs text-fg-muted">
                Configuración {variants.length > 1 ? "principal" : ""}: <span className="font-medium text-fg">{defaultVariant.name}</span>
              </p>
              <KeySpecs variant={defaultVariant} />
            </div>
          )}
          {model.official_url && (
            <a href={model.official_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Página oficial del fabricante <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      <section aria-labelledby="especificaciones" className="mt-14">
        <h2 id="especificaciones" className="font-display text-2xl font-semibold">Especificaciones técnicas</h2>
        <p className="mb-5 mt-1 text-sm text-fg-muted">
          Cada variante tiene sus propias especificaciones; nunca se mezclan datos de configuraciones distintas.
        </p>
        {variants.length ? (
          <VariantTabs
            tabs={variants.map((v) => {
              const vImages = galleryImages(model, v.id);
              return {
                id: v.id,
                key: v.sku ?? v.id,
                label: v.name,
                sublabel: variantSublabel(v) || v.sku || undefined,
                content: (
                  <div className="space-y-6">
                    {(v.sku || v.region) && (
                      <p className="text-sm text-fg-muted">
                        {v.sku && <>SKU / número de producto: <span className="font-mono text-fg">{v.sku}</span></>}
                        {v.region && <> · Región: {v.region}</>}
                      </p>
                    )}
                    {vImages.length > 0 && (
                      <div className="max-w-md">
                        <h3 className="mb-2 text-sm font-semibold">Imágenes de esta configuración</h3>
                        <Gallery images={vImages} name={`${model.name} — ${v.name}`} />
                      </div>
                    )}
                    <SpecTable variant={v} />
                  </div>
                ),
              };
            })}
          />
        ) : (
          <EmptyState title="Sin variantes registradas" description="Las especificaciones se publicarán cuando se registren configuraciones con fuente." />
        )}
      </section>

      <VariantDiff variants={variants} />

      <section aria-labelledby="analisis" className="mt-14">
        <h2 id="analisis" className="font-display text-2xl font-semibold">Análisis y experiencia de uso</h2>
        <p className="mb-5 mt-1 text-sm text-fg-muted">Valoración editorial. Las opiniones de usuarios se muestran por separado.</p>
        <Analysis model={model} />
      </section>

      <p className="mt-10 text-xs text-fg-muted">Ficha actualizada el {formatDate(model.updated_at)}.</p>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid animate-pulse gap-10 lg:grid-cols-[1.1fr_1fr]" aria-busy="true" aria-label="Cargando ficha">
      <div className="aspect-[4/3] rounded-2xl bg-surface-2" />
      <div className="space-y-4">
        <div className="h-4 w-40 rounded bg-surface-2" />
        <div className="h-10 w-3/4 rounded bg-surface-2" />
        <div className="h-40 rounded-2xl bg-surface-2" />
      </div>
    </div>
  );
}

export default function LaptopPage(props: PageProps<"/laptops/[slug]">) {
  return (
    <Container className="py-10">
      <Suspense fallback={<DetailSkeleton />}>
        <ModelContent params={props.params} />
      </Suspense>
    </Container>
  );
}
