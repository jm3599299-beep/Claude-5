/**
 * Comparator rows. Each row knows how to display a value and, when it makes
 * sense, how to score it so the best value can be highlighted. Unknown values
 * never win and are never treated as zero.
 */
import type { ModelDetail, Variant } from "./data/types";
import { cpuName, formatStorage, gpuName } from "./specs.ts";
import { convert } from "./fx/providers.ts";
import { referencePrice, money, KIND_LABEL } from "./pricing.ts";

export interface CompareItem {
  model: ModelDetail;
  variant: Variant;
}

export interface CompareRow {
  group: string;
  label: string;
  value: (i: CompareItem) => string | null;
  score?: (i: CompareItem) => number | null;
  better?: "higher" | "lower";
  note?: string;
}

const pixels = (res: string | null) => {
  const m = res ? /(\d+)\D+(\d+)/.exec(res) : null;
  return m ? Number(m[1]) * Number(m[2]) : null;
};

export function buildRows(usdRates: Record<string, number>): CompareRow[] {
  const refUsd = (i: CompareItem) => {
    const p = referencePrice(i.variant.prices ?? []);
    return p ? convert(Number(p.amount), p.currency_code, "USD", usdRates) : null;
  };
  return [
    {
      group: "Precio",
      label: "Precio de referencia",
      value: (i) => {
        const p = referencePrice(i.variant.prices ?? []);
        return p ? `${money(Number(p.amount), p.currency_code)} (${KIND_LABEL[p.kind].toLowerCase()}, ${p.country_code})` : null;
      },
      score: refUsd,
      better: "lower",
      note: "Para comparar monedas distintas se convierte a USD con el tipo de cambio del día (orientativo).",
    },
    { group: "Procesador", label: "Modelo", value: (i) => cpuName(i.variant.cpu) },
    { group: "Procesador", label: "Núcleos / hilos", value: (i) => (i.variant.cpu?.cores ? `${i.variant.cpu.cores}${i.variant.cpu.threads ? ` / ${i.variant.cpu.threads}` : ""}` : null), score: (i) => i.variant.cpu?.cores ?? null, better: "higher" },
    { group: "Procesador", label: "Frecuencia máxima", value: (i) => (i.variant.cpu?.boost_clock_ghz ? `${i.variant.cpu.boost_clock_ghz} GHz` : null), score: (i) => i.variant.cpu?.boost_clock_ghz ?? null, better: "higher" },
    {
      group: "Gráficos",
      label: "GPU",
      value: (i) => gpuName(i.variant.gpu) ?? (i.variant.igpu ? `${gpuName(i.variant.igpu)} (integrada)` : null),
    },
    { group: "Gráficos", label: "Memoria gráfica", value: (i) => (i.variant.gpu?.vram_gb ? `${i.variant.gpu.vram_gb} GB` : i.variant.has_dgpu === false ? "Compartida" : null), score: (i) => i.variant.gpu?.vram_gb ?? (i.variant.has_dgpu === false ? 0 : null), better: "higher" },
    { group: "Memoria", label: "RAM", value: (i) => (i.variant.ram_gb ? `${i.variant.ram_gb} GB${i.variant.ram_type ? ` ${i.variant.ram_type}` : ""}` : null), score: (i) => i.variant.ram_gb, better: "higher" },
    { group: "Memoria", label: "RAM máxima", value: (i) => (i.variant.ram_max_gb ? `${i.variant.ram_max_gb} GB` : null), score: (i) => i.variant.ram_max_gb, better: "higher" },
    { group: "Almacenamiento", label: "SSD", value: (i) => formatStorage(i.variant.storage_gb), score: (i) => i.variant.storage_gb, better: "higher" },
    { group: "Almacenamiento", label: "Ranuras libres", value: (i) => (i.variant.storage_free_slots != null ? String(i.variant.storage_free_slots) : null), score: (i) => i.variant.storage_free_slots, better: "higher" },
    { group: "Pantalla", label: "Tamaño", value: (i) => (i.variant.display_size_in ? `${Number(i.variant.display_size_in)}"` : null) },
    { group: "Pantalla", label: "Resolución", value: (i) => i.variant.display_resolution, score: (i) => pixels(i.variant.display_resolution), better: "higher" },
    { group: "Pantalla", label: "Panel", value: (i) => i.variant.display_panel },
    { group: "Pantalla", label: "Frecuencia", value: (i) => (i.variant.display_refresh_hz ? `${i.variant.display_refresh_hz} Hz` : null), score: (i) => i.variant.display_refresh_hz, better: "higher" },
    { group: "Pantalla", label: "Brillo", value: (i) => (i.variant.display_brightness_nits ? `${i.variant.display_brightness_nits} nits` : null), score: (i) => i.variant.display_brightness_nits, better: "higher" },
    { group: "Batería", label: "Capacidad", value: (i) => (i.variant.battery_wh ? `${Number(i.variant.battery_wh)} Wh` : null), score: (i) => (i.variant.battery_wh ? Number(i.variant.battery_wh) : null), better: "higher" },
    { group: "Batería", label: "Autonomía declarada", value: (i) => i.variant.battery_life_claim, note: "Cifras del fabricante con metodologías distintas: no se comparan automáticamente." },
    { group: "Diseño", label: "Peso", value: (i) => (i.variant.weight_kg ? `${Number(i.variant.weight_kg)} kg` : null), score: (i) => (i.variant.weight_kg ? Number(i.variant.weight_kg) : null), better: "lower" },
    { group: "Diseño", label: "Materiales", value: (i) => i.variant.materials },
    { group: "Diseño", label: "Calidad de construcción", value: (i) => (i.model.build_quality_score ? `${i.model.build_quality_score}/10 (editorial)` : null), score: (i) => i.model.build_quality_score ?? null, better: "higher" },
    { group: "Diseño", label: "Refrigeración", value: (i) => i.variant.cooling },
    { group: "Conectividad", label: "Puertos", value: (i) => (i.variant.ports?.length ? i.variant.ports.join("\n") : null) },
    { group: "Conectividad", label: "Wi-Fi / Bluetooth", value: (i) => [i.variant.wifi, i.variant.bluetooth && `BT ${i.variant.bluetooth}`].filter(Boolean).join(" · ") || null },
    { group: "Rendimiento", label: "Pruebas de rendimiento", value: (i) => i.model.performance_notes, note: "LaptopVerse no muestra puntuaciones sin pruebas verificadas." },
  ];
}

/** Index of the best item for a row, or null when there is no clear winner. */
export function bestIndex(row: CompareRow, items: CompareItem[]): number[] {
  if (!row.score || !row.better) return [];
  const scores = items.map((i) => row.score!(i));
  const known = scores.filter((s): s is number => s !== null && Number.isFinite(s));
  if (known.length < 2) return [];
  const target = row.better === "higher" ? Math.max(...known) : Math.min(...known);
  if (known.every((s) => s === target)) return [];
  return scores.flatMap((s, idx) => (s === target ? [idx] : []));
}

export const MAX_COMPARE = 4;
export const MIN_COMPARE = 2;

/** "slug:key,slug:key" ⇄ list. */
export function parseCompareParam(raw: string | undefined | null): { slug: string; key: string }[] {
  if (!raw) return [];
  const seen = new Set<string>();
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,120}:[a-z0-9-]{1,80}$/.test(s) && !seen.has(s) && seen.add(s))
    .slice(0, MAX_COMPARE)
    .map((s) => {
      const [slug, key] = s.split(":");
      return { slug, key };
    });
}

export const compareHref = (items: { slug: string; key: string }[]) =>
  items.length ? `/comparar?v=${items.map((i) => `${i.slug}:${i.key}`).join(",")}` : "/comparar";
