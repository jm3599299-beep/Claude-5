import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { runQuery as run } from "./run";
import type { Brand, Family, ModelCard, ModelDetail } from "./types";

const MODEL_CARD_SELECT = `
  id, slug, name, generation, release_year, category, commercial_status, is_featured, popularity,
  brand:brands(slug, name),
  family:families(slug, name),
  images(url, storage_path, alt, is_official, is_placeholder, verified, credit, source_url, rights_basis, license, license_url, author, sort_order)
`;


export async function getBrands(opts: { featuredOnly?: boolean } = {}) {
  "use cache";
  cacheTag("brands");
  const res = await run<Brand[]>([], (db) => {
    let q = db.from("brands").select("id, slug, name, country, website_url, logo_url, description, is_featured").order("name");
    if (opts.featuredOnly) q = q.eq("is_featured", true);
    return q;
  });
  if (res.ok) cacheLife("hours");
  else cacheLife("minutes"); // errors are retried soon instead of being cached for long
  return res;
}

export async function getBrandWithFamilies(slug: string) {
  "use cache";
  cacheTag("brands", `brand:${slug}`);
  const res = await run<(Brand & { families: Family[] }) | null>(null, (db) =>
    db
      .from("brands")
      .select("id, slug, name, country, website_url, logo_url, description, is_featured, families(id, brand_id, slug, name, segment, description)")
      .eq("slug", slug)
      .order("name", { referencedTable: "families" })
      .maybeSingle(),
  );
  if (res.ok) cacheLife("hours");
  else cacheLife("minutes"); // errors are retried soon instead of being cached for long
  return res;
}

export type ModelListOrder = "featured" | "latest" | "popular";

export async function getModelCards(order: ModelListOrder, limit = 8) {
  "use cache";
  cacheTag("models");
  const res = await run<ModelCard[]>([], (db) => {
    let q = db.from("models").select(MODEL_CARD_SELECT).eq("published", true).limit(limit);
    if (order === "featured") q = q.eq("is_featured", true).order("popularity", { ascending: false });
    if (order === "latest") q = q.not("release_date", "is", null).order("release_date", { ascending: false });
    if (order === "popular") q = q.order("popularity", { ascending: false });
    return q;
  });
  if (res.ok) cacheLife("hours");
  else cacheLife("minutes"); // errors are retried soon instead of being cached for long
  return res;
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
  cacheTag("models");
  const res = await run<ModelCard[]>([], (db) => {
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
  cacheLife("minutes");
  return res;
}

const CPU_COLS = "manufacturer, model, architecture, process_node, cores, performance_cores, efficiency_cores, threads, base_clock_ghz, boost_clock_ghz, tdp_w, npu_tops";
const GPU_COLS = "manufacturer, model, is_integrated, vram_gb, vram_type, tgp_min_w, tgp_max_w";

const MODEL_DETAIL_SELECT = `
  id, slug, name, generation, release_year, release_date, category, use_cases, commercial_status,
  status_verified_at, is_featured, popularity, summary, pros, cons, performance_notes, thermals_notes,
  upgradeability_notes, build_quality_score, official_url, updated_at,
  brand:brands(slug, name),
  family:families(slug, name),
  status_source:sources!models_status_source_id_fkey(name, homepage_url),
  images(id, variant_id, url, storage_path, alt, angle, is_official, is_placeholder, verified, credit, source_url, license, license_url, author, rights_basis, sort_order),
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
    spec_sources(field, verified, source_url, verified_at, source:sources(name, is_official)),
    prices(kind, country_code, currency_code, amount, observed_at, product_url, in_stock, store:stores(name), source:sources(name, homepage_url))
  )
`;

export async function getModelDetail(slug: string) {
  "use cache";
  cacheTag("models", `model:${slug}`);
  const res = await run<ModelDetail | null>(null, (db) =>
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
  if (res.ok) cacheLife("hours");
  else cacheLife("minutes"); // errors are retried soon instead of being cached for long
  return res;
}

export async function getFamily(brandSlug: string, familySlug: string) {
  "use cache";
  cacheTag("brands", `brand:${brandSlug}`);
  const res = await run<(Family & { brand: Pick<Brand, "slug" | "name"> }) | null>(null, (db) =>
    db
      .from("families")
      .select("id, brand_id, slug, name, segment, description, brand:brands!inner(slug, name)")
      .eq("slug", familySlug)
      .eq("brand.slug", brandSlug)
      .maybeSingle(),
  );
  if (res.ok) cacheLife("hours");
  else cacheLife("minutes"); // errors are retried soon instead of being cached for long
  return res;
}

export async function getModelsByFamily(familyId: string) {
  "use cache";
  cacheTag("models");
  const res = await run<ModelCard[]>([], (db) =>
    db.from("models").select(MODEL_CARD_SELECT).eq("published", true).eq("family_id", familyId).order("release_year", { ascending: false, nullsFirst: false }),
  );
  if (res.ok) cacheLife("hours");
  else cacheLife("minutes"); // errors are retried soon instead of being cached for long
  return res;
}

/** Lightweight lists for sitemap / static params. */
export async function getSitemapEntries() {
  "use cache";
  cacheTag("models", "brands");
  const [models, families] = await Promise.all([
    run<{ slug: string; updated_at: string }[]>([], (db) => db.from("models").select("slug, updated_at").eq("published", true).limit(50000)),
    run<{ slug: string; updated_at: string; brand: { slug: string } | null }[]>([], (db) =>
      db.from("families").select("slug, updated_at, brand:brands(slug)").eq("published", true).limit(50000),
    ),
  ]);
  if (models.ok && families.ok) cacheLife("hours");
  else cacheLife("minutes");
  return { models: models.data, families: families.data };
}

export interface LatestRate {
  base: string;
  quote: string;
  rate: number;
  provider: string;
  rate_date: string;
}

/** Latest stored USD-based exchange rates (synced daily by a scheduled job). */
export async function getLatestRates() {
  "use cache";
  cacheTag("rates");
  const res = await run<LatestRate[]>([], (db) => db.from("latest_exchange_rates").select("base, quote, rate, provider, rate_date").eq("base", "USD"));
  if (res.ok) cacheLife("hours");
  else cacheLife("minutes"); // errors are retried soon instead of being cached for long
  return res;
}

/** Full detail for several models at once (comparator). */
export async function getModelsForCompare(slugs: string[]) {
  "use cache";
  cacheTag("models", ...slugs.map((s) => `model:${s}`));
  if (!slugs.length) {
    cacheLife("hours");
    return { ok: true as const, data: [] as ModelDetail[] };
  }
  const res = await run<ModelDetail[]>([], (db) => db.from("models").select(MODEL_DETAIL_SELECT).in("slug", slugs).eq("published", true).eq("variants.published", true));
  if (res.ok) cacheLife("hours");
  else cacheLife("minutes"); // errors are retried soon instead of being cached for long
  return res;
}

export interface PickerModel {
  slug: string;
  name: string;
  brand: { name: string } | null;
  variants: { variant_key: string; name: string }[];
}

/** Lightweight model+variant list for the comparator picker (name substring match). */
export async function searchForPicker(q: string) {
  "use cache";
  cacheTag("models");
  const safe = q.replace(/[%_,()*\\]/g, " ").trim();
  if (safe.length < 2) {
    cacheLife("minutes");
    return { ok: true as const, data: [] as PickerModel[] };
  }
  const res = await run<PickerModel[]>([], (db) =>
    db
      .from("models")
      .select("slug, name, brand:brands(name), variants(variant_key, name)")
      .eq("published", true)
      .eq("variants.published", true)
      .ilike("name", `%${safe}%`)
      .order("name")
      .limit(10),
  );
  cacheLife("minutes");
  return res;
}
