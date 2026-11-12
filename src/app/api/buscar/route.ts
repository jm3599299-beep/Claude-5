import type { NextRequest } from "next/server";
import { searchForPicker } from "@/lib/data/catalog";

/** Model + variant search for the comparator picker. Read-only, public data. */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  const res = await searchForPicker(q);
  return Response.json(
    { results: res.data, ok: res.ok },
    { headers: { "cache-control": "public, max-age=60, s-maxage=300" } },
  );
}
