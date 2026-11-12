import { test } from "node:test";
import assert from "node:assert/strict";
import { commentSchema, credentialsSchema, reviewSchema, sniffImage, spamReason } from "./validation.ts";

const id = "11111111-1111-4111-8111-111111111111";
const review = { modelId: id, modelSlug: "x", variantId: "", rating: "4", title: "Buena", body: "La uso a diario para la universidad y la batería aguanta.", tags: ["estudios"], usageMonths: "6", tempC: "", batteryH: "9.5", website: "" };

test("valid review is normalised", () => {
  const r = reviewSchema.parse(review);
  assert.equal(r.rating, 4);
  assert.equal(r.variantId, null);
  assert.equal(r.tempC, null);
  assert.equal(r.batteryH, 9.5);
});

test("honeypot, short text and out-of-range values are rejected", () => {
  assert.equal(reviewSchema.safeParse({ ...review, website: "http://spam" }).success, false);
  assert.equal(reviewSchema.safeParse({ ...review, body: "corto" }).success, false);
  assert.equal(reviewSchema.safeParse({ ...review, tempC: "300" }).success, false);
  assert.equal(reviewSchema.safeParse({ ...review, rating: "7" }).success, false);
  assert.equal(reviewSchema.safeParse({ ...review, tags: ["casino"] }).success, false);
});

test("spam heuristics", () => {
  assert.match(spamReason("compra http://a.com http://b.com http://c.com")!, /enlaces/);
  assert.match(spamReason("ESTA LAPTOP ES LA MEJOR DEL MUNDO COMPRALA YA")!, /mayúsculas/);
  assert.match(spamReason("buenisimaaaaaaaaaaaa")!, /repetidos/);
  assert.equal(spamReason("Muy buena para programar, la recomiendo. Más info en https://example.com"), null);
});

test("comments and credentials", () => {
  assert.equal(commentSchema.safeParse({ modelId: id, modelSlug: "x", reviewId: id, parentId: "", body: "¿Cuánto dura la batería?", website: "" }).success, true);
  assert.equal(credentialsSchema.safeParse({ email: "a@b.co", password: "corta", website: "" }).success, false);
});

test("image sniffing uses magic bytes", () => {
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>")), null);
});
