import "server-only";
import { getPublicClient } from "@/lib/supabase/public";
import type { DataResult } from "./types";

type Db = NonNullable<ReturnType<typeof getPublicClient>>;

/** Executes a public query and normalizes "not configured" / error states. */
export async function runQuery<T>(
  fallback: T,
  fn: (db: Db) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<DataResult<T>> {
  const db = getPublicClient();
  if (!db) return { ok: false, reason: "not_configured", data: fallback };
  const { data, error } = await fn(db);
  if (error) {
    console.error("[LaptopVerse] data error:", error);
    return { ok: false, reason: "error", data: fallback };
  }
  return { ok: true, data: (data ?? fallback) as T };
}
