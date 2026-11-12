/**
 * Obtiene autor y licencia de un archivo de Wikimedia Commons y genera la
 * entrada de imagen para data/catalog. Una persona debe confirmar que la foto
 * muestra el modelo y la generación exactos antes de marcarla como verified.
 *
 *   npm run images:commons -- "File:Nombre.jpg" [--angle front] [--variant clave]
 */
import { CommonsLicenseError, entryFromCommons, type CommonsImageInfo } from "../src/lib/images/commons.ts";

const args = process.argv.slice(2);
const title = args.find((a) => !a.startsWith("--"));
const flag = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!title?.startsWith("File:")) {
  console.error('Uso: images:commons -- "File:Nombre.jpg" [--angle front] [--variant clave]');
  process.exit(2);
}

const api = new URL("https://commons.wikimedia.org/w/api.php");
api.search = new URLSearchParams({
  action: "query",
  titles: title,
  prop: "imageinfo",
  iiprop: "url|mime|size|extmetadata",
  format: "json",
  formatversion: "2",
  maxlag: "5",
}).toString();

const res = await fetch(api, { headers: { "user-agent": "LaptopVerseCatalog/0.1 (image license check; low volume)" } });
if (res.status === 429) {
  console.error("Wikimedia ha limitado las peticiones (429). Espera unos minutos y vuelve a intentarlo; no reintentes en bucle.");
  process.exit(3);
}
if (!res.ok) {
  console.error(`Error ${res.status} consultando Commons`);
  process.exit(1);
}
const body = (await res.json()) as { query?: { pages?: { missing?: boolean; imageinfo?: CommonsImageInfo[] }[] } };
const page = body.query?.pages?.[0];
if (!page || page.missing || !page.imageinfo?.[0]) {
  console.error(`No existe ${title} en Commons`);
  process.exit(1);
}
try {
  const e = entryFromCommons(page.imageinfo[0]);
  const entry = {
    url: e.url,
    alt: "DESCRIBIR: modelo, color y ángulo exactos",
    angle: flag("angle") ?? null,
    variant_key: flag("variant") ?? null,
    source: "wikimedia-commons",
    source_url: e.source_url,
    rights_basis: e.rights_basis,
    license: e.license,
    license_url: e.license_url,
    author: e.author,
    credit: e.credit,
    verified: false,
  };
  console.log(JSON.stringify(entry, null, 2));
  console.error(`\n${e.width}×${e.height}px. Revisa que la foto muestre el modelo exacto y luego pon "verified": true.`);
  console.error('Declara en "sources": "wikimedia-commons": { "name": "Wikimedia Commons", "kind": "other", "homepage_url": "https://commons.wikimedia.org" }');
} catch (err) {
  if (err instanceof CommonsLicenseError) {
    console.error(`Rechazada: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
