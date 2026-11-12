import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/news/rules";
import { Container } from "@/components/ui/container";
import { NewsLabelBadge } from "@/components/ui/badge";
import { NewsReviewForm, WeeklyApproveForm } from "@/components/admin/news-review";
import { formatDate } from "@/lib/format";
import type { NewsLabel } from "@/lib/data/types";

export const metadata: Metadata = { title: "Revisión de noticias", robots: { index: false, follow: false } };

interface Pending {
  id: string;
  title: string;
  original_title: string | null;
  summary_es: string;
  category: string;
  label: NewsLabel;
  original_url: string;
  published_at: string;
  review_notes: string | null;
  verification: { corroborated_by?: string[]; unsupported_numbers?: string[]; summary_insufficient?: boolean | null; claims?: string[] };
  source: { name: string; is_official: boolean } | null;
}

async function Panel() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/admin/noticias");
  if (!["editor", "admin"].includes(user.role))
    return <p className="rounded-2xl border border-border bg-surface p-6 text-fg-muted">No tienes permisos para revisar noticias. Esta sección es solo para el equipo editorial.</p>;
  const db = (await getServerClient())!;
  const [{ data: pending }, { data: weekly }, { data: runs }, { data: recent }] = await Promise.all([
    db.from("news_articles").select("id, title, original_title, summary_es, category, label, original_url, published_at, review_notes, verification, source:sources(name, is_official)").eq("status", "pending").order("published_at", { ascending: false }).limit(100).returns<Pending[]>(),
    db.from("weekly_issues").select("id, slug, title, intro_es, status, is_quiet_week, week_start, sections").neq("status", "published").order("week_start", { ascending: false }).limit(5),
    db.from("sync_runs").select("job, status, started_at, stats, error").eq("job", "news_weekly").order("started_at", { ascending: false }).limit(5),
    db.from("news_articles").select("slug, title, status, reviewed_at").not("reviewed_at", "is", null).order("reviewed_at", { ascending: false }).limit(10),
  ]);
  const cats = Object.entries(CATEGORIES) as [string, string][];
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-xl font-semibold">Últimas ejecuciones</h2>
        <ul className="mt-2 text-sm text-fg-muted">
          {(runs ?? []).map((r, i) => (
            <li key={i}>{formatDate(r.started_at)} · {r.status} · {JSON.stringify(r.stats)}{r.error ? ` · ${r.error}` : ""}</li>
          ))}
        </ul>
      </section>
      {(recent ?? []).length > 0 && (
        <section aria-live="polite">
          <h2 className="font-display text-xl font-semibold">Revisadas recientemente</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {(recent ?? []).map((r) => (
              <li key={r.slug} className="flex justify-between gap-3 rounded-lg bg-surface px-3 py-1.5">
                <span className="truncate">{r.status === "published" ? <a href={`/noticias/${r.slug}`} className="text-primary hover:underline">{r.title}</a> : r.title}</span>
                <span className={r.status === "published" ? "text-success" : r.status === "rejected" ? "text-danger" : "text-fg-muted"}>
                  {r.status === "published" ? "Publicada" : r.status === "rejected" ? "Rechazada" : "Guardada"} · {formatDate(r.reviewed_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="font-display text-xl font-semibold">Weekly pendiente</h2>
        {(weekly ?? []).length ? (
          (weekly ?? []).map((w) => (
            <div key={w.id} className="mt-3 rounded-2xl border border-border bg-surface p-4">
              <p className="font-semibold">{w.title} {w.is_quiet_week && <span className="text-xs text-fg-muted">(semana tranquila)</span>}</p>
              <p className="text-xs text-fg-muted">{(w.sections as { article_ids: string[] }[]).reduce((n, s) => n + s.article_ids.length, 0)} noticias publicadas incluidas</p>
              <WeeklyApproveForm id={w.id} intro={w.intro_es ?? ""} />
            </div>
          ))
        ) : (
          <p className="text-sm text-fg-muted">No hay ediciones pendientes.</p>
        )}
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">Noticias pendientes ({pending?.length ?? 0})</h2>
        <ul className="mt-3 space-y-4">
          {(pending ?? []).map((a) => (
            <li key={a.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                <NewsLabelBadge label={a.label} /> {a.source?.name}{a.source?.is_official ? " (oficial)" : ""} · {formatDate(a.published_at)} ·{" "}
                <a href={a.original_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">original ↗</a>
              </div>
              <p className="mt-1 text-sm"><span className="text-fg-muted">Título original:</span> {a.original_title}</p>
              {(a.verification?.unsupported_numbers?.length ?? 0) > 0 && <p className="mt-1 text-xs text-danger">Cifras del resumen no encontradas en la fuente: {a.verification.unsupported_numbers!.join(", ")}</p>}
              {a.verification?.summary_insufficient && <p className="mt-1 text-xs text-warning">El modelo indicó que el extracto no basta para un resumen fiel.</p>}
              {(a.verification?.corroborated_by?.length ?? 0) > 0 && <p className="mt-1 text-xs text-success">Corroborada por: {a.verification.corroborated_by!.join(", ")}</p>}
              <NewsReviewForm a={a} categories={cats} officialSource={Boolean(a.source?.is_official)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function AdminNewsPage() {
  return (
    <Container className="py-12">
      <h1 className="mb-6 font-display text-3xl font-semibold">Revisión de noticias</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-surface-2" />}>
        <Panel />
      </Suspense>
    </Container>
  );
}
