import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getBrands, getSitemapEntries } from "@/lib/data/catalog";
import { getNewsSitemap } from "@/lib/data/news";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [brands, { models, families }, { news, weekly }] = await Promise.all([getBrands(), getSitemapEntries(), getNewsSitemap()]);
  const u = (p: string) => `${site.url}${p}`;
  return [
    ...["", "/laptops", "/marcas", "/comparar", "/noticias", "/weekly", "/comunidad", "/normas", "/metodologia"].map((p) => ({ url: u(p), changeFrequency: "daily" as const })),
    ...brands.data.map((b) => ({ url: u(`/marcas/${b.slug}`), changeFrequency: "weekly" as const })),
    ...families.filter((f) => f.brand).map((f) => ({ url: u(`/marcas/${f.brand!.slug}/${f.slug}`), lastModified: f.updated_at, changeFrequency: "weekly" as const })),
    ...models.map((m) => ({ url: u(`/laptops/${m.slug}`), lastModified: m.updated_at, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...news.map((n) => ({ url: u(`/noticias/${n.slug}`), lastModified: n.published_at, changeFrequency: "monthly" as const })),
    ...weekly.map((w) => ({ url: u(`/weekly/${w.slug}`), lastModified: w.week_end, changeFrequency: "monthly" as const })),
  ];
}
