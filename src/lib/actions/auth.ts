"use server";

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { credentialsSchema, firstError, profileSchema } from "@/lib/community/validation";
import { getCurrentUser } from "@/lib/auth";
import { site } from "@/lib/site";

export interface FormState {
  ok: boolean;
  message: string | null;
}

/** Only allow same-site relative redirects (prevents open redirects). */
function safeNext(raw: FormDataEntryValue | null): string {
  const s = typeof raw === "string" ? raw : "";
  return /^\/(?!\/)[\w\-/?=&%.:]*$/.test(s) ? s : "/cuenta";
}

const NOT_CONFIGURED: FormState = { ok: false, message: "Las cuentas no están disponibles: la base de datos no está configurada." };

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse({ email: form.get("email"), password: form.get("password"), website: form.get("website") ?? "" });
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const db = await getServerClient();
  if (!db) return NOT_CONFIGURED;
  const { error } = await db.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  // Generic message: do not reveal whether the e-mail exists.
  if (error) return { ok: false, message: error.status === 429 ? "Demasiados intentos. Espera unos minutos." : "Correo o contraseña incorrectos, o la cuenta aún no está confirmada." };
  redirect(safeNext(form.get("next")));
}

export async function signUpAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse({ email: form.get("email"), password: form.get("password"), website: form.get("website") ?? "" });
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  if (form.get("accept") !== "on") return { ok: false, message: "Debes aceptar las normas de la comunidad." };
  const db = await getServerClient();
  if (!db) return NOT_CONFIGURED;
  const { error } = await db.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${site.url}/auth/confirm?next=/cuenta` },
  });
  if (error && error.status === 429) return { ok: false, message: "Demasiados intentos. Espera unos minutos." };
  if (error && /password/i.test(error.message)) return { ok: false, message: "La contraseña no cumple los requisitos de seguridad." };
  // Same response whether or not the address was already registered (no account enumeration).
  return { ok: true, message: "Si el correo es válido, te enviamos un enlace de confirmación. Revisa tu bandeja de entrada." };
}

export async function signOutAction() {
  const db = await getServerClient();
  await db?.auth.signOut();
  redirect("/");
}

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Inicia sesión de nuevo." };
  const parsed = profileSchema.safeParse({ displayName: form.get("displayName"), username: form.get("username") ?? "" });
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const db = (await getServerClient())!;
  const { error } = await db.from("profiles").update({ display_name: parsed.data.displayName, username: parsed.data.username }).eq("id", user.id);
  if (error) return { ok: false, message: error.code === "23505" ? "Ese nombre de usuario ya está en uso." : "No se pudo guardar el perfil." };
  return { ok: true, message: "Perfil actualizado." };
}
