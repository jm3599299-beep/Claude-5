import { CheckCircle2, CircleHelp, CircleDashed } from "lucide-react";
import type { Variant } from "@/lib/data/types";
import { specGroups, verificationFor, verificationStats, type Verification } from "@/lib/specs";
import { formatDate } from "@/lib/format";

function Mark({ state, sourceName, sourceUrl, date }: { state: Verification; sourceName?: string; sourceUrl?: string | null; date?: string | null }) {
  if (state === "verified") {
    const label = `Verificado${sourceName ? ` · ${sourceName}` : ""}${date ? ` · ${formatDate(date)}` : ""}`;
    const icon = <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />;
    return sourceUrl ? (
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" title={label} aria-label={label} className="shrink-0">
        {icon}
      </a>
    ) : (
      <span title={label} aria-label={label} className="shrink-0">
        {icon}
      </span>
    );
  }
  if (state === "unverified")
    return (
      <span title="Dato sin verificar" aria-label="Dato sin verificar" className="shrink-0">
        <CircleHelp className="h-4 w-4 text-warning" aria-hidden="true" />
      </span>
    );
  return (
    <span title="Dato desconocido" aria-label="Dato desconocido" className="shrink-0">
      <CircleDashed className="h-4 w-4 text-fg-muted/60" aria-hidden="true" />
    </span>
  );
}

export function VerificationLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-muted">
      <li className="inline-flex items-center gap-1.5"><Mark state="verified" /> Verificado con fuente</li>
      <li className="inline-flex items-center gap-1.5"><Mark state="unverified" /> Sin verificar</li>
      <li className="inline-flex items-center gap-1.5"><Mark state="unknown" /> Desconocido</li>
    </ul>
  );
}

export function SpecTable({ variant }: { variant: Variant }) {
  const stats = verificationStats(variant);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <VerificationLegend />
        <p className="text-xs text-fg-muted">
          {stats.verified} de {stats.total} datos verificados · {stats.total - stats.known} desconocidos
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {specGroups.map((g) => (
          <section key={g.id} aria-labelledby={`spec-${variant.id}-${g.id}`} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <h3 id={`spec-${variant.id}-${g.id}`} className="border-b border-border bg-surface-2/50 px-4 py-2.5 font-display font-semibold">
              {g.title}
            </h3>
            <dl className="divide-y divide-border">
              {g.rows.map((r) => {
                const value = r.value(variant);
                const { state, source } = verificationFor(variant, r.field, value);
                return (
                  <div key={r.label} className="grid grid-cols-[40%_1fr] gap-3 px-4 py-2.5 text-sm">
                    <dt className="text-fg-muted">{r.label}</dt>
                    <dd className="flex items-start justify-between gap-2">
                      <span className={value ? "" : "italic text-fg-muted/70"}>{value ?? "Desconocido"}</span>
                      <Mark state={state} sourceName={source?.source?.name} sourceUrl={source?.source_url} date={source?.verified_at} />
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
