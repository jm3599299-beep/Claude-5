import { CheckCircle2, ChevronDown, CircleAlert, CircleHelp, Sparkles } from "lucide-react";
import type { Variant } from "@/lib/data/types";
import { LEVEL_LABEL, evaluateAudience, type Level } from "@/lib/audience";

const levelStyle: Record<Level, { badge: string; bar: string; width: string }> = {
  excelente: { badge: "bg-success/12 text-success", bar: "bg-success", width: "w-full" },
  buena: { badge: "bg-primary-soft text-primary", bar: "bg-primary", width: "w-3/4" },
  regular: { badge: "bg-warning/12 text-warning", bar: "bg-warning", width: "w-1/2" },
  "no-recomendada": { badge: "bg-danger/12 text-danger", bar: "bg-danger", width: "w-1/4" },
  insuficiente: { badge: "bg-surface-2 text-fg-muted", bar: "bg-border", width: "w-0" },
};

/** «¿Para quién es esta laptop?» — generated from this configuration's verified specs. */
export function AudienceSection({ variant, headingId }: { variant: Variant; headingId: string }) {
  const report = evaluateAudience(variant);
  if (report.profiles.every((p) => p.level === "insuficiente")) {
    return (
      <section aria-labelledby={headingId} className="rounded-2xl border border-dashed border-border bg-surface p-5">
        <h3 id={headingId} className="font-display text-lg font-semibold">¿Para quién es esta laptop?</h3>
        <p className="mt-1 text-sm text-fg-muted">Aún no hay suficientes especificaciones verificadas de esta configuración para recomendarla con rigor.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id={headingId} className="font-display text-xl font-semibold">¿Para quién es esta laptop?</h3>
          <p className="mt-1 max-w-3xl text-xs text-fg-muted">
            Estimación automática a partir de las especificaciones verificadas de esta configuración
            {report.basis.cpu ? ` (${report.basis.cpu}${report.basis.gpu ? `, ${report.basis.gpu}` : ""})` : ""}. No es una prueba de rendimiento.
          </p>
        </div>
        {report.bestFor.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="font-medium">Ideal para:</span>
            {report.bestFor.slice(0, 4).map((p) => (
              <span key={p.id} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                {p.title}
              </span>
            ))}
          </p>
        )}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {report.profiles.map((p) => {
          const st = levelStyle[p.level];
          const negative = p.level === "no-recomendada";
          return (
            <li key={p.id} className="flex flex-col rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/40">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold leading-tight">
                  <span aria-hidden="true" className="mr-1.5 text-lg">
                    {p.icon}
                  </span>
                  {p.title}
                </p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.badge}`}>{LEVEL_LABEL[p.level]}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <div className={`h-full rounded-full ${st.bar} ${st.width}`} />
              </div>
              <p className="mt-3 text-sm text-fg-muted">{p.summary}</p>

              {(p.can.length > 0 || p.limits.length > 0 || p.missing.length > 0) && (
                <details className="group mt-3 text-sm">
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary">
                    Ver detalles <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  {p.can.length > 0 && (
                    <>
                      <p className="mt-2 text-xs font-semibold">{negative ? "Como mucho:" : "Puede:"}</p>
                      <ul className="mt-1 space-y-1">
                        {p.can.map((c) => (
                          <li key={c} className="flex gap-1.5 text-xs">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {p.limits.length > 0 && (
                    <>
                      <p className="mt-2 text-xs font-semibold">Limitaciones:</p>
                      <ul className="mt-1 space-y-1">
                        {p.limits.map((c) => (
                          <li key={c} className="flex gap-1.5 text-xs">
                            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {p.missing.length > 0 && (
                    <p className="mt-2 flex gap-1.5 text-[11px] text-fg-muted">
                      <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Sin datos verificados de: {p.missing.join(", ")}. No se han supuesto.
                    </p>
                  )}
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
