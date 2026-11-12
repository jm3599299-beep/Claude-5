import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDimensions,
  parseDisplay,
  parseGraphics,
  parseMaxMemory,
  parseMemory,
  parsePorts,
  parseProcessor,
  parseSlotCount,
  parseStorage,
  parseWeight,
  parseWireless,
} from "./parse.ts";

test("processor: Intel hybrid with LPE cores", () => {
  const c = parseProcessor("Intel Core™ 5 320, 6C (2P + 4LPE) / 6T, Max Turbo up to 4.6Ghz, 6MB Intel® Smart Cache")!;
  assert.deepEqual(c, { manufacturer: "Intel", model: "Core 5 320", cores: 6, performance_cores: 2, efficiency_cores: 4, threads: 6, base_clock_ghz: null, boost_clock_ghz: 4.6 });
});

test("processor: Intel P + E + LPE", () => {
  const c = parseProcessor("Intel® Core™ Ultra 7 255H, 16C (6P + 8E + 2LPE) / 16T, Max Turbo up to 5.1GHz, 24MB Intel® Smart Cache")!;
  assert.equal(c.model, "Core Ultra 7 255H");
  assert.equal(c.performance_cores, 6);
  assert.equal(c.efficiency_cores, 10);
  assert.equal(c.threads, 16);
});

test("processor: AMD base / boost", () => {
  const c = parseProcessor("AMD Ryzen™ 7 250, 8C / 16T, 3.3 / 5.1GHz, 8MB L2 / 16MB L3")!;
  assert.equal(c.manufacturer, "AMD");
  assert.equal(c.base_clock_ghz, 3.3);
  assert.equal(c.boost_clock_ghz, 5.1);
  assert.equal(c.performance_cores, null);
});

test("processor: unknown format → null (never guessed)", () => {
  assert.equal(parseProcessor("Something else"), null);
});

test("graphics: integrated vs dedicated", () => {
  const i = parseGraphics("Integrated Intel® Graphics");
  assert.equal(i.hasDgpu, false);
  assert.equal(i.igpu?.model, "Graphics");
  const d = parseGraphics("NVIDIA® GeForce RTX™ 5060 Laptop GPU 8GB GDDR7, Boost Clock 2280MHz, TGP 115W");
  assert.equal(d.hasDgpu, true);
  assert.deepEqual(d.gpu, { manufacturer: "NVIDIA", model: "GeForce RTX 5060 Laptop GPU", is_integrated: false, vram_gb: 8, vram_type: "GDDR7", tgp_max_w: 115 });
});

test("memory: SODIMM, soldered and mixed", () => {
  assert.deepEqual(parseMemory("1x 16GB SODIMM DDR5-5600"), { ram_gb: 16, ram_type: "DDR5", ram_speed_mts: 5600, ram_soldered_gb: 0 });
  assert.deepEqual(parseMemory("32GB Soldered LPDDR5x-8533"), { ram_gb: 32, ram_type: "LPDDR5x", ram_speed_mts: 8533, ram_soldered_gb: 32 });
  assert.deepEqual(parseMemory("8GB Soldered DDR5-5600 + 8GB SODIMM DDR5-5600"), { ram_gb: 16, ram_type: "DDR5", ram_speed_mts: 5600, ram_soldered_gb: 8 });
});

test("slots and max memory", () => {
  assert.equal(parseSlotCount("One DDR5 SODIMM slot"), 1);
  assert.equal(parseSlotCount("Memory soldered to systemboard, no slots, dual-channel"), 0);
  assert.equal(parseSlotCount("Two M.2 2280 PCIe 4.0 x4 slots"), 2);
  assert.equal(parseMaxMemory("Up to 32GB DDR5-5600 offering"), 32);
});

test("storage", () => {
  assert.deepEqual(parseStorage("256GB SSD M.2 2242 PCIe® 4.0x4 NVMe®"), { storage_gb: 256, storage_type: "SSD M.2 2242 NVMe", storage_interface: "PCIe 4.0 x4", drives: 1 });
  assert.equal(parseStorage("1TB SSD M.2 2280 PCIe 5.0x4 NVMe + 1TB SSD M.2 2280 PCIe 4.0x4 NVMe").storage_gb, 2000);
});

test("display", () => {
  assert.deepEqual(parseDisplay('14" WUXGA (1920x1200) IPS 400nits Anti-glare, 45% NTSC, 60Hz'), {
    display_size_in: 14,
    display_resolution: "1920×1200",
    display_panel: "IPS",
    display_brightness_nits: 400,
    display_color_gamut: "45% NTSC",
    display_refresh_hz: 60,
  });
});

test("weight: 'Starting at' is not an exact weight", () => {
  assert.deepEqual(parseWeight("Starting at 1.39 kg (3.06 lbs)"), { exact_kg: null, starting_at_kg: 1.39 });
  assert.deepEqual(parseWeight("1.12 kg (2.47 lbs)"), { exact_kg: 1.12, starting_at_kg: null });
});

test("ports, wireless, dimensions", () => {
  assert.deepEqual(parsePorts("1x USB-A (USB 5Gbps), Always On, 1x USB-A (USB 5Gbps), 2x USB-C® (USB 20Gbps), with USB PD 45-65W and DisplayPort™ 1.4, 1x HDMI® 2.1, up to 4K/60Hz"), [
    "1x USB-A (USB 5Gbps), Always On",
    "1x USB-A (USB 5Gbps)",
    "2x USB-C (USB 20Gbps), with USB PD 45-65W and DisplayPort 1.4",
    "1x HDMI 2.1, up to 4K/60Hz",
  ]);
  assert.deepEqual(parseWireless("Intel® Wi-Fi® 6E AX211, 802.11ax 2x2 + BT5.4"), { wifi: "Intel Wi-Fi 6E AX211, 802.11ax 2x2", bluetooth: "5.4" });
  assert.equal(parseDimensions("312.5 x 220.9 x 17.2 mm (12.3 x 8.7 x 0.68 inches)"), "312.5 × 220.9 × 17.2");
});
