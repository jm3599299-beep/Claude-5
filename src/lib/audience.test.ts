import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyGpu, evaluateAudience, type Level } from "./audience.ts";
import type { Variant } from "./data/types";

const base = {
  id: "x", variant_key: "x", sku: null, name: "x", region: null, is_default: true,
  cpu: null, gpu: null, igpu: null, has_dgpu: null,
  ram_gb: null, ram_type: null, ram_speed_mts: null, ram_slots: null, ram_soldered_gb: null, ram_max_gb: null,
  storage_gb: null, storage_type: null, storage_interface: null, storage_slots: null, storage_free_slots: null, storage_upgradeable: null,
  display_size_in: null, display_resolution: null, display_panel: null, display_refresh_hz: null, display_brightness_nits: null, display_color_gamut: null, display_touch: null,
  battery_wh: null, battery_life_claim: null, charger_w: null, weight_kg: null, dimensions_mm: null, materials: null, keyboard: null, webcam: null,
  ports: [], wifi: null, bluetooth: null, os: null, cooling: null, security_features: [], spec_sources: [], prices: [],
} satisfies Variant;
const cpu = (manufacturer: string, model: string, cores: number | null, extra: Partial<NonNullable<Variant["cpu"]>> = {}) => ({
  manufacturer, model, cores, architecture: null, process_node: null, performance_cores: null, efficiency_cores: null, threads: null,
  base_clock_ghz: null, boost_clock_ghz: null, tdp_w: null, npu_tops: null, ...extra,
});
const gpu = (manufacturer: string, model: string, is_integrated: boolean, extra: Partial<NonNullable<Variant["gpu"]>> = {}) => ({
  manufacturer, model, is_integrated, vram_gb: null, vram_type: null, tgp_min_w: null, tgp_max_w: null, ...extra,
});

// Real catalog data (data/catalog/apple-macbook-air.json, MacBook Air 13" M5 base).
const macbookAir: Variant = {
  ...base, cpu: cpu("Apple", "M5", 10), igpu: gpu("Apple", "M5 (GPU de 8 núcleos)", true), has_dgpu: false,
  ram_gb: 16, ram_type: "Memoria unificada", ram_max_gb: 32, storage_gb: 512, storage_type: "SSD",
  display_size_in: 13.6, display_resolution: "2560×1664", display_brightness_nits: 500, display_color_gamut: "P3 (amplia gama de color), True Tone",
  battery_wh: 53.8, battery_life_claim: "Hasta 18 h de streaming de vídeo · hasta 15 h de navegación web inalámbrica (pruebas de Apple)",
  weight_kg: 1.23, os: "macOS", ports: ["MagSafe 3", "2× Thunderbolt 4 (USB-C)", "Jack"], cooling: "Sin ventilador (diseño pasivo, silencioso)",
};
// Real catalog data (data/catalog/lenovo-thinkbook-14-g10-iwc.json, 22DC001DUS).
const thinkbook: Variant = {
  ...base, cpu: cpu("Intel", "Core 5 320", 6, { threads: 6, boost_clock_ghz: 4.6, npu_tops: 16 }), igpu: gpu("Intel", "Graphics", true), has_dgpu: false,
  ram_gb: 16, ram_type: "DDR5", ram_slots: 1, ram_soldered_gb: 0, ram_max_gb: 32, storage_gb: 256,
  display_size_in: 14, display_resolution: "1920×1200", display_panel: "IPS", display_refresh_hz: 60, display_brightness_nits: 400, display_color_gamut: "45% NTSC",
  battery_wh: 50, os: "Windows 11 Pro", ports: ["1", "2", "3", "4", "5", "6"],
};
// Fictitious TEST machine (only for this unit test).
const testGamer: Variant = {
  ...base, cpu: cpu("Intel", "Core Ultra 9 275HX", 24), gpu: gpu("NVIDIA", "GeForce RTX 5070 Laptop GPU", false, { vram_gb: 8, tgp_max_w: 115 }), has_dgpu: true,
  ram_gb: 32, ram_slots: 2, storage_gb: 1000, display_size_in: 16, display_resolution: "2560×1600", display_refresh_hz: 240, display_color_gamut: "100% DCI-P3",
  battery_wh: 90, weight_kg: 2.5, os: "Windows 11 Home", cooling: "Dos ventiladores",
};

const level = (v: Variant, id: string): Level => evaluateAudience(v).profiles.find((p) => p.id === id)!.level;
const rank: Level[] = ["no-recomendada", "regular", "buena", "excelente"];
const atMost = (l: Level, max: Level) => rank.indexOf(l) <= rank.indexOf(max);
const atLeast = (l: Level, min: Level) => rank.indexOf(l) >= rank.indexOf(min);

test("GPU classes are coarse and name-based", () => {
  assert.equal(classifyGpu(testGamer)!.tier, 4);
  assert.equal(classifyGpu(thinkbook)!.dedicated, false);
  assert.equal(classifyGpu({ gpu: null, igpu: null, has_dgpu: null }), null);
});

test("no gaming recommendation without a dedicated GPU", () => {
  assert.equal(level(thinkbook, "gaming"), "no-recomendada");
  assert.ok(atMost(level(macbookAir, "gaming"), "regular"), "MacBook Air: integrated GPU + macOS");
  assert.ok(atLeast(level(testGamer, "gaming"), "buena"));
});

test("poor color gamut is never recommended for design", () => {
  assert.ok(atMost(level(thinkbook, "diseno"), "regular"));
  assert.ok(atLeast(level(macbookAir, "diseno"), "buena"));
});

test("mobility reflects real weight and battery; unknown weight is not guessed", () => {
  assert.equal(level(macbookAir, "movilidad"), "excelente");
  assert.ok(atMost(level(testGamer, "movilidad"), "regular"));
  assert.equal(level(thinkbook, "movilidad"), "insuficiente", "ThinkBook: PSREF only gives 'starting at' weight");
});

test("ARM caveat for cybersecurity tooling", () => {
  const prog = evaluateAudience(macbookAir).profiles.find((p) => p.id === "programacion")!;
  assert.ok(prog.limits.some((l) => /ARM/.test(l)));
});

test("different laptops get different recommendations", () => {
  const sig = (v: Variant) => evaluateAudience(v).profiles.map((p) => p.level).join(",");
  assert.equal(new Set([sig(macbookAir), sig(thinkbook), sig(testGamer)]).size, 3);
});

test("no data → insufficient, never a positive recommendation", () => {
  assert.ok(evaluateAudience(base).profiles.every((p) => p.level === "insuficiente"));
});

test("fanless or mid-range hardware is never 'Excelente' for demanding video editing", () => {
  const air24: Variant = { ...macbookAir, ram_gb: 24, storage_gb: 1000, igpu: gpu("Apple", "M5 (GPU de 10 núcleos)", true) };
  assert.ok(atMost(level(air24, "video"), "buena"));
  const video = evaluateAudience(air24).profiles.find((p) => p.id === "video")!;
  assert.ok(video.limits.some((l) => /sin ventilador/i.test(l)));
});
