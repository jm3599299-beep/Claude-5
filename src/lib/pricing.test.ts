import { test } from "node:test";
import assert from "node:assert/strict";
import { conversions, referencePrice, storeStats, type PriceObs } from "./pricing.ts";

const p = (kind: PriceObs["kind"], amount: number, observed_at: string, country = "MX", currency = "MXN"): PriceObs => ({
  kind, amount, observed_at, country_code: country, currency_code: currency, product_url: null, in_stock: null, store: null, source: null,
});
const now = Date.parse("2026-11-12");

test("store stats: average only with ≥3 recent samples", () => {
  const two = storeStats([p("store", 100, "2026-11-01"), p("store", 120, "2026-11-05")], "MX", now)!;
  assert.equal(two.avg, null);
  assert.equal(two.min, 100);
  const three = storeStats([p("store", 100, "2026-11-01"), p("store", 120, "2026-11-05"), p("store", 110, "2026-11-10")], "MX", now)!;
  assert.equal(three.avg, 110);
});

test("store stats ignore old observations and other kinds", () => {
  assert.equal(storeStats([p("store", 100, "2026-01-01"), p("launch", 90, "2026-11-01")], "MX", now), null);
});

test("reference price preference: official > launch > store", () => {
  assert.equal(referencePrice([p("store", 80, "2026-11-01"), p("launch", 100, "2026-03-01")])!.kind, "launch");
  assert.equal(referencePrice([p("launch", 100, "2026-03-01"), p("official", 95, "2026-10-01")])!.amount, 95);
});

test("conversions exclude the original currency", () => {
  const c = conversions(p("launch", 1000, "2026-03-03", "US", "USD"), [
    { quote: "DOP", rate: 60, provider: "x", rate_date: "2026-11-11" },
    { quote: "MXN", rate: 18, provider: "x", rate_date: "2026-11-11" },
  ]);
  assert.deepEqual(c, [{ currency: "DOP", amount: 60000 }, { currency: "MXN", amount: 18000 }]);
});
