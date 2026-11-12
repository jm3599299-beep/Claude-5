/**
 * Wikimedia Commons helpers: turn a file's `extmetadata` into a LaptopVerse
 * image entry with author and license. Only licenses we can comply with are
 * accepted; anything else is rejected rather than guessed.
 */
export type RightsBasis = "cc0" | "cc-by" | "cc-by-sa";

export interface CommonsImageInfo {
  url: string;
  descriptionurl: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  extmetadata?: Record<string, { value: string } | undefined>;
}

export interface CommonsEntry {
  url: string;
  source_url: string;
  rights_basis: RightsBasis;
  license: string;
  license_url: string | null;
  author: string | null;
  credit: string;
  width: number;
  height: number;
}

export class CommonsLicenseError extends Error {}

/** Strip HTML tags/entities from Commons metadata values. */
export function plainText(html: string | undefined): string | null {
  if (!html) return null;
  const t = html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t || null;
}

export function rightsFromLicense(shortName: string): RightsBasis {
  const n = shortName.trim().toLowerCase();
  if (n === "cc0" || n.startsWith("cc0 ") || n === "public domain" || n.startsWith("pd")) return "cc0";
  if (/^cc[ -]by[ -]sa\b/.test(n)) return "cc-by-sa";
  if (/^cc[ -]by\b/.test(n) && !/\bnc\b|\bnd\b/.test(n)) return "cc-by";
  throw new CommonsLicenseError(`Licencia no admitida: «${shortName}». Solo CC0, dominio público, CC BY y CC BY-SA.`);
}

export function entryFromCommons(info: CommonsImageInfo): CommonsEntry {
  const meta = info.extmetadata ?? {};
  const license = plainText(meta.LicenseShortName?.value);
  if (!license) throw new CommonsLicenseError("El archivo no declara licencia en sus metadatos.");
  const rights_basis = rightsFromLicense(license);
  const author = plainText(meta.Artist?.value);
  const license_url = meta.LicenseUrl?.value?.trim() || null;
  if (rights_basis !== "cc0" && (!author || !license_url))
    throw new CommonsLicenseError("La licencia exige atribución pero faltan autor o URL de licencia en los metadatos.");
  if (!/^image\/(jpeg|png|webp)$/.test(info.mime)) throw new CommonsLicenseError(`Formato no admitido: ${info.mime}`);
  return {
    url: info.url,
    source_url: info.descriptionurl,
    rights_basis,
    license,
    license_url,
    author,
    credit: `${author ?? "Autor desconocido"} / Wikimedia Commons`,
    width: info.width,
    height: info.height,
  };
}
