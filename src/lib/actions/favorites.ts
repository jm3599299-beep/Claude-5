"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

const input = z.object({ modelId: z.uuid(), save: z.boolean() });

export async function toggleFavoriteAction(modelId: string, save: boolean): Promise<{ ok: boolean; saved: boolean; message?: string }> {
  const parsed = input.safeParse({ modelId, save });
  if (!parsed.success) return { ok: false, saved: !save, message: "Solicitud no válida" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, saved: !save, message: "Inicia sesión para guardar laptops." };
  const db = (await getServerClient())!;
  const { error } = save
    ? await db.from("favorites").upsert({ user_id: user.id, model_id: modelId }, { onConflict: "user_id,model_id", ignoreDuplicates: true })
    : await db.from("favorites").delete().eq("user_id", user.id).eq("model_id", modelId);
  if (error) return { ok: false, saved: !save, message: "No se pudo actualizar." };
  updateTag(`favorites:${user.id}`);
  return { ok: true, saved: save };
}
