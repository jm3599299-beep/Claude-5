/** Minimal RSS 2.0 / Atom reader (feeds are treated as untrusted input). */
import { XMLParser } from "fast-xml-parser";

export interface FeedItem {
  title: string;
  link: string;
  published: string | null; // ISO 8601, null when missing or invalid
  summary: string; // plain text, truncated
  imageUrl: string | null;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", processEntities: true, htmlEntities: true, trimValues: true });

const asArray = <T>(x: T | T[] | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const text = (x: unknown): string => {
  if (x == null) return "";
  if (typeof x === "string" || typeof x === "number") return String(x);
  if (typeof x === "object" && "#text" in (x as Record<string, unknown>)) return String((x as Record<string, unknown>)["#text"]);
  return "";
};

/** Strips HTML and collapses whitespace. */
export function plain(html: string, max = 1200): string {
  const s = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max).replace(/\s+\S*$/, "")}…` : s;
}

export function toIso(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml);
  if (doc.rss?.channel) {
    return asArray(doc.rss.channel.item).flatMap((it: Record<string, unknown>) => {
      const link = text(it.link) || text((it.guid as Record<string, unknown>) ?? "");
      const title = plain(text(it.title), 300);
      if (!title || !/^https?:\/\//.test(link)) return [];
      type Attrs = Record<string, string>;
      const enclosure = asArray<Attrs>(it.enclosure as Attrs | Attrs[] | undefined).find((e) => /^image\//.test(e?.["@type"] ?? ""));
      const mediaUrl = asArray<Attrs>((it["media:content"] ?? it["media:thumbnail"]) as Attrs | Attrs[] | undefined)
        .map((m) => m?.["@url"])
        .find(Boolean);
      return [
        {
          title,
          link,
          published: toIso(text(it.pubDate) || text(it["dc:date"])),
          summary: plain(text(it.description) || text(it["content:encoded"])),
          imageUrl: enclosure?.["@url"] ?? mediaUrl ?? null,
        },
      ];
    });
  }
  if (doc.feed) {
    return asArray(doc.feed.entry).flatMap((e: Record<string, unknown>) => {
      const links = asArray<Record<string, string>>(e.link as Record<string, string> | Record<string, string>[] | undefined);
      const link = (links.find((l) => !l["@rel"] || l["@rel"] === "alternate") ?? links[0])?.["@href"] ?? "";
      const title = plain(text(e.title), 300);
      if (!title || !/^https?:\/\//.test(link)) return [];
      return [
        {
          title,
          link,
          published: toIso(text(e.published) || text(e.updated)),
          summary: plain(text(e.summary) || text(e.content)),
          imageUrl: null,
        },
      ];
    });
  }
  throw new Error("Formato de feed no reconocido (ni RSS ni Atom)");
}
