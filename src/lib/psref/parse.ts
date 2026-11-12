/**
 * Parsers for Lenovo PSREF per-model specification exports (Excel "Model
 * Configurations"). Each parser extracts only what the text states; anything
 * it cannot read with confidence is returned as null ("Desconocido").
 */
import { unzipSync, strFromU8 } from "fflate";

export type PsrefRecord = Record<string, string>;

const XML_ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m]).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** Reads the two-column key/value sheet of a PSREF xlsx export. */
export function readPsrefXlsx(data: Uint8Array): PsrefRecord {
  const files = unzipSync(data);
  const sst = files["xl/sharedStrings.xml"] ? strFromU8(files["xl/sharedStrings.xml"]) : "";
  const sheet = files["xl/worksheets/sheet1.xml"];
  if (!sheet) throw new Error("El archivo no contiene una hoja de cálculo PSREF");
  const strings = [...sst.matchAll(/<(?:x:)?si>([\s\S]*?)<\/(?:x:)?si>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, "")));
  const out: PsrefRecord = {};
  for (const row of strFromU8(sheet).matchAll(/<(?:x:)?row[^>]*>([\s\S]*?)<\/(?:x:)?row>/g)) {
    const cells = [...row[1].matchAll(/<(?:x:)?c ([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g)].map(([, attrs, body]) => {
      const v = /<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/.exec(body ?? "")?.[1];
      if (v === undefined) return "";
      return /t="s"/.test(attrs) ? (strings[Number(v)] ?? "") : decode(v);
    });
    const [k, v] = cells;
    if (k && v) out[k.trim()] = v.trim();
  }
  if (!out.Product || !out.Model) throw new Error("Faltan los campos Product/Model: ¿es una exportación de modelo de PSREF?");
  return out;
}

/** Removes trademark symbols and normalises whitespace. */
export const clean = (s: string | undefined | null) =>
  s ? s.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim() : null;

const NONE = /^(none|n\/a|not supported|.*not supported|no .*)$/i;
const present = (s: string | undefined) => {
  const c = clean(s);
  return c && !NONE.test(c) ? c : null;
};
const num = (s: string) => Number(s.replace(",", "."));

export interface ParsedCpu {
  manufacturer: string;
  model: string;
  cores: number | null;
  performance_cores: number | null;
  efficiency_cores: number | null;
  threads: number | null;
  base_clock_ghz: number | null;
  boost_clock_ghz: number | null;
}

/**
 * "Intel Core 5 320, 6C (2P + 4LPE) / 6T, Max Turbo up to 4.6Ghz, 6MB Intel Smart Cache"
 * "AMD Ryzen 7 250, 8C / 16T, 3.3 / 5.1GHz, 8MB L2 / 16MB L3"
 */
export function parseProcessor(raw: string | undefined): ParsedCpu | null {
  const s = clean(raw);
  if (!s) return null;
  const [head, ...rest] = s.split(",");
  const name = head.trim();
  const m = /^(Intel|AMD|Qualcomm|MediaTek|Apple)\s+(.+)$/i.exec(name);
  if (!m) return null;
  const manufacturer = { intel: "Intel", amd: "AMD", qualcomm: "Qualcomm", mediatek: "MediaTek", apple: "Apple" }[m[1].toLowerCase()]!;
  const tail = rest.join(",");
  const cores = /(\d+)C\b/.exec(tail);
  const threads = /\/\s*(\d+)T\b/.exec(tail);
  const p = /(\d+)P\b/.exec(tail);
  const e = /(\d+)E\b/.exec(tail);
  const lpe = /(\d+)LPE\b/.exec(tail);
  const turbo = /(?:Max Turbo|Boost)[^\d]*(\d+(?:[.,]\d+)?)\s*GHz/i.exec(tail);
  const pair = /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*GHz/i.exec(tail); // AMD "base / boost"
  const eff = e || lpe ? (e ? Number(e[1]) : 0) + (lpe ? Number(lpe[1]) : 0) : null;
  return {
    manufacturer,
    model: m[2].trim(),
    cores: cores ? Number(cores[1]) : null,
    performance_cores: p ? Number(p[1]) : null,
    efficiency_cores: eff,
    threads: threads ? Number(threads[1]) : null,
    base_clock_ghz: pair ? num(pair[1]) : null,
    boost_clock_ghz: turbo ? num(turbo[1]) : pair ? num(pair[2]) : null,
  };
}

export interface ParsedGpu {
  manufacturer: string;
  model: string;
  is_integrated: boolean;
  vram_gb: number | null;
  vram_type: string | null;
  tgp_max_w: number | null;
}

/** "Integrated Intel Graphics" / "NVIDIA GeForce RTX 5060 Laptop GPU 8GB GDDR7, Boost Clock 2280MHz, TGP 115W" */
export function parseGraphics(raw: string | undefined): { gpu: ParsedGpu | null; igpu: ParsedGpu | null; hasDgpu: boolean | null } {
  const s = clean(raw);
  if (!s) return { gpu: null, igpu: null, hasDgpu: null };
  const integrated = /^Integrated\s+(Intel|AMD|Qualcomm)\s+(.+)$/i.exec(s);
  if (integrated) {
    const manufacturer = { intel: "Intel", amd: "AMD", qualcomm: "Qualcomm" }[integrated[1].toLowerCase()]!;
    return {
      gpu: null,
      igpu: { manufacturer, model: integrated[2].trim(), is_integrated: true, vram_gb: null, vram_type: null, tgp_max_w: null },
      hasDgpu: false,
    };
  }
  const dedicated = /^(NVIDIA|AMD)\s+(.+?)(?:\s+(\d+)GB\s+(G?DDR\w+))?(?:,|$)/i.exec(s);
  if (dedicated) {
    const tgp = /TGP\s*(\d+)\s*W/i.exec(s);
    return {
      gpu: {
        manufacturer: dedicated[1].toUpperCase() === "NVIDIA" ? "NVIDIA" : "AMD",
        model: dedicated[2].trim(),
        is_integrated: false,
        vram_gb: dedicated[3] ? Number(dedicated[3]) : null,
        vram_type: dedicated[4] ?? null,
        tgp_max_w: tgp ? Number(tgp[1]) : null,
      },
      igpu: null,
      hasDgpu: true,
    };
  }
  return { gpu: null, igpu: null, hasDgpu: null };
}

/** "1x 16GB SODIMM DDR5-5600" / "16GB Soldered LPDDR5x-8533" / "8GB Soldered DDR5-5600 + 8GB SODIMM DDR5-5600" */
export function parseMemory(raw: string | undefined) {
  const s = clean(raw);
  if (!s) return { ram_gb: null, ram_type: null, ram_speed_mts: null, ram_soldered_gb: null };
  let total = 0;
  let soldered = 0;
  let matched = false;
  for (const part of s.split("+")) {
    const m = /(?:(\d+)x\s*)?(\d+)\s*GB\s+(Soldered|SO-?DIMM|LPCAMM2?|CAMM2?)?/i.exec(part);
    if (!m) continue;
    matched = true;
    const gb = Number(m[1] ?? 1) * Number(m[2]);
    total += gb;
    if (m[3] && /soldered/i.test(m[3])) soldered += gb;
  }
  const type = /\b(LPDDR\dx?|DDR\d)(?:-(\d{4,5}))?/i.exec(s);
  const anyKindStated = /soldered|so-?dimm|camm/i.test(s);
  return {
    ram_gb: matched ? total : null,
    ram_type: type ? type[1].toUpperCase().replace(/X$/, "x") : null,
    ram_speed_mts: type?.[2] ? Number(type[2]) : null,
    ram_soldered_gb: matched && anyKindStated ? soldered : null,
  };
}

const WORD_NUMBERS: Record<string, number> = { no: 0, zero: 0, one: 1, two: 2, three: 3, four: 4 };
/** "One DDR5 SODIMM slot" → 1 ; "Memory soldered to systemboard, no slots" → 0 */
export function parseSlotCount(raw: string | undefined): number | null {
  const s = clean(raw)?.toLowerCase();
  if (!s) return null;
  if (/no slots?/.test(s)) return 0;
  const w = /^(one|two|three|four|\d+)\b/.exec(s);
  if (!w) return null;
  return WORD_NUMBERS[w[1]] ?? Number(w[1]);
}

/** "Up to 32GB DDR5-5600 offering" → 32 */
export function parseMaxMemory(raw: string | undefined): number | null {
  const m = /up to\s+(\d+)\s*GB/i.exec(clean(raw) ?? "");
  return m ? Number(m[1]) : null;
}

/** "256GB SSD M.2 2242 PCIe 4.0x4 NVMe" / "1TB SSD M.2 2280 PCIe 5.0x4 Performance NVMe" (+ second drive) */
export function parseStorage(raw: string | undefined) {
  const s = clean(raw);
  if (!s) return { storage_gb: null, storage_type: null, storage_interface: null, drives: null };
  const parts = s.split(/\s\+\s/);
  let total = 0;
  let ok = false;
  for (const p of parts) {
    const m = /(\d+(?:\.\d+)?)\s*(TB|GB)/i.exec(p);
    if (!m) continue;
    ok = true;
    total += m[2].toUpperCase() === "TB" ? Math.round(num(m[1]) * 1000) : Number(m[1]);
  }
  const first = parts[0];
  const form = /M\.2\s*(\d{4})/i.exec(first);
  const nvme = /NVMe/i.test(first);
  const pcie = /PCIe\s*(\d\.\d)\s*x\s*(\d)/i.exec(first);
  const kind = /\b(SSD|HDD|eMMC|UFS)\b/i.exec(first)?.[1].toUpperCase() ?? null;
  return {
    storage_gb: ok ? total : null,
    storage_type: kind ? [kind, form && `M.2 ${form[1]}`, nvme && "NVMe"].filter(Boolean).join(" ") : null,
    storage_interface: pcie ? `PCIe ${pcie[1]} x${pcie[2]}` : null,
    drives: ok ? parts.length : null,
  };
}

/** '14" WUXGA (1920x1200) IPS 400nits Anti-glare, 45% NTSC, 60Hz' */
export function parseDisplay(raw: string | undefined) {
  const s = clean(raw);
  const empty = { display_size_in: null, display_resolution: null, display_panel: null, display_brightness_nits: null, display_color_gamut: null, display_refresh_hz: null };
  if (!s) return empty;
  const size = /(\d{1,2}(?:\.\d)?)\s*(?:"|''|-inch|inch)/i.exec(s);
  const res = /(\d{3,4})\s*x\s*(\d{3,4})/i.exec(s);
  const panel = /\b(IPS|OLED|TN|VA|Mini-?LED|WVA|TFT)\b/i.exec(s);
  const nits = /(\d{2,4})\s*nits/i.exec(s);
  const gamut = /(\d{2,3}%\s*(?:NTSC|sRGB|DCI-P3|Adobe RGB|P3))/i.exec(s);
  const hz = /(\d{2,3})\s*Hz/i.exec(s);
  return {
    display_size_in: size ? num(size[1]) : null,
    display_resolution: res ? `${res[1]}×${res[2]}` : null,
    display_panel: panel ? panel[1].toUpperCase().replace("MINI-LED", "Mini-LED") : null,
    display_brightness_nits: nits ? Number(nits[1]) : null,
    display_color_gamut: gamut ? gamut[1].replace(/\s+/g, " ") : null,
    display_refresh_hz: hz ? Number(hz[1]) : null,
  };
}

/** "Intel Wi-Fi 6E AX211, 802.11ax 2x2 + BT5.4" */
export function parseWireless(raw: string | undefined) {
  const s = clean(raw);
  if (!s) return { wifi: null, bluetooth: null };
  const [wl, bt] = s.split(/\s\+\s/);
  const btv = /BT\s*(\d(?:\.\d)?)/i.exec(bt ?? s);
  return { wifi: wl?.trim() || null, bluetooth: btv ? btv[1] : null };
}

/** PSREF joins port lines with ", " — split only before a new "<n>x " item. */
export function parsePorts(raw: string | undefined): string[] {
  const s = clean(raw);
  if (!s) return [];
  return s
    .split(/(?:,\s*|\n)(?=\d+x\s)/)
    .map((p) => p.replace(/,\s*$/, "").trim())
    .filter(Boolean);
}

/** "312.5 x 220.9 x 17.2 mm (12.3 x 8.7 x 0.68 inches)" → "312.5 × 220.9 × 17.2" */
export function parseDimensions(raw: string | undefined): string | null {
  const m = /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*mm/i.exec(clean(raw) ?? "");
  return m ? `${m[1]} × ${m[2]} × ${m[3]}` : null;
}

/**
 * Exact weight only. "Starting at 1.39 kg" is the lightest configuration of the
 * platform, not this model's weight, so it is returned separately.
 */
export function parseWeight(raw: string | undefined): { exact_kg: number | null; starting_at_kg: number | null } {
  const s = clean(raw) ?? "";
  const m = /(\d+(?:\.\d+)?)\s*kg/i.exec(s);
  if (!m) return { exact_kg: null, starting_at_kg: null };
  return /starting at|from|desde/i.test(s) ? { exact_kg: null, starting_at_kg: num(m[1]) } : { exact_kg: num(m[1]), starting_at_kg: null };
}

export const parseLeadingNumber = (raw: string | undefined, unit: string): number | null => {
  const m = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, "i").exec(clean(raw) ?? "");
  return m ? num(m[1]) : null;
};

export const parseNpuTops = (raw: string | undefined) => parseLeadingNumber(raw, "TOPS");
export const parseTouch = (raw: string | undefined): boolean | null => {
  const s = clean(raw);
  if (!s) return null;
  return /^none$/i.test(s) ? false : true;
};
export { present };
