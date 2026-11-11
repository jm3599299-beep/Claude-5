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
