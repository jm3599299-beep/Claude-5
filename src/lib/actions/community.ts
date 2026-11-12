"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { MAX_PHOTO_BYTES, commentSchema, firstError, reportSchema, reviewSchema, sniffImage } from "@/lib/community/validation";

export interface ActionState {
  ok: boolean;
  message: string | null;
}

type Db = NonNullable<Awaited<ReturnType<typeof getServerClient>>>;

/** Session + ban check + DB-backed rate limit (per user and action). */
async function guard(action: string, max: number, windowSeconds: number): Promise<{ user: CurrentUser; db: Db } | ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Inicia sesión para participar." };
  if (user.isBanned) return { ok: false, message: "Tu cuenta está suspendida." };
  const db = (await getServerClient())!;
  const { data: allowed, error } = await db.rpc("check_rate_limit", { p_action: action, p_max: max, p_window_seconds: windowSeconds });
  if (error) return { ok: false, message: "No se pudo verificar el límite de publicaciones." };
  if (!allowed) return { ok: false, message: "Has alcanzado el límite de publicaciones. Inténtalo más tarde." };
  return { user, db };
}
const isState = (x: unknown): x is ActionState => typeof x === "object" && x !== null && "message" in x;

function refresh(modelId: string) {
  updateTag(`community:${modelId}`);
  updateTag("reviews");
}

export async function submitReviewAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = reviewSchema.safeParse({
    modelId: form.get("modelId"),
    modelSlug: form.get("modelSlug"),
    variantId: form.get("variantId") ?? "",
    rating: form.get("rating"),
    title: form.get("title"),
    body: form.get("body"),
    tags: form.getAll("tags"),
    usageMonths: form.get("usageMonths") ?? "",
    tempC: form.get("tempC") ?? "",
    batteryH: form.get("batteryH") ?? "",
    website: form.get("website") ?? "",
  });
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const g = await guard("review", 3, 3600);
  if (isState(g)) return g;
  const r = parsed.data;
  const row = {
    model_id: r.modelId,
    variant_id: r.variantId,
    user_id: g.user.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    experience_tags: r.tags,
    usage_months: r.usageMonths,
    observed_temp_c: r.tempC,
    observed_battery_h: r.batteryH,
  };
  // One review per user and model: editing replaces the user's own review.
  const { data: existing } = await g.db.from("reviews").select("id").eq("model_id", r.modelId).eq("user_id", g.user.id).maybeSingle();
  const { error } = existing
    ? await g.db.from("reviews").update(row).eq("id", existing.id)
    : await g.db.from("reviews").insert(row);
  if (error) return { ok: false, message: "No se pudo guardar la reseña." };
  refresh(r.modelId);
  const { data: saved } = await g.db.from("reviews").select("status").eq("model_id", r.modelId).eq("user_id", g.user.id).maybeSingle();
  return {
    ok: true,
    message: saved?.status === "pending" ? "¡Gracias! Tu reseña se publicará tras revisarla (las cuentas nuevas pasan por moderación)." : existing ? "Reseña actualizada." : "¡Gracias! Tu reseña ya está publicada.",
  };
}

export async function submitCommentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = commentSchema.safeParse({
    modelId: form.get("modelId"),
    modelSlug: form.get("modelSlug"),
    reviewId: form.get("reviewId"),
    parentId: form.get("parentId") ?? "",
    body: form.get("body"),
    website: form.get("website") ?? "",
  });
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const g = await guard("comment", 10, 600);
  if (isState(g)) return g;
  const c = parsed.data;
  // Duplicate protection: same text by the same user in the last 24 h.
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await g.db.from("comments").select("id", { count: "exact", head: true }).eq("user_id", g.user.id).eq("body", c.body).gte("created_at", since);
  if (count) return { ok: false, message: "Ya publicaste ese mismo comentario." };
  const { error } = await g.db.from("comments").insert({ model_id: c.modelId, review_id: c.reviewId, parent_id: c.parentId, user_id: g.user.id, body: c.body });
  if (error) return { ok: false, message: "No se pudo publicar el comentario." };
  refresh(c.modelId);
  return { ok: true, message: "Comentario publicado." };
}

/** Toggles the current user's like; the server decides (the cached public list has no per-user state). */
export async function toggleLikeAction(targetType: "review" | "comment", targetId: string, modelId: string): Promise<ActionState & { liked?: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(targetId) || !/^[0-9a-f-]{36}$/i.test(modelId) || !["review", "comment"].includes(targetType))
    return { ok: false, message: "Solicitud no válida" };
  const g = await guard("like", 120, 3600);
  if (isState(g)) return g;
  const { count } = await g.db.from("likes").select("user_id", { count: "exact", head: true }).eq("user_id", g.user.id).eq("target_type", targetType).eq("target_id", targetId);
  const like = !count;
  const { error } = like
    ? await g.db.from("likes").insert({ user_id: g.user.id, target_type: targetType, target_id: targetId })
    : await g.db.from("likes").delete().eq("user_id", g.user.id).eq("target_type", targetType).eq("target_id", targetId);
  if (error) return { ok: false, message: /propio/.test(error.message) ? "No puedes dar me gusta a tu propio contenido." : "No se pudo registrar." };
  refresh(modelId);
  return { ok: true, message: null, liked: like };
}

export async function reportAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = reportSchema.safeParse({
    targetType: form.get("targetType"),
    targetId: form.get("targetId"),
    reason: form.get("reason"),
    details: form.get("details") ?? "",
    modelSlug: form.get("modelSlug"),
  });
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const g = await guard("report", 20, 86400);
  if (isState(g)) return g;
  const p = parsed.data;
  const { error } = await g.db.from("reports").insert({ reporter_id: g.user.id, target_type: p.targetType, target_id: p.targetId, reason: p.reason, details: p.details || null });
  if (error) {
    if (error.code === "23505") return { ok: true, message: "Ya habías reportado este contenido." };
    return { ok: false, message: /propio/.test(error.message) ? "No puedes reportar tu propio contenido." : "No se pudo enviar el reporte." };
  }
  updateTag("reviews");
  return { ok: true, message: "Gracias. El equipo de moderación lo revisará." };
}

export async function uploadPhotoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const modelId = String(form.get("modelId") ?? "");
  const caption = String(form.get("caption") ?? "").trim().slice(0, 300);
  const file = form.get("photo");
  if (!/^[0-9a-f-]{36}$/i.test(modelId)) return { ok: false, message: "Solicitud no válida" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Elige una foto." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, message: "La foto supera 5 MB." };
  if (form.get("own") !== "on") return { ok: false, message: "Confirma que la foto es tuya." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { ok: false, message: "Formato no admitido: usa JPEG, PNG o WebP." };
  const g = await guard("photo", 10, 86400);
  if (isState(g)) return g;
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[type];
  const path = `${g.user.id}/${randomUUID()}.${ext}`; // storage policy: users may only write in their own folder
  const up = await g.db.storage.from("user-photos").upload(path, bytes, { contentType: type, upsert: false });
  if (up.error) return { ok: false, message: "No se pudo subir la foto." };
  const { error } = await g.db.from("user_photos").insert({ model_id: modelId, user_id: g.user.id, storage_path: path, caption: caption || null });
  if (error) {
    await g.db.storage.from("user-photos").remove([path]);
    return { ok: false, message: "No se pudo registrar la foto." };
  }
  return { ok: true, message: "Foto recibida. Se mostrará cuando el equipo de moderación la apruebe." };
}
