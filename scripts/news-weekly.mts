/**
 * LaptopVerse — recopilación semanal de noticias y LaptopVerse Weekly.
 *
 *   DATABASE_URL=… npm run news:weekly                     # recopila los últimos 7 días y arma el Weekly de la semana anterior
 *   npm run news:weekly -- --dry-run                       # todo, sin escribir en la base de datos
 *   npm run news:weekly -- --days 10 --week 2026-11-09     # ventana y semana del Weekly a medida
 *
 * Opcional: ANTHROPIC_API_KEY (resúmenes en español con Claude). Sin clave, las
 * noticias se guardan como pendientes para que un editor escriba el resumen.
 */
import postgres from "postgres";
import { parseFeed, type FeedItem } from "../src/lib/news/feeds.ts";
import {
  CATEGORIES,
  SAME_STORY,
  categorize,
  dateOk,
  decideStatus,
  dedupeKey,
  isRelevant,
  isoWeek,
  labelFor,
  similarity,
  slugifyTitle,
  type Category,
  type NewsLabel,
} from "../src/lib/news/rules.ts";
import { hasLlm, summarizeWithClaude, unsupportedNumbers, wordCount } from "../src/lib/news/summarize.ts";

const args = process.argv.slice(2);
const flag = (n: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const dryRun = args.includes("--dry-run");
const days = Number(flag("days") ?? 7);
const now = flag("now") ? Date.parse(flag("now")!) : Date.now();
const UA = "LaptopVerseNews/0.1 (RSS reader; weekly; low volume)";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(2);
}
const sql = postgres(url, { max: 2, onnotice: () => {} });

interface Feed {
  id: string;
  feed_url: string;
  auto_publish: boolean;
  images_authorized: boolean;
  default_label: NewsLabel;
  source_id: string;
  source_name: string;
  is_official: boolean;
  trust_level: number;
}
interface Candidate extends FeedItem {
  feed: Feed;
  key: string;
  category: Category;
  label: NewsLabel;
  corroboratedBy: string[];
}

const stats = { feeds: 0, feedErrors: 0, items: 0, recent: 0, relevant: 0, duplicates: 0, corroborations: 0, saved: 0, published: 0, pending: 0, summarized: 0 };
const [run] = dryRun ? [{ id: null }] : await sql<{ id: string }[]>`insert into sync_runs (job, status) values ('news_weekly', 'running') returning id`;

try {
  const feeds = await sql<Feed[]>`
    select f.id, f.feed_url, f.auto_publish, f.images_authorized, f.default_label, s.id as source_id, s.name as source_name, s.is_official, s.trust_level
    from news_feeds f join sources s on s.id = f.source_id where f.enabled order by s.is_official desc, s.trust_level desc`;

  // 1–4. Fetch, parse, date check, relevance
  const candidates: Candidate[] = [];
  for (const feed of feeds) {
    stats.feeds++;
    try {
      const get = () => fetch(feed.feed_url, { headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5" }, signal: AbortSignal.timeout(25_000) });
      // One retry after a short pause for transient network errors.
      const res = await get().catch(async () => {
        await new Promise((r) => setTimeout(r, 3000));
        return get();
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = parseFeed(await res.text());
      stats.items += items.length;
      for (const it of items) {
        if (!dateOk(it.published, now, days)) continue;
        stats.recent++;
        if (!isRelevant(it.title, it.summary)) continue;
        stats.relevant++;
        candidates.push({
          ...it,
          imageUrl: feed.images_authorized ? it.imageUrl : null,
          feed,
          key: dedupeKey(it.link),
          category: categorize(it.title, it.summary),
          label: labelFor(feed.is_official, it.title),
          corroboratedBy: [],
        });
      }
      if (!dryRun) await sql`update news_feeds set last_fetched_at = now(), last_error = null where id = ${feed.id}`;
      console.log(`✓ ${feed.source_name}: ${items.length} entradas`);
    } catch (e) {
      stats.feedErrors++;
      console.error(`✗ ${feed.source_name}: ${(e as Error).message}`);
      if (!dryRun) await sql`update news_feeds set last_error = ${(e as Error).message.slice(0, 500)}, last_fetched_at = now() where id = ${feed.id}`;
    }
  }

  // 5. Deduplicate: exact (canonical URL) and near-duplicate titles across sources.
  const existing = await sql<{ id: string; dedupe_key: string; title: string; original_title: string | null; verification: Record<string, unknown> }[]>`
    select id, dedupe_key, title, original_title, verification from news_articles where collected_at > now() - interval '21 days'`;
  const known = new Set(existing.map((e) => e.dedupe_key));
  const unique = candidates.filter((c, i) => !known.has(c.key) && candidates.findIndex((x) => x.key === c.key) === i);
  stats.duplicates += candidates.length - unique.length;

  const representatives: Candidate[] = [];
  // Official and more trusted sources first, so they become the representative of a story.
  for (const c of unique.sort((a, b) => Number(b.feed.is_official) - Number(a.feed.is_official) || b.feed.trust_level - a.feed.trust_level)) {
    const same = representatives.find((r) => similarity(r.title, c.title) >= SAME_STORY);
    if (same) {
      if (same.feed.source_id !== c.feed.source_id) same.corroboratedBy.push(c.feed.source_name);
      stats.duplicates++;
      continue;
    }
    const prior = existing.find((e) => similarity(e.original_title ?? e.title, c.title) >= SAME_STORY);
    if (prior) {
      // Already covered: record the extra source as corroboration of the stored story.
      stats.corroborations++;
      if (!dryRun) {
        const list = new Set([...(((prior.verification?.corroborated_by as string[]) ?? []) as string[]), c.feed.source_name]);
        await sql`update news_articles set verification = verification || ${sql.json({ corroborated_by: [...list] })} where id = ${prior.id}`;
      }
      continue;
    }
    representatives.push(c);
  }

  // 6–9. Verify, summarise in Spanish, save.
  const llm = hasLlm();
  if (!llm) console.log("  (Sin ANTHROPIC_API_KEY: las noticias se guardan pendientes de resumen editorial.)");
  for (const c of representatives) {
    const sourceText = `${c.title}. ${c.summary}`;
    const summary = llm ? await summarizeWithClaude({ sourceName: c.feed.source_name, label: c.label, title: c.title, published: c.published, text: c.summary, url: c.link }) : null;
    const invented = summary ? unsupportedNumbers(`${summary.title_es} ${summary.summary_es}`, sourceText) : [];
    const words = summary ? wordCount(summary.summary_es) : 0;
    const summaryOk = Boolean(summary && !summary.insufficient && invented.length === 0 && words >= 20 && words <= 95);
    if (summary) stats.summarized++;

    const corroborating = [...new Set(c.corroboratedBy)];
    const status = decideStatus({ feedAutoPublish: c.feed.auto_publish, sourceIsOfficial: c.feed.is_official, corroboratingSources: corroborating.length, label: c.label, summaryOk });
    const verification = {
      source_official: c.feed.is_official,
      corroborated_by: corroborating,
      date_checked: true,
      relevance: "laptop_terms",
      summary_model: summary ? "claude-opus-5-5" : null,
      summary_insufficient: summary?.insufficient ?? null,
      unsupported_numbers: invented,
      summary_words: words || null,
      claims: summary?.claims ?? [],
      auto_published: status === "published",
    };
    const row = {
      slug: slugifyTitle(summary?.title_es || c.title, c.key),
      title: summary && summaryOk ? summary.title_es : c.title,
      original_title: c.title,
      summary_es: summaryOk ? summary!.summary_es : "(Pendiente de resumen editorial en español.)",
      category: c.category,
      label: c.label,
      source_id: c.feed.source_id,
      feed_id: c.feed.id,
      original_url: c.link,
      dedupe_key: c.key,
      image_url: c.imageUrl,
      image_authorized: Boolean(c.imageUrl && c.feed.images_authorized),
      published_at: c.published!,
      verification,
      status,
      importance: (c.feed.is_official ? 2 : 0) + corroborating.length + (c.category === "lanzamientos" || c.category === "procesadores" || c.category === "gpu" ? 1 : 0),
    };
    console.log(`  ${status === "published" ? "↑" : "◌"} [${c.category}/${c.label}] ${c.feed.source_name}: ${c.title.slice(0, 80)}${invented.length ? ` (cifras no verificadas: ${invented.join(", ")})` : ""}`);
    if (dryRun) continue;
    await sql`insert into news_articles ${sql({ ...row, verification: sql.json(verification) } as never)} on conflict (dedupe_key) do nothing`;
    stats.saved++;
    if (status === "published") stats.published++;
    else stats.pending++;
  }

  // 10. LaptopVerse Weekly for the target week (default: the previous ISO week).
  const ref = flag("week") ? new Date(`${flag("week")}T12:00:00Z`) : new Date(now - 7 * 86_400_000);
  const w = isoWeek(ref);
  const weekArticles = await sql<{ id: string; title: string; category: Category; label: NewsLabel; importance: number; status: string }[]>`
    select id, title, category, label, importance, status from news_articles
    where status in ('published', 'approved') and published_at >= ${w.start}::date and published_at < (${w.end}::date + 1)
    order by importance desc, published_at desc`;
  const SECTIONS: { id: string; title: string; match: (a: (typeof weekArticles)[number]) => boolean }[] = [
    { id: "lanzamientos", title: "Los lanzamientos más importantes", match: (a) => a.category === "lanzamientos" && a.label === "official" },
    { id: "procesadores", title: "Procesadores nuevos", match: (a) => a.category === "procesadores" },
    { id: "gpu", title: "GPU nuevas", match: (a) => a.category === "gpu" },
    { id: "laptops", title: "Las laptops más interesantes", match: (a) => ["gaming", "empresariales", "estudiantes", "macbook", "resenas", "lanzamientos"].includes(a.category) },
    { id: "tecnologias", title: "Tecnologías que están cambiando el mercado", match: (a) => ["ia", "pantallas", "baterias", "refrigeracion"].includes(a.category) },
    { id: "fabricantes", title: "Novedades de fabricantes y sistemas", match: (a) => ["sistemas", "actualizaciones", "general"].includes(a.category) },
    { id: "seguimiento", title: "Anuncios que merecen seguimiento", match: (a) => a.label === "rumor" || a.label === "leak" },
  ];
  const used = new Set<string>();
  const sections = SECTIONS.map((s) => {
    const ids = weekArticles.filter((a) => !used.has(a.id) && (s.id === "seguimiento" ? s.match(a) : a.label !== "rumor" && a.label !== "leak" && s.match(a))).map((a) => a.id);
    ids.forEach((id) => used.add(id));
    return { id: s.id, title: s.title, article_ids: ids };
  }).filter((s) => s.article_ids.length);
  const quiet = weekArticles.length < 3;
  const fmt = (d: string) => new Intl.DateTimeFormat("es", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const range = `del ${fmt(w.start)} al ${fmt(w.end)} de ${w.year}`;
  const counts = Object.entries(weekArticles.reduce<Record<string, number>>((m, a) => ((m[CATEGORIES[a.category]] = (m[CATEGORIES[a.category]] ?? 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k.toLowerCase()} (${n})`);
  const intro = quiet
    ? `Semana tranquila en el mundo de las laptops: ${weekArticles.length === 0 ? "no hubo" : `solo hubo ${weekArticles.length}`} novedad${weekArticles.length === 1 ? "" : "es"} verificada${weekArticles.length === 1 ? "" : "s"} ${range}. Seguimos atentos a los anuncios de los fabricantes.`
    : `${range[0].toUpperCase()}${range.slice(1)} recopilamos ${weekArticles.length} noticias verificadas sobre laptops. Temas de la semana: ${counts.slice(0, 4).join(", ")}. Cada noticia enlaza a su fuente original.`;
  console.log(`\nWeekly ${w.slug}: ${weekArticles.length} noticias, ${sections.length} secciones${quiet ? " (semana tranquila)" : ""}`);
  if (!dryRun) {
    const autoWeekly = process.env.NEWS_AUTO_PUBLISH_WEEKLY === "true";
    const [issue] = await sql<{ id: string; status: string }[]>`
      insert into weekly_issues (slug, week_start, week_end, title, intro_es, sections, is_quiet_week, status, published_at)
      values (${w.slug}, ${w.start}, ${w.end}, ${`LaptopVerse Weekly — semana ${w.week} de ${w.year}`}, ${intro}, ${sql.json(sections)}, ${quiet},
              ${autoWeekly ? "published" : "pending"}, ${autoWeekly ? new Date().toISOString() : null})
      on conflict (week_start) do update set intro_es = excluded.intro_es, sections = excluded.sections, is_quiet_week = excluded.is_quiet_week
        where weekly_issues.status <> 'published'
      returning id, status`;
    if (issue) await sql`update news_articles set weekly_issue_id = ${issue.id} where id = any(${weekArticles.map((a) => a.id)}::uuid[])`;
  }

  console.log(`\n${JSON.stringify(stats)}${dryRun ? " — simulación, sin cambios" : ""}`);
  if (!dryRun) await sql`update sync_runs set status = ${stats.feedErrors ? "partial" : "success"}, finished_at = now(), stats = ${sql.json(stats)} where id = ${run.id}`;

  if (!dryRun && process.env.REVALIDATE_URL && process.env.REVALIDATE_SECRET) {
    const r = await fetch(process.env.REVALIDATE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.REVALIDATE_SECRET}` },
      body: JSON.stringify({ tags: ["news", "weekly"] }),
    });
    console.log(r.ok ? "Caché revalidada" : `Aviso: revalidación ${r.status}`);
  }
} catch (e) {
  console.error(`✗ ${(e as Error).message}`);
  if (!dryRun && run.id) await sql`update sync_runs set status = 'failed', finished_at = now(), error = ${(e as Error).message.slice(0, 1000)}, stats = ${sql.json(stats)} where id = ${run.id}`;
  process.exitCode = 1;
} finally {
  await sql.end();
}
