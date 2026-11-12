import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/actions/auth";
import { Container } from "@/components/ui/container";
import { ProfileForm } from "@/components/auth/profile-form";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

const statusLabel: Record<string, string> = { visible: "Publicada", pending: "En moderación", hidden: "Oculta por moderación", removed: "Retirada" };

async function Account() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/cuenta");
  const db = (await getServerClient())!;
  type Rev = { id: string; title: string; rating: number; status: string; created_at: string; model: { slug: string; name: string } | null };
  type Fav = { created_at: string; model: { slug: string; name: string; brand: { name: string } | null } | null };
  const [{ data: reviews }, { data: favorites }] = await Promise.all([
    db.from("reviews").select("id, title, rating, status, created_at, model:models(slug, name)").eq("user_id", user.id).order("created_at", { ascending: false }).returns<Rev[]>(),
    db.from("favorites").select("created_at, model:models(slug, name, brand:brands(name))").eq("user_id", user.id).order("created_at", { ascending: false }).returns<Fav[]>(),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-semibold">Perfil</h2>
        <p className="text-sm text-fg-muted">{user.email}</p>
        <ProfileForm displayName={user.displayName ?? ""} username={user.username ?? ""} />
        <form action={signOutAction}>
          <button className="text-sm font-medium text-danger hover:underline">Cerrar sesión</button>
        </form>
      </section>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Laptops guardadas</h2>
          {favorites?.length ? (
            <ul className="divide-y divide-border">
              {favorites.map((f) =>
                f.model ? (
                  <li key={f.model.slug} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/laptops/${f.model.slug}`} className="font-medium hover:text-primary">{f.model.brand?.name} {f.model.name}</Link>
                    <span className="text-xs text-fg-muted">{formatDate(f.created_at)}</span>
                  </li>
                ) : null,
              )}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">Aún no guardaste laptops. Usa «Guardar» en cualquier ficha.</p>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Mis reseñas</h2>
          {reviews?.length ? (
            <ul className="divide-y divide-border">
              {reviews.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {r.model ? <Link href={`/laptops/${r.model.slug}#comunidad`} className="font-medium hover:text-primary">{r.model.name}</Link> : "—"} · {r.title} ({r.rating}/5)
                  </span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{statusLabel[r.status] ?? r.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">Todavía no publicaste reseñas.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Container className="py-12">
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight">Mi cuenta</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-surface-2" aria-busy="true" />}>
        <Account />
      </Suspense>
    </Container>
  );
}
