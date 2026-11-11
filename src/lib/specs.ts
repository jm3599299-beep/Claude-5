import type { Cpu, Gpu, SpecSource, Variant } from "./data/types";

export type SpecValue = string | null;

export interface SpecRow {
  /** Column name in `variants` (or "cpu"/"gpu"/"igpu"): key in spec_sources. */
  field: string;
  label: string;
  value: (v: Variant) => SpecValue;
}

export interface SpecGroup {
  id: string;
  title: string;
  rows: SpecRow[];
}

const num = (n: number | null | undefined, unit = "", digits?: number) =>
  n === null || n === undefined ? null : `${digits !== undefined ? Number(n).toFixed(digits) : Number(n)}${unit ? ` ${unit}` : ""}`;
const bool = (b: boolean | null | undefined) => (b === null || b === undefined ? null : b ? "Sí" : "No");
const list = (a: string[] | null | undefined) => (a && a.length ? a.join(" · ") : null);
const text = (s: string | null | undefined) => (s && s.trim() ? s : null);

export function formatStorage(gb: number | null | undefined) {
  if (gb === null || gb === undefined) return null;
  return gb >= 1000 && gb % 1000 === 0 ? `${gb / 1000} TB` : gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`;
}

export function cpuName(c: Cpu | null) {
  return c ? `${c.manufacturer} ${c.model}` : null;
}
export function gpuName(g: Gpu | null) {
  return g ? `${g.manufacturer} ${g.model}` : null;
}

function cpuCores(c: Cpu | null) {
  if (!c?.cores) return null;
  const split = c.performance_cores != null && c.efficiency_cores != null ? ` (${c.performance_cores}P + ${c.efficiency_cores}E)` : "";
  return `${c.cores}${split}`;
}
function cpuClocks(c: Cpu | null) {
  if (!c || (c.base_clock_ghz == null && c.boost_clock_ghz == null)) return null;
  return [c.base_clock_ghz != null && `${c.base_clock_ghz} GHz base`, c.boost_clock_ghz != null && `hasta ${c.boost_clock_ghz} GHz`].filter(Boolean).join(" · ");
}
function tgp(g: Gpu | null) {
  if (!g || (g.tgp_min_w == null && g.tgp_max_w == null)) return null;
  if (g.tgp_min_w != null && g.tgp_max_w != null && g.tgp_min_w !== g.tgp_max_w) return `${g.tgp_min_w}–${g.tgp_max_w} W`;
  return `${g.tgp_max_w ?? g.tgp_min_w} W`;
}

export const specGroups: SpecGroup[] = [
  {
    id: "procesador",
    title: "Procesador",
    rows: [
      { field: "cpu", label: "Modelo", value: (v) => cpuName(v.cpu) },
      { field: "cpu", label: "Arquitectura", value: (v) => text(v.cpu?.architecture) },
      { field: "cpu", label: "Núcleos", value: (v) => cpuCores(v.cpu) },
      { field: "cpu", label: "Hilos", value: (v) => num(v.cpu?.threads) },
      { field: "cpu", label: "Frecuencias", value: (v) => cpuClocks(v.cpu) },
      { field: "cpu", label: "Consumo (TDP)", value: (v) => num(v.cpu?.tdp_w, "W") },
      { field: "cpu", label: "NPU", value: (v) => num(v.cpu?.npu_tops, "TOPS") },
    ],
  },
  {
    id: "gpu",
    title: "Gráficos",
    rows: [
      { field: "gpu", label: "GPU dedicada", value: (v) => gpuName(v.gpu) ?? (v.has_dgpu === false ? "No (solo gráficos integrados)" : null) },
      { field: "gpu", label: "Memoria gráfica", value: (v) => (v.gpu ? [num(v.gpu.vram_gb, "GB"), v.gpu.vram_type].filter(Boolean).join(" ") || null : v.has_dgpu === false ? "No aplica" : null) },
      { field: "gpu", label: "Consumo (TGP)", value: (v) => tgp(v.gpu) ?? (v.has_dgpu === false ? "No aplica" : null) },
      { field: "igpu", label: "GPU integrada", value: (v) => gpuName(v.igpu) },
    ],
  },
  {
    id: "ram",
    title: "Memoria RAM",
    rows: [
      { field: "ram_gb", label: "Capacidad", value: (v) => num(v.ram_gb, "GB") },
      { field: "ram_type", label: "Tipo", value: (v) => text(v.ram_type) },
      { field: "ram_speed_mts", label: "Frecuencia", value: (v) => num(v.ram_speed_mts, "MT/s") },
      { field: "ram_slots", label: "Ranuras", value: (v) => num(v.ram_slots) },
      { field: "ram_soldered_gb", label: "Memoria soldada", value: (v) => num(v.ram_soldered_gb, "GB") },
      { field: "ram_max_gb", label: "Máximo compatible", value: (v) => num(v.ram_max_gb, "GB") },
    ],
  },
  {
    id: "almacenamiento",
    title: "Almacenamiento",
    rows: [
      { field: "storage_gb", label: "Capacidad", value: (v) => formatStorage(v.storage_gb) },
      { field: "storage_type", label: "Tipo", value: (v) => text(v.storage_type) },
      { field: "storage_interface", label: "Interfaz", value: (v) => text(v.storage_interface) },
      { field: "storage_slots", label: "Ranuras totales", value: (v) => num(v.storage_slots) },
      { field: "storage_free_slots", label: "Ranuras libres", value: (v) => num(v.storage_free_slots) },
      { field: "storage_upgradeable", label: "Ampliable", value: (v) => bool(v.storage_upgradeable) },
    ],
  },
  {
    id: "pantalla",
    title: "Pantalla",
    rows: [
      { field: "display_size_in", label: "Tamaño", value: (v) => (v.display_size_in == null ? null : `${Number(v.display_size_in)}"`) },
      { field: "display_resolution", label: "Resolución", value: (v) => text(v.display_resolution) },
      { field: "display_panel", label: "Panel", value: (v) => text(v.display_panel) },
      { field: "display_refresh_hz", label: "Frecuencia", value: (v) => num(v.display_refresh_hz, "Hz") },
      { field: "display_brightness_nits", label: "Brillo", value: (v) => num(v.display_brightness_nits, "nits") },
      { field: "display_color_gamut", label: "Cobertura de color", value: (v) => text(v.display_color_gamut) },
      { field: "display_touch", label: "Táctil", value: (v) => bool(v.display_touch) },
    ],
  },
  {
    id: "bateria",
    title: "Batería y energía",
    rows: [
      { field: "battery_wh", label: "Batería", value: (v) => num(v.battery_wh, "Wh") },
      { field: "battery_life_claim", label: "Autonomía declarada", value: (v) => text(v.battery_life_claim) },
      { field: "charger_w", label: "Cargador", value: (v) => num(v.charger_w, "W") },
    ],
  },
  {
    id: "diseno",
    title: "Diseño y construcción",
    rows: [
      { field: "weight_kg", label: "Peso", value: (v) => num(v.weight_kg, "kg") },
      { field: "dimensions_mm", label: "Dimensiones", value: (v) => (v.dimensions_mm ? `${v.dimensions_mm} mm` : null) },
      { field: "materials", label: "Materiales", value: (v) => text(v.materials) },
      { field: "keyboard", label: "Teclado", value: (v) => text(v.keyboard) },
      { field: "webcam", label: "Cámara", value: (v) => text(v.webcam) },
      { field: "cooling", label: "Refrigeración", value: (v) => text(v.cooling) },
    ],
  },
  {
    id: "conectividad",
    title: "Conectividad y sistema",
    rows: [
      { field: "ports", label: "Puertos", value: (v) => list(v.ports) },
      { field: "wifi", label: "Wi-Fi", value: (v) => text(v.wifi) },
      { field: "bluetooth", label: "Bluetooth", value: (v) => text(v.bluetooth) },
      { field: "os", label: "Sistema operativo", value: (v) => text(v.os) },
      { field: "security_features", label: "Seguridad", value: (v) => list(v.security_features) },
    ],
  },
];

export type Verification = "verified" | "unverified" | "unknown";

export function verificationFor(v: Variant, field: string, value: SpecValue): { state: Verification; source?: SpecSource } {
  if (value === null) return { state: "unknown" };
  const source = v.spec_sources?.find((s) => s.field === field);
  return { state: source?.verified ? "verified" : "unverified", source };
}

/** Fraction of populated fields that are verified — shown as a data-quality indicator. */
export function verificationStats(v: Variant) {
  let known = 0;
  let verified = 0;
  let total = 0;
  for (const g of specGroups)
    for (const r of g.rows) {
      total++;
      const val = r.value(v);
      if (val === null) continue;
      known++;
      if (verificationFor(v, r.field, val).state === "verified") verified++;
    }
  return { total, known, verified };
}

/** Rows whose values differ between variants (to highlight configuration differences). */
export function differingRows(variants: Variant[]) {
  if (variants.length < 2) return [];
  const out: { group: string; row: SpecRow }[] = [];
  for (const g of specGroups)
    for (const r of g.rows) {
      const vals = new Set(variants.map((v) => r.value(v) ?? "—"));
      if (vals.size > 1) out.push({ group: g.title, row: r });
    }
  return out;
}
