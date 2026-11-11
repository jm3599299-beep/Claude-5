/**
 * Imports a validated catalog file into PostgreSQL in a single transaction.
 * Idempotent: re-importing the same file updates rows instead of duplicating.
 * All values are sent as bound parameters (postgres.js tagged templates).
 * Runs with a trusted DB connection (bypasses RLS) — CLI / CI use only.
 */
import type { Sql, TransactionSql } from "postgres";
import type { CatalogFile } from "./schema";

export interface ImportStats {
  sources: number;
  brands: number;
  families: number;
  cpus: number;
  gpus: number;
  models: number;
  variants: number;
  specSources: number;
  images: number;
}

export interface ImportResult {
  stats: ImportStats;
  modelSlugs: string[];
  brandSlugs: string[];
  dryRun: boolean;
}

export class ImportError extends Error {}

const VARIANT_COLUMNS = [
  "name", "region", "is_default", "has_dgpu",
  "ram_gb", "ram_type", "ram_speed_mts", "ram_slots", "ram_soldered_gb", "ram_max_gb",
  "storage_gb", "storage_type", "storage_interface", "storage_slots", "storage_free_slots", "storage_upgradeable",
  "display_size_in", "display_resolution", "display_panel", "display_refresh_hz", "display_brightness_nits", "display_color_gamut", "display_touch",
  "battery_wh", "battery_life_claim", "charger_w", "weight_kg", "dimensions_mm", "materials", "keyboard", "webcam",
  "ports", "wifi", "bluetooth", "os", "cooling", "security_features", "published",
] as const;

const MODEL_COLUMNS = [
  "brand_id", "family_id", "name", "generation", "release_year", "release_date", "category", "use_cases",
  "commercial_status", "status_verified_at", "status_source_id", "summary", "pros", "cons",
  "performance_notes", "thermals_notes", "upgradeability_notes", "build_quality_score", "official_url", "is_featured", "published",
] as const;

type Row = Record<string, unknown>;
const pick = (o: Row, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));
const compKey = (c: { manufacturer: string; model: string }) => `${c.manufacturer.toLowerCase()}|${c.model.toLowerCase()}`;
/** Normalizes the display resolution separator to "×". */
const normRes = (r: string | null | undefined) => (r ? r.replace(/\s*[x×]\s*/i, "×") : null);

class DryRunRollback extends Error {}

export async function importCatalog(sql: Sql, file: CatalogFile, opts: { dryRun?: boolean } = {}): Promise<ImportResult> {
  const stats: ImportStats = { sources: 0, brands: 0, families: 0, cpus: 0, gpus: 0, models: 0, variants: 0, specSources: 0, images: 0 };
  const result: ImportResult = { stats, modelSlugs: [], brandSlugs: [], dryRun: !!opts.dryRun };

  try {
    await sql.begin(async (tx) => {
      const sourceIds = await upsertSources(tx, file, stats);

      // Brands & families (optional: most already exist from seed).
      for (const b of file.brands) {
        await tx`insert into brands ${tx({ slug: b.slug, name: b.name, country: b.country ?? null, website_url: b.website_url ?? null, description: b.description ?? null })}
                 on conflict (slug) do update set name = excluded.name,
                   country = coalesce(excluded.country, brands.country),
                   website_url = coalesce(excluded.website_url, brands.website_url),
                   description = coalesce(excluded.description, brands.description)`;
        stats.brands++;
      }
      const brandRows = await tx<{ id: string; slug: string }[]>`select id, slug from brands`;
      const brandId = new Map(brandRows.map((b) => [b.slug, b.id]));
      const needBrand = (slug: string, where: string) => {
        const id = brandId.get(slug);
        if (!id) throw new ImportError(`${where}: la marca «${slug}» no existe (añádela en "brands")`);
        return id;
      };

      for (const f of file.families) {
        const bid = needBrand(f.brand, `familia ${f.slug}`);
        await tx`insert into families ${tx({ brand_id: bid, slug: f.slug, name: f.name, segment: f.segment ?? null, description: f.description ?? null })}
                 on conflict (brand_id, slug) do update set name = excluded.name,
                   segment = coalesce(excluded.segment, families.segment),
                   description = coalesce(excluded.description, families.description)`;
        stats.families++;
      }

      // Components
      for (const c of file.cpus) {
        const { source, ...rest } = c;
        const row = { ...pick(rest, Object.keys(rest)), source_id: source ? sourceIds.get(source)! : null };
        await tx`insert into cpus ${tx(row)} on conflict (manufacturer, model) do update set ${tx(row, Object.keys(row).filter((k) => k !== "manufacturer" && k !== "model"))}`;
        stats.cpus++;
      }
      for (const g of file.gpus) {
        const { source, ...rest } = g;
        const row = { ...pick(rest, Object.keys(rest)), source_id: source ? sourceIds.get(source)! : null };
        await tx`insert into gpus ${tx(row)} on conflict (manufacturer, model) do update set ${tx(row, Object.keys(row).filter((k) => k !== "manufacturer" && k !== "model"))}`;
        stats.gpus++;
      }
      const cpuId = new Map((await tx<{ id: string; manufacturer: string; model: string }[]>`select id, manufacturer, model from cpus`).map((c) => [compKey(c), c.id]));
      const gpuId = new Map((await tx<{ id: string; manufacturer: string; model: string }[]>`select id, manufacturer, model from gpus`).map((c) => [compKey(c), c.id]));
      const resolve = (map: Map<string, string>, ref: { manufacturer: string; model: string } | null | undefined, kind: string, where: string) => {
        if (!ref) return null;
        const id = map.get(compKey(ref));
        if (!id) throw new ImportError(`${where}: ${kind} «${ref.manufacturer} ${ref.model}» no existe; decláralo en "${kind}s"`);
        return id;
      };

      for (const m of file.models) {
        const where = `modelo ${m.slug}`;
        const bid = needBrand(m.brand, where);
        let familyId: string | null = null;
        if (m.family) {
          const [fam] = await tx<{ id: string }[]>`select id from families where brand_id = ${bid} and slug = ${m.family}`;
          if (!fam) throw new ImportError(`${where}: la familia «${m.brand}/${m.family}» no existe`);
          familyId = fam.id;
        }
        const s = m.commercial_status;
        const modelRow = pick(
          {
            ...m,
            brand_id: bid,
            family_id: familyId,
            commercial_status: s.value,
            status_verified_at: s.verified_at ?? null,
            status_source_id: s.source ? sourceIds.get(s.source)! : null,
          },
          MODEL_COLUMNS,
        );
        const [model] = await tx<{ id: string }[]>`
          insert into models ${tx({ slug: m.slug, ...modelRow })}
          on conflict (slug) do update set ${tx(modelRow, [...MODEL_COLUMNS])}
          returning id`;
        stats.models++;
        result.modelSlugs.push(m.slug);
        if (!result.brandSlugs.includes(m.brand)) result.brandSlugs.push(m.brand);

        // A single default variant per model: reset before applying the file's choice.
        if (m.variants.some((v) => v.is_default)) await tx`update variants set is_default = false where model_id = ${model.id}`;

        const variantIdBySku = new Map<string, string>();
        for (const v of m.variants) {
          const vw = `${where} / variante ${v.sku}`;
          const row = {
            ...pick({ ...v, display_resolution: normRes(v.display_resolution) }, VARIANT_COLUMNS),
            cpu_id: resolve(cpuId, v.cpu, "cpu", vw),
            gpu_id: resolve(gpuId, v.gpu, "gpu", vw),
            igpu_id: resolve(gpuId, v.igpu, "gpu", vw),
            has_dgpu: v.has_dgpu ?? (v.gpu ? true : null),
          };
          const cols = Object.keys(row);
          const [variant] = await tx<{ id: string }[]>`
            insert into variants ${tx({ model_id: model.id, sku: v.sku, ...row })}
            on conflict (model_id, sku) do update set ${tx(row, cols)}
            returning id`;
          variantIdBySku.set(v.sku, variant.id);
          stats.variants++;

          // Provenance is replaced as a whole for each imported variant.
          await tx`delete from spec_sources where variant_id = ${variant.id}`;
          for (const p of v.provenance)
            for (const field of p.fields) {
              await tx`insert into spec_sources ${tx({
                variant_id: variant.id,
                field,
                source_id: sourceIds.get(p.source)!,
                source_url: p.url ?? null,
                verified: p.verified,
                verified_at: p.verified ? (p.verified_at ?? new Date().toISOString()) : null,
              })}`;
              stats.specSources++;
            }
        }

        for (const img of m.images) {
          const row = {
            model_id: model.id,
            variant_id: img.variant_sku ? variantIdBySku.get(img.variant_sku)! : null,
            url: img.url,
            alt: img.alt,
            angle: img.angle ?? null,
            is_official: img.is_official,
            is_placeholder: false,
            source_id: img.source ? sourceIds.get(img.source)! : null,
            source_url: img.source_url ?? null,
            license: img.license ?? null,
            credit: img.credit ?? null,
            verified: img.verified,
            verified_at: img.verified ? (img.verified_at ?? new Date().toISOString()) : null,
            sort_order: img.sort_order,
          };
          const updated = await tx`update images set ${tx(row)} where model_id = ${model.id} and url = ${img.url}`;
          if (updated.count === 0) await tx`insert into images ${tx(row)}`;
          stats.images++;
        }
      }

      if (opts.dryRun) throw new DryRunRollback();
    });
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }
  return result;
}

async function upsertSources(tx: TransactionSql, file: CatalogFile, stats: ImportStats) {
  const ids = new Map<string, string>();
  for (const [key, s] of Object.entries(file.sources)) {
    // Sources are identified by name (no natural key in the schema besides it).
    const [existing] = await tx<{ id: string }[]>`select id from sources where name = ${s.name} limit 1`;
    const row = { name: s.name, kind: s.kind, homepage_url: s.homepage_url ?? null, is_official: s.is_official, trust_level: s.trust_level, notes: s.notes ?? null };
    if (existing) {
      await tx`update sources set ${tx(row)} where id = ${existing.id}`;
      ids.set(key, existing.id);
    } else {
      const [created] = await tx<{ id: string }[]>`insert into sources ${tx(row)} returning id`;
      ids.set(key, created.id);
    }
    stats.sources++;
  }
  return ids;
}
