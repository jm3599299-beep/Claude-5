import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "email_change", "magiclink"];

/** E-mail confirmation link target (Supabase PKCE "code" or "token_hash" flows). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextRaw = searchParams.get("next") ?? "/cuenta";
  const next = /^\/(?!\/)/.test(nextRaw) ? nextRaw : "/cuenta";
  const db = await getServerClient();
  // PKCE flow (default in @supabase/ssr): the e-mail link returns with ?code=…
  const code = searchParams.get("code");
  if (db && code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  // token_hash flow (custom e-mail template pointing to /auth/confirm?token_hash=…&type=…)
  if (db && tokenHash && type && TYPES.includes(type)) {
    const { error } = await db.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/entrar?error=enlace", request.url));
}
