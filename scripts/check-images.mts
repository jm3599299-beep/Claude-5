/**
 * Comprobación técnica de las imágenes del catálogo:
 * host autorizado, respuesta 200, tipo MIME de imagen permitido,
 * tamaño máximo y dimensiones mínimas (lee la cabecera real del archivo).
 *
 *   npm run images:check -- data/catalog
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { imageSize } from "image-size";
import { isAllowedImageUrl } from "../src/lib/images/hosts.ts";
import { catalogFileSchema } from "../src/lib/catalog-import/schema.ts";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_BYTES = 20 * 1024 * 1024;
const MIN_WIDTH = 600;

const targets = process.argv.slice(2).filter((a) => !a.startsWith("--"));
function collect(p: string): string[] {
  return statSync(p).isDirectory()
    ? readdirSync(p).filter((f) => f.endsWith(".json") && !f.startsWith("_")).flatMap((f) => collect(join(p, f)))
    : [p];
}
const files = targets.flatMap((t) => collect(t));

let checked = 0;
let failed = 0;
for (const file of files) {
  const data = catalogFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  for (const m of data.models)
    for (const img of m.images) {
      checked++;
      const where = `${m.slug} · ${img.url}`;
      const problems: string[] = [];
      if (!isAllowedImageUrl(img.url)) problems.push("host no autorizado");
      else {
        try {
          const res = await fetch(img.url, { headers: { "user-agent": "LaptopVerseCatalog/0.1 (image check)" }, redirect: "follow" });
          const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
          const len = Number(res.headers.get("content-length") ?? 0);
          if (!res.ok) problems.push(`HTTP ${res.status}`);
          else if (!ALLOWED.has(type)) problems.push(`tipo no permitido: ${type || "desconocido"}`);
          else if (len > MAX_BYTES) problems.push(`demasiado grande: ${(len / 1048576).toFixed(1)} MB`);
          else {
            const buf = new Uint8Array(await res.arrayBuffer());
            if (buf.byteLength > MAX_BYTES) problems.push("demasiado grande");
            const dim = imageSize(buf);
            if (!dim.width || dim.width < MIN_WIDTH) problems.push(`ancho insuficiente: ${dim.width ?? "?"}px (mínimo ${MIN_WIDTH})`);
            else console.log(`✓ ${where} — ${type}, ${dim.width}×${dim.height}, ${(buf.byteLength / 1024).toFixed(0)} KB`);
          }
        } catch (e) {
          problems.push(`no se pudo descargar: ${(e as Error).message}`);
        }
      }
      if (problems.length) {
        failed++;
        console.error(`✗ ${where}: ${problems.join("; ")}`);
      }
    }
}
console.log(`\n${checked} imágenes comprobadas, ${failed} con problemas.`);
process.exit(failed ? 1 : 0);
