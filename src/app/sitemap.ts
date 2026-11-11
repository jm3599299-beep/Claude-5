import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getBrands, getSitemapEntries } from "@/lib/data/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [brands, { models, families }] = await Promise.all([getBrands(), getSitemapEntries()]);
  const u = (p: string) => `${site.url}${p}`;
  return [
    ...["", "/laptops", "/marcas", "/metodologia"].map((p) => ({ url: u(p), changeFrequency: "daily" as const })),
    ...brands.data.map((b) => ({ url: u(`/marcas/${b.slug}`), changeFrequency: "weekly" as const })),
    ...families.filter((f) => f.brand).map((f) => ({ url: u(`/marcas/${f.brand!.slug}/${f.slug}`), lastModified: f.updated_at, changeFrequency: "weekly" as const })),
    ...models.map((m) => ({ url: u(`/laptops/${m.slug}`), lastModified: m.updated_at, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
