import "server-only";
import { getServerClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
  displayName: string | null;
  username: string | null;
  role: "user" | "moderator" | "editor" | "admin";
  isBanned: boolean;
  createdAt: string | null;
}

/** Reads and validates the session (request-time). Returns null for visitors. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const db = await getServerClient();
  if (!db) return null;
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("display_name, username, role, is_banned, created_at").eq("id", data.user.id).maybeSingle();
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    displayName: profile?.display_name ?? null,
    username: profile?.username ?? null,
    role: (profile?.role as CurrentUser["role"]) ?? "user",
    isBanned: Boolean(profile?.is_banned),
    createdAt: profile?.created_at ?? null,
  };
}
