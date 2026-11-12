import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { runQuery as run } from "./run";
import type { NewsLabel } from "./types";

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  original_title: string | null;
  summary_es: string;
  category: string;
  label: NewsLabel;
  original_url: string;
  image_url: string | null;
  image_authorized: boolean;
  image_credit: string | null;
  published_at: string;
  collected_at: string;
  verification: { corroborated_by?: string[]; source_official?: boolean; summary_model?: string | null; claims?: string[] };
  source: { name: string; homepage_url: string | null; is_official: boolean } | null;
  weekly: { slug: string; title: string } | null;
}

const SELECT =
  "id, slug, title, original_title, summary_es, category, label, original_url, image_url, image_authorized, image_credit, published_at, collected_at, verification, source:sources(name, homepage_url, is_official), weekly:weekly_issues(slug, title)";

export async function getNews(filters: { category?: string | null; label?: string | null }, limit = 30) {
  "use cache";
  cacheTag("news");
  const res = await run<NewsArticle[]>([], (db) => {
    let q = db.from("news_articles").select(SELECT).eq("status", "published").order("published_at", { ascending: false }).limit(limit);
    if (filters.category) q = q.eq("category", filters.category);
    if (filters.label) q = q.eq("label", filters.label);
    return q;
  });
  if (res.ok) cacheLife("hours");
  else cacheLife("minutes");
  return res;
}

export async function getNewsArticle(slug: string) {
  "use cache";
  cacheTag("news", `news:${slug}`);
  const res = await run<NewsArticle | null>(null, (db) => db.from("news_articles").select(SELECT).eq("slug", slug).eq("status", "published").maybeSingle());
  if (res.ok) cacheLife("hours");
  else cacheLife("minutes");
  return res;
}

export interface WeeklyIssue {
  id: string;
  slug: string;
  title: string;
  week_start: string;
  week_end: string;
  intro_es: string | null;
  sections: { id: string; title: string; article_ids: string[] }[];
  is_quiet_week: boolean;
  published_at: string | null;
}

export async function getWeeklyIssues(limit = 20) {
  "use cache";
  cacheTag("weekly");
  const res = await run<WeeklyIssue[]>([], (db) =>
    db.from("weekly_issues").select("id, slug, title, week_start, week_end, intro_es, sections, is_quiet_week, published_at").eq("status", "published").order("week_start", { ascending: false }).limit(limit),
  );
  if (res.ok) cacheLife("hours");
  else cacheLife("minutes");
  return res;
}

export async function getWeeklyIssue(slug: string) {
  "use cache";
  cacheTag("weekly", "news");
  const issue = await run<WeeklyIssue | null>(null, (db) =>
    db.from("weekly_issues").select("id, slug, title, week_start, week_end, intro_es, sections, is_quiet_week, published_at").eq("slug", slug).eq("status", "published").maybeSingle(),
  );
  const ids = issue.data?.sections.flatMap((s) => s.article_ids) ?? [];
  const articles = ids.length
    ? await run<NewsArticle[]>([], (db) => db.from("news_articles").select(SELECT).in("id", ids).eq("status", "published"))
    : { ok: true as const, data: [] as NewsArticle[] };
  if (issue.ok && articles.ok) cacheLife("hours");
  else cacheLife("minutes");
  return { ...issue, articles: articles.data };
}

export async function getNewsSitemap() {
  "use cache";
  cacheTag("news", "weekly");
  const [n, w] = await Promise.all([
    run<{ slug: string; published_at: string }[]>([], (db) => db.from("news_articles").select("slug, published_at").eq("status", "published").limit(50000)),
    run<{ slug: string; week_end: string }[]>([], (db) => db.from("weekly_issues").select("slug, week_end").eq("status", "published").limit(5000)),
  ]);
  if (n.ok && w.ok) cacheLife("hours");
  else cacheLife("minutes");
  return { news: n.data, weekly: w.data };
}
