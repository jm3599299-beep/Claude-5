import { test } from "node:test";
import assert from "node:assert/strict";
import { convert, parseErApi } from "./providers.ts";

test("parses open.er-api response", () => {
  const s = parseErApi({ result: "success", time_last_update_unix: 1794355352, rates: { USD: 1, DOP: 60.75, MXN: 18.61 } }, "exchangerate-api-open");
  assert.equal(s.rates.DOP, 60.75);
  assert.match(s.rateDate, /^\d{4}-\d{2}-\d{2}$/);
});

test("rejects incomplete responses", () => {
  assert.throws(() => parseErApi({ result: "success", time_last_update_unix: 1, rates: { USD: 1, MXN: 18 } }, "x"), /DOP/);
  assert.throws(() => parseErApi({ result: "error", "error-type": "invalid-key" }, "x"), /invalid-key/);
});

test("converts through USD", () => {
  const r = { DOP: 60, MXN: 18 };
  assert.equal(convert(100, "USD", "DOP", r), 6000);
  assert.equal(convert(6000, "DOP", "USD", r), 100);
  assert.equal(convert(1800, "MXN", "DOP", r), 6000);
  assert.equal(convert(5, "EUR", "USD", r), null);
});
