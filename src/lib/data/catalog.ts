import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { runQuery as run } from "./run";
import type { Brand, Family, ModelCard, ModelDetail } from "./types";

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

const CPU_COLS = "manufacturer, model, architecture, process_node, cores, performance_cores, efficiency_cores, threads, base_clock_ghz, boost_clock_ghz, tdp_w, npu_tops";
const GPU_COLS = "manufacturer, model, is_integrated, vram_gb, vram_type, tgp_min_w, tgp_max_w";

const MODEL_DETAIL_SELECT = `
  id, slug, name, generation, release_year, release_date, category, use_cases, commercial_status,
  status_verified_at, is_featured, popularity, summary, pros, cons, performance_notes, thermals_notes,
  upgradeability_notes, official_url, updated_at,
  brand:brands(slug, name),
  family:families(slug, name),
  status_source:sources!models_status_source_id_fkey(name, homepage_url),
  images(id, variant_id, url, storage_path, alt, angle, is_official, is_placeholder, verified, credit, source_url, license, sort_order),
  variants(
    id, variant_key, sku, name, region, is_default, has_dgpu,
    ram_gb, ram_type, ram_speed_mts, ram_slots, ram_soldered_gb, ram_max_gb,
    storage_gb, storage_type, storage_interface, storage_slots, storage_free_slots, storage_upgradeable,
    display_size_in, display_resolution, display_panel, display_refresh_hz, display_brightness_nits, display_color_gamut, display_touch,
    battery_wh, battery_life_claim, charger_w, weight_kg, dimensions_mm, materials, keyboard, webcam, ports,
    wifi, bluetooth, os, cooling, security_features,
    cpu:cpus(${CPU_COLS}),
    gpu:gpus!variants_gpu_id_fkey(${GPU_COLS}),
    igpu:gpus!variants_igpu_id_fkey(${GPU_COLS}),
    spec_sources(field, verified, source_url, verified_at, source:sources(name, is_official))
  )
`;

export async function getModelDetail(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("models", `model:${slug}`);
  return run<ModelDetail | null>(null, (db) =>
    db
      .from("models")
      .select(MODEL_DETAIL_SELECT)
      .eq("slug", slug)
      .eq("published", true)
      .eq("variants.published", true)
      .order("sort_order", { referencedTable: "images" })
      .order("is_default", { referencedTable: "variants", ascending: false })
      .maybeSingle(),
  );
}

export async function getFamily(brandSlug: string, familySlug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("brands", `brand:${brandSlug}`);
  return run<(Family & { brand: Pick<Brand, "slug" | "name"> }) | null>(null, (db) =>
    db
      .from("families")
      .select("id, brand_id, slug, name, segment, description, brand:brands!inner(slug, name)")
      .eq("slug", familySlug)
      .eq("brand.slug", brandSlug)
      .maybeSingle(),
  );
}

export async function getModelsByFamily(familyId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("models");
  return run<ModelCard[]>([], (db) =>
    db.from("models").select(MODEL_CARD_SELECT).eq("published", true).eq("family_id", familyId).order("release_year", { ascending: false, nullsFirst: false }),
  );
}

/** Lightweight lists for sitemap / static params. */
export async function getSitemapEntries() {
  "use cache";
  cacheLife("hours");
  cacheTag("models", "brands");
  const [models, families] = await Promise.all([
    run<{ slug: string; updated_at: string }[]>([], (db) => db.from("models").select("slug, updated_at").eq("published", true).limit(50000)),
    run<{ slug: string; updated_at: string; brand: { slug: string } | null }[]>([], (db) =>
      db.from("families").select("slug, updated_at, brand:brands(slug)").eq("published", true).limit(50000),
    ),
  ]);
  return { models: models.data, families: families.data };
}
