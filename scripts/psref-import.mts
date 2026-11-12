/**
 * Adaptador Lenovo PSREF → data/catalog.
 *
 * Entrada: exportaciones «Excel» por modelo (MTM) que un editor descarga a mano
 * desde psref.lenovo.com (página del modelo → botón Excel). Este script NO accede
 * a PSREF: los términos de Lenovo prohíben la recopilación automatizada.
 *
 *   npm run psref:convert -- <archivos.xlsx | carpeta> [--date AAAA-MM-DD] [--out data/catalog/x.json] [--force]
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readPsrefXlsx } from "../src/lib/psref/parse.ts";
import { psrefToCatalog, slugify } from "../src/lib/psref/to-catalog.ts";
import { catalogFileSchema, formatIssues } from "../src/lib/catalog-import/schema.ts";

const args = process.argv.slice(2);
const flag = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flagValues = new Set(["--date", "--out"].flatMap((f) => (args.includes(f) ? [args[args.indexOf(f) + 1]] : [])));
const inputs = args.filter((a) => !a.startsWith("--") && !flagValues.has(a));
if (!inputs.length) {
  console.error("Uso: psref:convert -- <archivos.xlsx | carpeta> [--date AAAA-MM-DD] [--out ruta.json] [--force]");
  process.exit(2);
}
const date = flag("date") ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error("--date debe tener formato AAAA-MM-DD (fecha de descarga de las exportaciones)");
  process.exit(2);
}

const files = inputs.flatMap((p) =>
  statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.toLowerCase().endsWith(".xlsx")).map((f) => join(p, f)) : [p],
);
const records = files.map((f) => {
  try {
    return readPsrefXlsx(new Uint8Array(readFileSync(f)));
  } catch (e) {
    console.error(`✗ ${f}: ${(e as Error).message}`);
    process.exit(1);
  }
});

const { file, report } = psrefToCatalog(records, { verifiedAt: date });
const parsed = catalogFileSchema.safeParse(file);
if (!parsed.success) {
  console.error("El resultado no supera la validación del catálogo:");
  formatIssues(parsed.error).forEach((m) => console.error(`    ${m}`));
  process.exit(1);
}

const out = flag("out") ?? `data/catalog/lenovo-${slugify(report.product)}.json`;
if (existsSync(out) && !args.includes("--force")) {
  console.error(`${out} ya existe. Usa --force para sobrescribirlo (revisa el diff antes de confirmar).`);
  process.exit(1);
}
writeFileSync(out, JSON.stringify(file, null, 2) + "\n");

console.log(`✓ ${report.product}: ${report.variants} configuración(es) → ${out}`);
report.notes.forEach((n) => console.log(`  · ${n}`));
if (report.unparsed.length) {
  console.log("  Campos que no se pudieron interpretar (quedan como «Desconocido»; revísalos a mano):");
  report.unparsed.forEach((u) => console.log(`    - ${u.mtm} · ${u.field}: ${u.value}`));
}
console.log("  Estado comercial: «sin verificar» (PSREF no confirma disponibilidad). published: false hasta revisión editorial.");
