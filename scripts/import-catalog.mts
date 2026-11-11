/**
 * LaptopVerse — importador de catálogo.
 *
 *   npm run catalog:validate -- data/catalog            # solo valida (sin base de datos)
 *   npm run catalog:import -- data/catalog --dry-run    # importa y revierte (informe)
 *   npm run catalog:import -- data/catalog/lenovo.json  # importa
 *
 * Requiere DATABASE_URL (cadena de conexión de Supabase, Settings → Database).
 * Opcional: REVALIDATE_URL + REVALIDATE_SECRET para refrescar la caché del sitio.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { catalogFileSchema, formatIssues, type CatalogFile } from "../src/lib/catalog-import/schema.ts";
import { ImportError, importCatalog } from "../src/lib/catalog-import/importer.ts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const validateOnly = args.includes("--validate-only");
const targets = args.filter((a) => !a.startsWith("--"));
if (!targets.length) {
  console.error("Uso: import-catalog <archivo.json|directorio>... [--dry-run] [--validate-only]");
  process.exit(2);
}

function collect(path: string): string[] {
  if (statSync(path).isDirectory())
    return readdirSync(path)
      .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
      .sort()
      .flatMap((f) => collect(join(path, f)));
  return [path];
}

const files = targets.flatMap(collect);
const parsed: { path: string; data: CatalogFile }[] = [];
let invalid = 0;
for (const path of files) {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`✗ ${path}: JSON inválido — ${(e as Error).message}`);
    invalid++;
    continue;
  }
  const r = catalogFileSchema.safeParse(raw);
  if (!r.success) {
    console.error(`✗ ${path}`);
    formatIssues(r.error).forEach((m) => console.error(`    ${m}`));
    invalid++;
    continue;
  }
  const d = r.data;
  console.log(`✓ ${path}: ${d.models.length} modelos, ${d.models.reduce((n, m) => n + m.variants.length, 0)} variantes`);
  parsed.push({ path, data: d });
}
if (invalid) {
  console.error(`\n${invalid} archivo(s) con errores. No se importó nada.`);
  process.exit(1);
}
if (validateOnly) process.exit(0);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL. Usa --validate-only para validar sin base de datos.");
  process.exit(2);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const [run] = await sql<{ id: string }[]>`insert into sync_runs (job, status) values ('catalog_import', 'running') returning id`;
const modelSlugs = new Set<string>();
const brandSlugs = new Set<string>();
const totals: Record<string, number> = {};
let failed = 0;

for (const { path, data } of parsed) {
  try {
    const res = await importCatalog(sql, data, { dryRun });
    Object.entries(res.stats).forEach(([k, v]) => (totals[k] = (totals[k] ?? 0) + v));
    res.modelSlugs.forEach((s) => modelSlugs.add(s));
    res.brandSlugs.forEach((s) => brandSlugs.add(s));
    console.log(`${dryRun ? "◌ (simulado)" : "↑"} ${path}: ${JSON.stringify(res.stats)}`);
  } catch (e) {
    failed++;
    const msg = e instanceof ImportError ? e.message : `${(e as Error).message}`;
    console.error(`✗ ${path}: ${msg} (archivo revertido por completo)`);
  }
}

await sql`update sync_runs set status = ${failed ? (failed === parsed.length ? "failed" : "partial") : "success"},
  finished_at = now(), stats = ${sql.json({ ...totals, dryRun, files: parsed.length, failed })}, error = ${failed ? `${failed} archivo(s) fallaron` : null}
  where id = ${run.id}`;
await sql.end();

if (!dryRun && modelSlugs.size && process.env.REVALIDATE_URL && process.env.REVALIDATE_SECRET) {
  const tags = ["models", "brands", ...[...modelSlugs].map((s) => `model:${s}`), ...[...brandSlugs].map((s) => `brand:${s}`)];
  const r = await fetch(process.env.REVALIDATE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.REVALIDATE_SECRET}` },
    body: JSON.stringify({ tags }),
  });
  console.log(r.ok ? `Caché revalidada (${tags.length} etiquetas)` : `Aviso: la revalidación respondió ${r.status}`);
}

console.log(`\nTotal: ${JSON.stringify(totals)}${dryRun ? " — simulación, sin cambios" : ""}`);
process.exit(failed ? 1 : 0);
