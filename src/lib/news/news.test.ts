import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeed } from "./feeds.ts";
import { canonicalUrl, categorize, dateOk, decideStatus, dedupeKey, isRelevant, isoWeek, labelFor, similarity } from "./rules.ts";

// Synthetic feeds (TEST data, not real news).
const rss = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title>
<item><title>TEST Corp unveils new laptop with Core Ultra chip</title><link>https://example.com/a?utm_source=x</link>
<pubDate>Tue, 10 Nov 2026 14:00:00 GMT</pubDate><description><![CDATA[<p>The <b>TEST</b> laptop &amp; more.</p><script>alert(1)</script>]]></description>
<media:content url="https://example.com/a.jpg" medium="image"/></item>
<item><title>No link item</title></item>
<item><title>Bad date</title><link>https://example.com/b</link><pubDate>not a date</pubDate></item>
</channel></rss>`;
const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
<entry><title>TEST MacBook update</title><link rel="alternate" href="https://example.org/m"/><updated>2026-11-09T08:00:00Z</updated><summary>Summary</summary></entry></feed>`;

test("parses RSS and Atom, strips HTML and scripts, rejects items without links", () => {
  const items = parseFeed(rss);
  assert.equal(items.length, 2);
  assert.equal(items[0].summary, "The TEST laptop & more.");
  assert.equal(items[0].imageUrl, "https://example.com/a.jpg");
  assert.equal(items[0].published, "2026-11-10T14:00:00.000Z");
  assert.equal(items[1].published, null);
  const a = parseFeed(atom);
  assert.equal(a[0].link, "https://example.org/m");
  assert.throws(() => parseFeed("<html></html>"));
});

test("relevance and categories", () => {
  assert.ok(isRelevant("Lenovo announces ThinkPad X1", ""));
  assert.ok(!isRelevant("Apple TV gets new feature", "streaming"));
  assert.equal(categorize("NVIDIA GeForce RTX 5070 laptop GPU", ""), "gpu");
  assert.equal(categorize("Apple introduces MacBook Pro", ""), "macbook");
  assert.equal(categorize("Lenovo unveils Legion 7", ""), "gaming");
  // Real-feed regressions: product families beat passing comparisons
  assert.equal(categorize("Looks like a business MacBook - Asus ExpertBook A7 Laptop Review", ""), "empresariales");
  assert.equal(categorize("Asus TUF Gaming 16 laptop with RTX 5050 review", ""), "gaming");
  assert.equal(categorize("HP Omnibook 5 14 Wildcat review: Better than any Pavilion laptop", "It beats the MacBook Air in battery life"), "resenas");
  // Deals are not news
  assert.ok(!isRelevant("Apple's M5 MacBook Air is down to its lowest price since July", ""));
});

test("labels: official sources vs rumors and leaks", () => {
  assert.equal(labelFor(true, "Company may launch X"), "official");
  assert.equal(labelFor(false, "Laptop reportedly coming in March"), "rumor");
  assert.equal(labelFor(false, "Benchmark leak shows new chip"), "leak");
  assert.equal(labelFor(false, "Hands-on with the new laptop"), "analysis");
});

test("deduplication", () => {
  assert.equal(canonicalUrl("https://www.Example.com/a/?utm_source=x&id=2#top"), "https://example.com/a?id=2");
  assert.equal(dedupeKey("https://example.com/a/?utm_medium=rss"), dedupeKey("https://www.example.com/a"));
  assert.ok(similarity("Lenovo unveils ThinkPad X1 Carbon Gen 14", "ThinkPad X1 Carbon Gen 14 unveiled by Lenovo") >= 0.5);
  assert.ok(similarity("Lenovo unveils ThinkPad X1", "NVIDIA launches RTX 5090") < 0.2);
});

test("dates: inside window, never in the future", () => {
  const now = Date.parse("2026-11-12T00:00:00Z");
  assert.ok(dateOk("2026-11-10T00:00:00Z", now, 7));
  assert.ok(!dateOk("2026-10-01T00:00:00Z", now, 7));
  assert.ok(!dateOk("2026-11-20T00:00:00Z", now, 7));
  assert.ok(!dateOk(null, now, 7));
});

test("publication policy", () => {
  const base = { feedAutoPublish: true, sourceIsOfficial: true, corroboratingSources: 0, label: "official" as const, summaryOk: true };
  assert.equal(decideStatus(base), "published");
  assert.equal(decideStatus({ ...base, feedAutoPublish: false }), "pending");
  assert.equal(decideStatus({ ...base, summaryOk: false }), "pending");
  assert.equal(decideStatus({ ...base, sourceIsOfficial: false, label: "analysis" }), "pending");
  assert.equal(decideStatus({ ...base, sourceIsOfficial: false, label: "analysis", corroboratingSources: 1 }), "published");
  assert.equal(decideStatus({ ...base, sourceIsOfficial: false, label: "rumor", corroboratingSources: 3 }), "pending");
});

test("ISO week", () => {
  assert.deepEqual(isoWeek(new Date("2026-11-12T10:00:00Z")), { year: 2026, week: 46, start: "2026-11-09", end: "2026-11-15", slug: "2026-semana-46" });
});

import { unsupportedNumbers, wordCount } from "./summarize.ts";
test("number verification flags invented figures", () => {
  const src = "TEST Corp announced the X1 with 16 GB of RAM, starting at $1,299 on March 3.";
  assert.deepEqual(unsupportedNumbers("El X1 tiene 16 GB de RAM y cuesta 1.299 dólares desde el 3 de marzo.", src), []);
  assert.deepEqual(unsupportedNumbers("El X1 tiene 32 GB de RAM.", src), ["32"]);
  assert.equal(wordCount("uno dos  tres"), 3);
});
