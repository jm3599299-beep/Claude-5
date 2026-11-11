import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getBrands } from "@/lib/data/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const brands = await getBrands();
  const staticRoutes = ["", "/laptops", "/marcas", "/metodologia"].map((p) => ({ url: `${site.url}${p}`, changeFrequency: "daily" as const }));
  const brandRoutes = brands.data.map((b) => ({ url: `${site.url}/marcas/${b.slug}`, changeFrequency: "weekly" as const }));
  return [...staticRoutes, ...brandRoutes];
}
