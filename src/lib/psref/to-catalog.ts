/**
 * Converts PSREF per-model exports (one per MTM) into a LaptopVerse catalog file.
 * One PSREF "Product" → one model; each MTM → one variant whose `sku` is the
 * real Lenovo part number. Every populated field is attributed to the MTM's
 * PSREF page. Commercial status stays "unverified": PSREF itself states it does
 * not confirm availability.
 */
import type { SpecField } from "../catalog-import/schema.ts";
import {
  clean,
  parseDimensions,
  parseDisplay,
  parseGraphics,
  parseMaxMemory,
  parseMemory,
  parseNpuTops,
  parsePorts,
  parseProcessor,
  parseSlotCount,
  parseStorage,
  parseTouch,
  parseWeight,
  parseWireless,
  parseLeadingNumber,
  present,
  type PsrefRecord,
} from "./parse.ts";

export const PSREF_SOURCE_KEY = "lenovo-psref";

const FAMILY_PREFIXES: [RegExp, string][] = [
  [/^ThinkPad\b/i, "thinkpad"],
  [/^ThinkBook\b/i, "thinkbook"],
  [/^IdeaPad\b/i, "ideapad"],
  [/^Yoga\b/i, "yoga"],
  [/^Legion\b/i, "legion"],
  [/^LOQ\b/i, "loq"],
];

export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");

export const psrefModelUrl = (product: string, mtm: string) =>
  `https://psref.lenovo.com/Detail/${encodeURIComponent(product.replace(/\s+/g, "_"))}?M=${encodeURIComponent(mtm)}`;

export interface ConvertOptions {
  /** Date the editor downloaded the exports (YYYY-MM-DD). */
  verifiedAt: string;
}

export interface ConvertReport {
  product: string;
  variants: number;
  unparsed: { mtm: string; field: string; value: string }[];
  notes: string[];
}

export function psrefToCatalog(records: PsrefRecord[], opts: ConvertOptions) {
  if (!records.length) throw new Error("No hay exportaciones");
  const products = new Set(records.map((r) => r.Product));
  if (products.size > 1) throw new Error(`Las exportaciones mezclan productos: ${[...products].join(", ")}. Convierte un producto por archivo.`);
  const product = clean(records[0].Product)!;
  const family = FAMILY_PREFIXES.find(([re]) => re.test(product))?.[1] ?? null;
  const report: ConvertReport = { product, variants: 0, unparsed: [], notes: [] };
  const cpus = new Map<string, Record<string, unknown>>();
  const gpus = new Map<string, Record<string, unknown>>();
  const announce = records.map((r) => r["Announce Date"]).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? "")).sort()[0];

  const variants = records
    .slice()
    .sort((a, b) => a.Model.localeCompare(b.Model))
    .map((r, i) => {
      const mtm = r.Model.trim();
      const miss = (field: string) => r[field] && report.unparsed.push({ mtm, field, value: r[field] });

      const cpu = parseProcessor(r.Processor);
      if (!cpu) miss("Processor");
      if (cpu) {
        const key = `${cpu.manufacturer}|${cpu.model}`;
        if (!cpus.has(key)) cpus.set(key, { ...cpu, npu_tops: parseNpuTops(r.NPU), source: PSREF_SOURCE_KEY });
      }
      const g = parseGraphics(r.Graphics);
      if (!g.gpu && !g.igpu) miss("Graphics");
      for (const x of [g.gpu, g.igpu]) if (x) gpus.set(`${x.manufacturer}|${x.model}`, { ...x, source: PSREF_SOURCE_KEY });

      const mem = parseMemory(r.Memory);
      if (mem.ram_gb == null) miss("Memory");
      const sto = parseStorage(r.Storage);
      if (sto.storage_gb == null) miss("Storage");
      const slots = parseSlotCount(r["Storage Slot"]);
      const disp = parseDisplay(r.Display);
      if (disp.display_resolution == null) miss("Display");
      const wl = parseWireless(r["WLAN + Bluetooth"]);
      const weight = parseWeight(r.Weight);
      if (weight.starting_at_kg != null && i === 0)
        report.notes.push(`Peso «Starting at ${weight.starting_at_kg} kg»: es el mínimo de la plataforma, no se asigna a cada configuración.`);

      const securityLabels: [string, string][] = [
        ["Security Chip", "Chip de seguridad"],
        ["Fingerprint Reader", "Lector de huellas"],
        ["Physical Locks", "Anclaje físico"],
        ["Other Security", "Otros"],
      ];
      const security = securityLabels.flatMap(([k, label]) => {
        const val = present(r[k]);
        return val ? [`${label}: ${val}`] : [];
      });

      const v: Record<string, unknown> = {
        key: slugify(mtm),
        sku: mtm,
        name: [cpu ? cpu.model : null, mem.ram_gb && `${mem.ram_gb} GB`, sto.storage_gb && (sto.storage_gb >= 1000 ? `${sto.storage_gb / 1000} TB` : `${sto.storage_gb} GB`), mtm]
          .filter(Boolean)
          .join(" · "),
        region: [clean(r["Country/Region"]), clean(r.Region)].filter(Boolean).join(" / ") || null,
        cpu: cpu ? { manufacturer: cpu.manufacturer, model: cpu.model } : null,
        gpu: g.gpu ? { manufacturer: g.gpu.manufacturer, model: g.gpu.model } : null,
        igpu: g.igpu ? { manufacturer: g.igpu.manufacturer, model: g.igpu.model } : null,
        has_dgpu: g.hasDgpu,
        ram_gb: mem.ram_gb,
        ram_type: mem.ram_type,
        ram_speed_mts: mem.ram_speed_mts,
        ram_slots: parseSlotCount(r["Memory Slots"]),
        ram_soldered_gb: mem.ram_soldered_gb,
        ram_max_gb: parseMaxMemory(r["Max Memory"]),
        storage_gb: sto.storage_gb,
        storage_type: sto.storage_type,
        storage_interface: sto.storage_interface,
        storage_slots: slots,
        storage_free_slots: slots != null && sto.drives != null && slots >= sto.drives ? slots - sto.drives : null,
        ...disp,
        display_touch: parseTouch(r.Touchscreen),
        battery_wh: parseLeadingNumber(r.Battery, "Wh"),
        charger_w: parseLeadingNumber(r["Power Adapter"], "W"),
        weight_kg: weight.exact_kg,
        dimensions_mm: parseDimensions(r["Dimensions (WxDxH)"]),
        materials: present(r["Case Material"]),
        keyboard: present(r.Keyboard),
        webcam: present(r.Camera),
        ports: parsePorts(r["Standard Ports"]),
        wifi: wl.wifi,
        bluetooth: wl.bluetooth,
        os: present(r["Operating System"]),
        security_features: security,
      };
      for (const k of Object.keys(v)) if (v[k] === null || v[k] === undefined) delete v[k];
      if (Array.isArray(v.ports) && !v.ports.length) delete v.ports;
      if (Array.isArray(v.security_features) && !(v.security_features as string[]).length) delete v.security_features;

      const fields = (
        [
          "cpu", "gpu", "igpu", "ram_gb", "ram_type", "ram_speed_mts", "ram_slots", "ram_soldered_gb", "ram_max_gb",
          "storage_gb", "storage_type", "storage_interface", "storage_slots", "storage_free_slots",
          "display_size_in", "display_resolution", "display_panel", "display_refresh_hz", "display_brightness_nits", "display_color_gamut", "display_touch",
          "battery_wh", "charger_w", "weight_kg", "dimensions_mm", "materials", "keyboard", "webcam", "ports", "wifi", "bluetooth", "os", "security_features",
        ] as SpecField[]
      ).filter((f) => (f === "gpu" ? v.gpu != null || v.has_dgpu === false : v[f] != null));
      v.provenance = [{ source: PSREF_SOURCE_KEY, url: psrefModelUrl(product, mtm), fields, verified: true, verified_at: opts.verifiedAt }];
      report.variants++;
      return v;
    });

  const model = {
    brand: "lenovo",
    ...(family ? { family } : {}),
    slug: `lenovo-${slugify(product)}`,
    name: product,
    ...(announce ? { release_year: Number(announce.slice(0, 4)), release_date: announce } : {}),
    commercial_status: { value: "unverified" },
    summary: `Datos de Lenovo PSREF por número de modelo (MTM). ${variants.length} configuración(es) importada(s). PSREF no confirma disponibilidad comercial.`,
    official_url: `https://psref.lenovo.com/product/${product.replace(/\s+/g, "_")}`,
    published: false,
    variants,
    images: [],
  };
  if (announce) report.notes.push(`Fecha de anuncio según PSREF: ${announce} (usada como release_date).`);

  const file = {
    $schema: "../schema/catalog.schema.json",
    sources: {
      [PSREF_SOURCE_KEY]: {
        name: "Lenovo PSREF — Product Specifications Reference",
        kind: "manufacturer",
        homepage_url: "https://psref.lenovo.com",
        is_official: true,
        trust_level: 5,
        notes: "Exportaciones por modelo descargadas manualmente por un editor. PSREF no confirma disponibilidad comercial.",
      },
    },
    cpus: [...cpus.values()],
    gpus: [...gpus.values()],
    models: [model],
  };
  return { file, report };
}
