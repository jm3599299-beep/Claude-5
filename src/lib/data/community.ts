import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { runQuery as run } from "./run";
import { getPublicClient } from "@/lib/supabase/public";
import type { ComparisonCard, NewsCard, ReviewCard } from "./types";


export async function getLatestNews(limit = 6) {
  "use cache";
  cacheTag("news");
  const res = await run<NewsCard[]>([], (db) =>
    db
      .from("news_articles")
      .select("id, slug, title, summary_es, category, label, image_url, image_authorized, published_at, source:sources(name)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit),
  );
  cacheLife("minutes");
  return res;
}

export async function getRecentReviews(limit = 4) {
  "use cache";
  cacheTag("reviews");
  const res = await run<ReviewCard[]>([], (db) =>
    db
      .from("reviews")
      .select("id, rating, title, body, is_professional, created_at, model:models(slug, name), author:profiles(display_name, username)")
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  cacheLife("minutes");
  return res;
}

export async function getFeaturedComparisons(limit = 4) {
  "use cache";
  cacheTag("comparisons");
  const res = await run<ComparisonCard[]>([], (db) =>
    db.from("comparisons").select("id, slug, title, variant_ids").eq("is_featured", true).order("created_at", { ascending: false }).limit(limit),
  );
  if (res.ok) cacheLife("hours");
  else cacheLife("minutes"); // errors are retried soon instead of being cached for long
  return res;
}

/** Resolves a saved comparison to its (model slug, variant key) pairs. */
export async function getComparisonBySlug(slug: string) {
  "use cache";
  cacheTag("comparisons");
  const res = await run<{ variant_ids: string[] } | null>(null, (db) => db.from("comparisons").select("variant_ids").eq("slug", slug).maybeSingle());
  if (!res.data) {
    if (res.ok) cacheLife("hours");
    else cacheLife("minutes");
    return { ...res, data: null };
  }
  const vs = await run<{ id: string; variant_key: string; model: { slug: string } | null }[]>([], (db) =>
    db.from("variants").select("id, variant_key, model:models(slug)").in("id", res.data!.variant_ids),
  );
  const items = res.data.variant_ids.flatMap((id) => {
    const v = vs.data.find((x) => x.id === id);
    return v?.model ? [{ slug: v.model.slug, key: v.variant_key }] : [];
  });
  if (vs.ok) cacheLife("hours");
  else cacheLife("minutes");
  return { ok: true as const, data: items.length ? items : null };
}

export interface CommunityComment {
  id: string;
  parent_id: string | null;
  body: string;
  likes_count: number;
  created_at: string;
  author: { display_name: string | null; username: string | null } | null;
}

export interface CommunityReview {
  id: string;
  rating: number;
  title: string;
  body: string;
  experience_tags: string[];
  usage_months: number | null;
  observed_temp_c: number | null;
  observed_battery_h: number | null;
  is_professional: boolean;
  likes_count: number;
  created_at: string;
  updated_at: string;
  variant: { name: string } | null;
  author: { display_name: string | null; username: string | null } | null;
  comments: CommunityComment[];
}

export interface RatingStats {
  user_reviews: number;
  user_avg: number | null;
  pro_reviews: number;
  pro_avg: number | null;
}

/** Public (visible) reviews of a model with their visible comments. */
export async function getModelCommunity(modelId: string) {
  "use cache";
  cacheTag("reviews", `community:${modelId}`);
  const [reviews, stats, photos] = await Promise.all([
    run<CommunityReview[]>([], (db) =>
      db
        .from("reviews")
        .select(
          "id, rating, title, body, experience_tags, usage_months, observed_temp_c, observed_battery_h, is_professional, likes_count, created_at, updated_at, variant:variants(name), author:profiles(display_name, username), comments(id, parent_id, body, likes_count, created_at, status, author:profiles(display_name, username))",
        )
        .eq("model_id", modelId)
        .eq("status", "visible")
        .eq("comments.status", "visible")
        .order("is_professional", { ascending: false })
        .order("likes_count", { ascending: false })
        .order("created_at", { ascending: false })
        .order("created_at", { referencedTable: "comments", ascending: true })
        .limit(50),
    ),
    run<RatingStats | null>(null, (db) => db.from("model_rating_stats").select("user_reviews, user_avg, pro_reviews, pro_avg").eq("model_id", modelId).maybeSingle()),
    run<{ id: string; storage_path: string; caption: string | null; author: { display_name: string | null; username: string | null } | null }[]>([], (db) =>
      db.from("user_photos").select("id, storage_path, caption, author:profiles(display_name, username)").eq("model_id", modelId).eq("status", "visible").order("created_at", { ascending: false }).limit(24),
    ),
  ]);
  // Private bucket: approved photos are served through short-lived signed URLs (longer than the cache lifetime).
  let signed: Record<string, string> = {};
  const db = getPublicClient();
  if (db && photos.data.length) {
    const { data } = await db.storage.from("user-photos").createSignedUrls(photos.data.map((p) => p.storage_path), 6 * 3600);
    signed = Object.fromEntries((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl]] : [])));
  }
  cacheLife("minutes");
  return {
    ok: reviews.ok,
    reviews: reviews.data,
    stats: stats.data,
    photos: photos.data.flatMap((p) => (signed[p.storage_path] ? [{ ...p, url: signed[p.storage_path] }] : [])),
  };
}

/** Community feed: latest visible reviews, optionally filtered by experience tag. */
export async function getCommunityFeed(tag: string | null, limit = 30) {
  "use cache";
  cacheTag("reviews");
  const res = await run<(ReviewCard & { experience_tags: string[] })[]>([], (db) => {
    let q = db
      .from("reviews")
      .select("id, rating, title, body, is_professional, created_at, experience_tags, model:models!inner(slug, name, published), author:profiles(display_name, username)")
      .eq("status", "visible")
      .eq("model.published", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (tag) q = q.contains("experience_tags", [tag]);
    return q;
  });
  cacheLife("minutes");
  return res;
}
