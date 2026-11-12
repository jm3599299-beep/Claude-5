import "server-only";
import { cacheLife } from "next/cache";

/**
 * Reference "now" for time windows (e.g. last 90 days of store prices).
 * Cached for an hour so pages can be prerendered (Cache Components forbids
 * reading the clock directly while prerendering).
 */
export async function cachedNow(): Promise<number> {
  "use cache";
  cacheLife("hours");
  return Date.now();
}
