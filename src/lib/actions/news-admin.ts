"use server";

import { revalidateTag, updateTag } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/news/rules";

export interface AdminState {
  ok: boolean;
  message: string | null;
}

async function editor() {
  const user = await getCurrentUser();
  if (!user || !["editor", "admin"].includes(user.role) || user.isBanned) return null;
  return { user, db: (await getServerClient())! };
}

const reviewSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["publish", "reject", "save"]),
  title: z.string().trim().min(5, "Título demasiado corto").max(200),
  summary: z.string().trim().min(20, "El resumen en español es obligatorio (mín. 20 caracteres)").max(1200),
  category: z.enum(Object.keys(CATEGORIES) as [string, ...string[]]),
  label: z.enum(["official", "analysis", "rumor", "leak"]),
  notes: z.string().trim().max(1000).optional().default(""),
});

export async function reviewNewsAction(_: AdminState, form: FormData): Promise<AdminState> {
  const ctx = await editor();
  if (!ctx) return { ok: false, message: "No autorizado." };
  const parsed = reviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  if (d.decision === "publish" && /pendiente de resumen/i.test(d.summary)) return { ok: false, message: "Escribe el resumen en español antes de publicar." };
  const { error } = await ctx.db
    .from("news_articles")
    .update({
      title: d.title,
      summary_es: d.summary,
      category: d.category,
      label: d.label,
      review_notes: d.notes || null,
      reviewed_by: ctx.user.id,
      reviewed_at: new Date().toISOString(),
      ...(d.decision === "publish" ? { status: "published" } : d.decision === "reject" ? { status: "rejected" } : {}),
    })
    .eq("id", d.id);
  if (error) return { ok: false, message: /oficial/i.test(error.message) ? "Solo las fuentes oficiales pueden llevar la etiqueta «Oficial»." : "No se pudo guardar." };
  updateTag("news");
  return { ok: true, message: d.decision === "publish" ? "Publicada." : d.decision === "reject" ? "Rechazada." : "Cambios guardados." };
}

export async function publishWeeklyAction(_: AdminState, form: FormData): Promise<AdminState> {
  const ctx = await editor();
  if (!ctx) return { ok: false, message: "No autorizado." };
  const id = z.uuid().safeParse(form.get("id"));
  const intro = z.string().trim().min(20).max(2000).safeParse(form.get("intro"));
  if (!id.success || !intro.success) return { ok: false, message: "Datos no válidos (la introducción necesita al menos 20 caracteres)." };
  const { error } = await ctx.db.from("weekly_issues").update({ intro_es: intro.data, status: "published", published_at: new Date().toISOString() }).eq("id", id.data);
  if (error) return { ok: false, message: "No se pudo publicar." };
  updateTag("weekly");
  revalidateTag("news", "max");
  return { ok: true, message: "Weekly publicado." };
}
