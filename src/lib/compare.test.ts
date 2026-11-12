import { test } from "node:test";
import assert from "node:assert/strict";
import { bestIndex, compareHref, parseCompareParam, type CompareItem, type CompareRow } from "./compare.ts";

const row: CompareRow = { group: "g", label: "RAM", value: () => null, score: (i) => (i as unknown as { s: number | null }).s, better: "higher" };
const items = (...s: (number | null)[]) => s.map((x) => ({ s: x }) as unknown as CompareItem);

test("best value highlighting", () => {
  assert.deepEqual(bestIndex(row, items(16, 32, 8)), [1]);
  assert.deepEqual(bestIndex(row, items(16, 16)), [], "ties → no winner");
  assert.deepEqual(bestIndex(row, items(16, null)), [], "a single known value never wins");
  assert.deepEqual(bestIndex({ ...row, better: "lower" }, items(1.2, 1.5, 1.2)), [0, 2]);
});

test("compare param parsing is strict and bounded", () => {
  assert.deepEqual(parseCompareParam("a-b:k1,c:k2,a-b:k1,BAD:x,<script>:y"), [
    { slug: "a-b", key: "k1" },
    { slug: "c", key: "k2" },
  ]);
  assert.equal(parseCompareParam("a:1,b:2,c:3,d:4,e:5").length, 4);
  assert.equal(compareHref([{ slug: "a", key: "1" }, { slug: "b", key: "2" }]), "/comparar?v=a:1,b:2");
});
