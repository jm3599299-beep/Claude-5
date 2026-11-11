/**
 * LaptopVerse catalog import format.
 *
 * A file describes sources, components (CPU/GPU), optional brands/families and
 * models with their variants and images. Every verified datum must point to a
 * source declared in the same file. See docs/IMPORTING.md.
 */
import { z } from "zod";

export const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug: minúsculas, números y guiones");
const sourceKey = z.string().regex(/^[a-z0-9][a-z0-9-_]*$/, "clave de fuente inválida");
const httpUrl = z.url({ protocol: /^https?$/ });
const isoDate = z.iso.date();
const isoDateTime = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);
const text = (max = 500) => z.string().trim().min(1).max(max);
const opt = <T extends z.ZodType>(t: T) => t.nullish();

export const sourceSchema = z.object({
  name: text(120),
  kind: z.enum(["manufacturer", "press_center", "retailer", "media", "rss", "api", "community", "other"]),
  homepage_url: opt(httpUrl),
  is_official: z.boolean().default(false),
  trust_level: z.number().int().min(1).max(5).default(3),
  notes: opt(text(1000)),
});

const componentRef = z.object({ manufacturer: text(40), model: text(80) });

export const cpuSchema = componentRef.extend({
  architecture: opt(text(60)),
  process_node: opt(text(30)),
  cores: opt(z.number().int().min(1).max(256)),
  performance_cores: opt(z.number().int().min(0).max(256)),
  efficiency_cores: opt(z.number().int().min(0).max(256)),
  threads: opt(z.number().int().min(1).max(512)),
  base_clock_ghz: opt(z.number().positive().max(10)),
  boost_clock_ghz: opt(z.number().positive().max(10)),
  tdp_w: opt(z.number().positive().max(1000)),
  npu_tops: opt(z.number().nonnegative().max(10000)),
  source: opt(sourceKey),
});

export const gpuSchema = componentRef.extend({
  is_integrated: z.boolean().default(false),
  vram_gb: opt(z.number().positive().max(512)),
  vram_type: opt(text(20)),
  tgp_min_w: opt(z.number().positive().max(1000)),
  tgp_max_w: opt(z.number().positive().max(1000)),
  source: opt(sourceKey),
});

/** Spec fields that can carry provenance (mirrors src/lib/specs.ts `field`). */
export const SPEC_FIELDS = [
  "cpu", "gpu", "igpu",
  "ram_gb", "ram_type", "ram_speed_mts", "ram_slots", "ram_soldered_gb", "ram_max_gb",
  "storage_gb", "storage_type", "storage_interface", "storage_slots", "storage_free_slots", "storage_upgradeable",
  "display_size_in", "display_resolution", "display_panel", "display_refresh_hz", "display_brightness_nits", "display_color_gamut", "display_touch",
  "battery_wh", "battery_life_claim", "charger_w", "weight_kg", "dimensions_mm", "materials", "keyboard", "webcam",
  "ports", "wifi", "bluetooth", "os", "cooling", "security_features",
] as const;
export type SpecField = (typeof SPEC_FIELDS)[number];

const int = (min: number, max: number) => opt(z.number().int().min(min).max(max));

export const variantSchema = z
  .object({
    sku: text(80),
    name: text(120),
    region: opt(text(60)),
    is_default: z.boolean().default(false),
    cpu: opt(componentRef),
    gpu: opt(componentRef),
    igpu: opt(componentRef),
    has_dgpu: opt(z.boolean()),
    ram_gb: int(1, 4096),
    ram_type: opt(text(30)),
    ram_speed_mts: int(100, 20000),
    ram_slots: int(0, 8),
    ram_soldered_gb: int(0, 4096),
    ram_max_gb: int(1, 4096),
    storage_gb: int(1, 100000),
    storage_type: opt(text(40)),
    storage_interface: opt(text(40)),
    storage_slots: int(0, 8),
    storage_free_slots: int(0, 8),
    storage_upgradeable: opt(z.boolean()),
    display_size_in: opt(z.number().min(7).max(25)),
    display_resolution: opt(z.string().regex(/^\d{3,5}\s*[×x]\s*\d{3,5}$/, "resolución: ANCHOxALTO")),
    display_panel: opt(text(40)),
    display_refresh_hz: int(30, 1000),
    display_brightness_nits: int(50, 5000),
    display_color_gamut: opt(text(80)),
    display_touch: opt(z.boolean()),
    battery_wh: opt(z.number().positive().max(200)),
    battery_life_claim: opt(text(120)),
    charger_w: int(5, 500),
    weight_kg: opt(z.number().positive().max(10)),
    dimensions_mm: opt(text(60)),
    materials: opt(text(200)),
    keyboard: opt(text(200)),
    webcam: opt(text(120)),
    ports: z.array(text(80)).max(30).default([]),
    wifi: opt(text(40)),
    bluetooth: opt(text(20)),
    os: opt(text(60)),
    cooling: opt(text(200)),
    security_features: z.array(text(80)).max(20).default([]),
    published: z.boolean().default(true),
    /** Which source backs which fields. A field can only be listed if it has a value. */
    provenance: z
      .array(
        z.object({
          source: sourceKey,
          url: opt(httpUrl),
          fields: z.array(z.enum(SPEC_FIELDS)).min(1),
          verified: z.boolean().default(false),
          verified_at: opt(isoDateTime),
        }),
      )
      .default([]),
  })
  .superRefine((v, ctx) => {
    if (v.gpu && v.has_dgpu === false) ctx.addIssue({ code: "custom", path: ["has_dgpu"], message: "has_dgpu=false pero se indicó una GPU dedicada" });
    if (v.ram_soldered_gb != null && v.ram_gb != null && v.ram_soldered_gb > v.ram_gb)
      ctx.addIssue({ code: "custom", path: ["ram_soldered_gb"], message: "la RAM soldada no puede superar la RAM total" });
    if (v.storage_free_slots != null && v.storage_slots != null && v.storage_free_slots > v.storage_slots)
      ctx.addIssue({ code: "custom", path: ["storage_free_slots"], message: "más ranuras libres que totales" });
    const seen = new Set<string>();
    v.provenance.forEach((p, i) => {
      if (p.verified && !p.url) ctx.addIssue({ code: "custom", path: ["provenance", i, "url"], message: "un dato verificado necesita URL de la fuente" });
      p.fields.forEach((f) => {
        if (seen.has(f)) ctx.addIssue({ code: "custom", path: ["provenance", i, "fields"], message: `campo «${f}» con más de una procedencia` });
        seen.add(f);
        const val = (v as Record<string, unknown>)[f];
        if (val == null || (Array.isArray(val) && val.length === 0))
          ctx.addIssue({ code: "custom", path: ["provenance", i, "fields"], message: `no se puede atribuir fuente a «${f}» porque no tiene valor` });
      });
    });
  });

export const imageSchema = z
  .object({
    url: httpUrl,
    alt: text(200),
    angle: opt(z.enum(["front", "side", "back", "top", "open", "closed", "keyboard", "ports"])),
    variant_sku: opt(text(80)),
    is_official: z.boolean().default(false),
    source: opt(sourceKey),
    source_url: opt(httpUrl),
    license: opt(text(120)),
    credit: opt(text(120)),
    verified: z.boolean().default(false),
    verified_at: opt(isoDateTime),
    sort_order: z.number().int().min(0).max(100).default(0),
  })
  .superRefine((img, ctx) => {
    if (img.is_official && (!img.source || !img.source_url))
      ctx.addIssue({ code: "custom", path: ["is_official"], message: "una foto oficial requiere source y source_url" });
    if (img.verified && !img.source_url) ctx.addIssue({ code: "custom", path: ["verified"], message: "una foto verificada requiere source_url" });
  });

const categories = ["gaming", "business", "ultrabook", "workstation", "student", "creator", "2in1", "chromebook", "rugged", "budget", "mainstream"] as const;
const useCases = ["gaming", "estudiantes", "programacion", "diseno", "edicion", "empresariales", "economicas", "alto-rendimiento"] as const;

export const modelSchema = z
  .object({
    brand: slug,
    family: opt(slug),
    slug,
    name: text(120),
    generation: opt(text(60)),
    release_year: int(1980, 2100),
    release_date: opt(isoDate),
    category: opt(z.enum(categories)),
    use_cases: z.array(z.enum(useCases)).default([]),
    commercial_status: z
      .object({
        value: z.enum(["current", "in_stores", "legacy", "discontinued", "unverified"]),
        verified_at: opt(isoDateTime),
        source: opt(sourceKey),
      })
      .default({ value: "unverified" }),
    summary: opt(text(1000)),
    pros: z.array(text(200)).max(15).default([]),
    cons: z.array(text(200)).max(15).default([]),
    performance_notes: opt(text(4000)),
    thermals_notes: opt(text(4000)),
    upgradeability_notes: opt(text(4000)),
    build_quality_score: int(1, 10),
    official_url: opt(httpUrl),
    is_featured: z.boolean().default(false),
    published: z.boolean().default(false),
    variants: z.array(variantSchema).min(1),
    images: z.array(imageSchema).default([]),
  })
  .superRefine((m, ctx) => {
    const s = m.commercial_status;
    if ((s.value === "current" || s.value === "in_stores") && (!s.verified_at || !s.source))
      ctx.addIssue({ code: "custom", path: ["commercial_status"], message: `«${s.value}» exige verified_at y source` });
    if (m.release_date && m.release_year && Number(m.release_date.slice(0, 4)) !== m.release_year)
      ctx.addIssue({ code: "custom", path: ["release_date"], message: "release_date no coincide con release_year" });
    const skus = m.variants.map((v) => v.sku);
    const dup = skus.find((s, i) => skus.indexOf(s) !== i);
    if (dup) ctx.addIssue({ code: "custom", path: ["variants"], message: `SKU duplicado: ${dup}` });
    if (m.variants.filter((v) => v.is_default).length > 1) ctx.addIssue({ code: "custom", path: ["variants"], message: "más de una variante is_default" });
    m.images.forEach((img, i) => {
      if (img.variant_sku && !skus.includes(img.variant_sku))
        ctx.addIssue({ code: "custom", path: ["images", i, "variant_sku"], message: `la variante ${img.variant_sku} no existe en este modelo` });
    });
  });

export const catalogFileSchema = z
  .object({
    $schema: z.string().optional(),
    sources: z.record(sourceKey, sourceSchema).default({}),
    brands: z
      .array(
        z.object({
          slug,
          name: text(60),
          country: opt(text(60)),
          website_url: opt(httpUrl),
          description: opt(text(1000)),
        }),
      )
      .default([]),
    families: z.array(z.object({ brand: slug, slug, name: text(60), segment: opt(text(60)), description: opt(text(1000)) })).default([]),
    cpus: z.array(cpuSchema).default([]),
    gpus: z.array(gpuSchema).default([]),
    models: z.array(modelSchema).default([]),
  })
  .superRefine((f, ctx) => {
    // Every referenced source key must be declared in the file.
    const known = new Set(Object.keys(f.sources));
    const check = (key: string | null | undefined, path: (string | number)[]) => {
      if (key && !known.has(key)) ctx.addIssue({ code: "custom", path, message: `fuente «${key}» no declarada en "sources"` });
    };
    f.cpus.forEach((c, i) => check(c.source, ["cpus", i, "source"]));
    f.gpus.forEach((g, i) => check(g.source, ["gpus", i, "source"]));
    const slugs = new Set<string>();
    f.models.forEach((m, mi) => {
      if (slugs.has(m.slug)) ctx.addIssue({ code: "custom", path: ["models", mi, "slug"], message: `slug duplicado: ${m.slug}` });
      slugs.add(m.slug);
      check(m.commercial_status.source, ["models", mi, "commercial_status", "source"]);
      m.images.forEach((img, ii) => check(img.source, ["models", mi, "images", ii, "source"]));
      m.variants.forEach((v, vi) => v.provenance.forEach((p, pi) => check(p.source, ["models", mi, "variants", vi, "provenance", pi, "source"])));
    });
  });

export type CatalogFile = z.infer<typeof catalogFileSchema>;
export type CatalogModel = z.infer<typeof modelSchema>;
export type CatalogVariant = z.infer<typeof variantSchema>;

/** Human-readable validation errors with JSON paths. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(raíz)"}: ${i.message}`);
}
