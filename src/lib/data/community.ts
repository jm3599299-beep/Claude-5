import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { runQuery as run } from "./run";
import type { ComparisonCard, NewsCard, ReviewCard } from "./types";


export async function getLatestNews(limit = 6) {
  "use cache";
  cacheLife("minutes");
  cacheTag("news");
  return run<NewsCard[]>([], (db) =>
    db
      .from("news_articles")
      .select("id, slug, title, summary_es, category, label, image_url, image_authorized, published_at, source:sources(name)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit),
  );
}

export async function getRecentReviews(limit = 4) {
  "use cache";
  cacheLife("minutes");
  cacheTag("reviews");
  return run<ReviewCard[]>([], (db) =>
    db
      .from("reviews")
      .select("id, rating, title, body, is_professional, created_at, model:models(slug, name), author:profiles(display_name, username)")
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(limit),
  );
}

export async function getFeaturedComparisons(limit = 4) {
  "use cache";
  cacheLife("hours");
  cacheTag("comparisons");
  return run<ComparisonCard[]>([], (db) =>
    db.from("comparisons").select("id, slug, title, variant_ids").eq("is_featured", true).order("created_at", { ascending: false }).limit(limit),
  );
}

/** Resolves a saved comparison to its (model slug, variant key) pairs. */
export async function getComparisonBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("comparisons");
  const res = await run<{ variant_ids: string[] } | null>(null, (db) => db.from("comparisons").select("variant_ids").eq("slug", slug).maybeSingle());
  if (!res.data) return { ...res, data: null };
  const vs = await run<{ id: string; variant_key: string; model: { slug: string } | null }[]>([], (db) =>
    db.from("variants").select("id, variant_key, model:models(slug)").in("id", res.data!.variant_ids),
  );
  const items = res.data.variant_ids.flatMap((id) => {
    const v = vs.data.find((x) => x.id === id);
    return v?.model ? [{ slug: v.model.slug, key: v.variant_key }] : [];
  });
  return { ok: true as const, data: items.length ? items : null };
}
