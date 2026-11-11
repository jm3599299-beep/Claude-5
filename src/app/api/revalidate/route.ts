import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";

const body = z.object({ tags: z.array(z.string().regex(/^[a-z0-9:_-]{1,200}$/)).min(1).max(500) });

function authorized(header: string | null) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Invalidates cached catalog data after imports or admin edits. */
export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) return Response.json({ error: "No autorizado" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  for (const tag of parsed.data.tags) revalidateTag(tag, "max");
  return Response.json({ revalidated: parsed.data.tags.length });
}
