import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { runQuery as run } from "./run";
import type { Brand, Family, ModelCard } from "./types";

const MODEL_CARD_SELECT = `
  id, slug, name, generation, release_year, category, commercial_status, is_featured, popularity,
  brand:brands(slug, name),
  family:families(slug, name),
  images(url, storage_path, alt, is_official, is_placeholder, verified, credit, source_url, sort_order)
`;


export async function getBrands(opts: { featuredOnly?: boolean } = {}) {
  "use cache";
  cacheLife("hours");
  cacheTag("brands");
  return run<Brand[]>([], (db) => {
    let q = db.from("brands").select("id, slug, name, country, website_url, logo_url, description, is_featured").order("name");
    if (opts.featuredOnly) q = q.eq("is_featured", true);
    return q;
  });
}

export async function getBrandWithFamilies(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("brands", `brand:${slug}`);
  return run<(Brand & { families: Family[] }) | null>(null, (db) =>
    db
      .from("brands")
      .select("id, slug, name, country, website_url, logo_url, description, is_featured, families(id, brand_id, slug, name, segment, description)")
      .eq("slug", slug)
      .order("name", { referencedTable: "families" })
      .maybeSingle(),
  );
}

export type ModelListOrder = "featured" | "latest" | "popular";

export async function getModelCards(order: ModelListOrder, limit = 8) {
  "use cache";
  cacheLife("hours");
  cacheTag("models");
  return run<ModelCard[]>([], (db) => {
    let q = db.from("models").select(MODEL_CARD_SELECT).eq("published", true).limit(limit);
    if (order === "featured") q = q.eq("is_featured", true).order("popularity", { ascending: false });
    if (order === "latest") q = q.not("release_date", "is", null).order("release_date", { ascending: false });
    if (order === "popular") q = q.order("popularity", { ascending: false });
    return q;
  });
}

export interface CatalogFilters {
  q?: string;
  brand?: string;
  useCase?: string;
  category?: string;
  status?: string;
  year?: number;
}

export async function searchModels(filters: CatalogFilters, limit = 48) {
  "use cache";
  cacheLife("minutes");
  cacheTag("models");
  return run<ModelCard[]>([], (db) => {
    const brandJoin = filters.brand ? "brand:brands!inner(slug, name)" : "brand:brands(slug, name)";
    let q = db
      .from("models")
      .select(MODEL_CARD_SELECT.replace("brand:brands(slug, name)", brandJoin))
      .eq("published", true)
      .order("popularity", { ascending: false })
      .limit(limit);
    if (filters.q) q = q.textSearch("search", filters.q, { type: "websearch", config: "simple" });
    if (filters.brand) q = q.eq("brand.slug", filters.brand);
    if (filters.useCase) q = q.contains("use_cases", [filters.useCase]);
    if (filters.category) q = q.eq("category", filters.category);
    if (filters.status) q = q.eq("commercial_status", filters.status);
    if (filters.year) q = q.eq("release_year", filters.year);
    return q;
  });
}
