/**
 * News pipeline rules: relevance, categories, labels, deduplication and
 * publication policy. Pure and deterministic; covered by unit tests.
 */
import { createHash } from "node:crypto";

export const CATEGORIES = {
  lanzamientos: "Lanzamientos",
  procesadores: "Procesadores",
  gpu: "Tarjetas gráficas",
  gaming: "Laptops gaming",
  empresariales: "Laptops empresariales",
  estudiantes: "Estudiantes",
  macbook: "MacBook y macOS",
  resenas: "Reseñas y pruebas",
  ia: "Inteligencia artificial",
  pantallas: "Pantallas",
  refrigeracion: "Refrigeración",
  baterias: "Baterías",
  sistemas: "Windows y Linux",
  actualizaciones: "Actualizaciones",
  general: "Industria",
} as const;
export type Category = keyof typeof CATEGORIES;
export type NewsLabel = "official" | "analysis" | "rumor" | "leak";

/** Ordered: the first matching rule wins. Word-boundary, case-insensitive. */
/**
 * Ordered: the first matching rule wins. Specific product families come first so
 * that passing comparisons ("looks like a MacBook") do not decide the category.
 */
const CATEGORY_RULES: [Category, RegExp][] = [
  ["gaming", /\b(gaming laptop|legion|loq|rog|tuf gaming|omen|victus|alienware|predator|nitro|katana|raider|stealth|titan|blade|aorus)\b/i],
  ["empresariales", /\b(thinkpad|thinkbook|latitude|precision|elitebook|probook|expertbook|travelmate|lifebook|business laptop|enterprise laptop)\b/i],
  ["macbook", /\b(macbook|macos|apple silicon)\b/i],
  ["resenas", /\b(review|hands-on|tested|análisis|prueba)\b/i],
  ["gpu", /\b(geforce|rtx \d{4}|radeon|arc graphics|laptop gpu|graphics card)\b/i],
  ["procesadores", /\b(core ultra|ryzen|snapdragon x|processor|cpu|chipset|lunar lake|panther lake|arrow lake|nova lake|zen \d)\b/i],
  ["ia", /\b(ai pc|copilot\+?|npu|on-device ai)\b/i],
  ["pantallas", /\b(oled|mini-?led|display|panel|refresh rate)\b/i],
  ["baterias", /\b(battery|batería|charging)\b/i],
  ["refrigeracion", /\b(cooling|thermal|vapor chamber)\b/i],
  ["sistemas", /\b(windows 1[0-2]|windows update|linux|ubuntu|chromeos)\b/i],
  ["estudiantes", /\b(student|education|back to school|chromebook)\b/i],
  ["actualizaciones", /\b(firmware|bios update|driver update|security patch)\b/i],
  ["lanzamientos", /\b(launch|announce|unveil|introduc|debut|available now|now available|release)\w*/i],
];

/** Shopping deals are commerce, not news: never collected. */
const DEALS = /\b(deal|deals|discount|lowest price|price drop|on sale|sale price|coupon|black friday|cyber monday|prime day|save \$\d+|\$\d+ off|% off)\b/i;
export const isDeal = (title: string) => DEALS.test(title);

const LAPTOP_TERMS =
  /\b(laptop|notebook|ultrabook|2-in-1|convertible|macbook|thinkpad|thinkbook|ideapad|yoga|legion|loq|xps|latitude|inspiron|precision|alienware|elitebook|probook|spectre|envy|pavilion|victus|omen|zenbook|vivobook|expertbook|rog|tuf|aspire|swift|predator|nitro|travelmate|surface laptop|galaxy book|matebook|framework laptop|copilot\+ pc|ai pc|core ultra|ryzen ai|snapdragon x|geforce rtx \d{4} laptop|laptop gpu|mobile (cpu|processor|gpu))\b/i;

export function isRelevant(title: string, summary: string): boolean {
  return !isDeal(title) && LAPTOP_TERMS.test(`${title} ${summary}`);
}

const FAMILY_CATEGORIES = new Set<Category>(["gaming", "empresariales", "macbook", "resenas"]);

/** Title decides first; the summary may only add topical categories (it often mentions rival products in passing). */
export function categorize(title: string, summary: string): Category {
  return (
    CATEGORY_RULES.find(([, re]) => re.test(title))?.[0] ??
    CATEGORY_RULES.find(([c, re]) => !FAMILY_CATEGORIES.has(c) && re.test(summary))?.[0] ??
    "general"
  );
}

const RUMOR = /\b(rumou?r|reportedly|allegedly|could|may launch|expected to|tipped|speculat|rumor)\w*/i;
const LEAK = /\b(leak|leaked|leaks|benchmark spotted|spotted in|geekbench listing|filtra)\w*/i;

export function labelFor(sourceIsOfficial: boolean, title: string): NewsLabel {
  if (sourceIsOfficial) return "official";
  if (LEAK.test(title)) return "leak";
  if (RUMOR.test(title)) return "rumor";
  return "analysis";
}

const TRACKING = /^(utm_|fbclid|gclid|mc_|ref$|cmpid|src$)/i;
export function canonicalUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  [...u.searchParams.keys()].forEach((k) => TRACKING.test(k) && u.searchParams.delete(k));
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  return u.toString();
}

export const dedupeKey = (url: string) => createHash("sha256").update(canonicalUrl(url)).digest("hex").slice(0, 32);

const STOP = new Set("the a an and or of for to in on with at by from new is are its it this that de la el los las y en con para por un una".split(" "));
export function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/** Jaccard similarity of title tokens (near-duplicate detection across sources). */
export function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  return inter / (A.size + B.size - inter);
}

export const SAME_STORY = 0.5;

/** A date is acceptable when it is inside the window and not in the future (5 min clock skew). */
export function dateOk(iso: string | null, now: number, days: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return t <= now + 5 * 60_000 && t >= now - days * 86_400_000;
}

export interface PublishInput {
  feedAutoPublish: boolean;
  sourceIsOfficial: boolean;
  corroboratingSources: number;
  label: NewsLabel;
  summaryOk: boolean;
}

/** Automatic publication only for verified, non-speculative items from opted-in feeds. Everything else waits for an editor. */
export function decideStatus(p: PublishInput): "published" | "pending" {
  if (!p.feedAutoPublish || !p.summaryOk) return "pending";
  if (p.label === "rumor" || p.label === "leak") return "pending";
  return p.sourceIsOfficial || p.corroboratingSources >= 1 ? "published" : "pending";
}

/** ISO week (Monday–Sunday) containing `date`, in UTC. */
export function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { year: thursday.getUTCFullYear(), week, start: iso(monday), end: iso(sunday), slug: `${thursday.getUTCFullYear()}-semana-${String(week).padStart(2, "0")}` };
}

export function slugifyTitle(title: string, key: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/-$/, "");
  return `${base || "noticia"}-${key.slice(0, 6)}`;
}
