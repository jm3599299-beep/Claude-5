import type { CommercialStatus, NewsLabel } from "@/lib/data/types";

const tones = {
  neutral: "bg-surface-2 text-fg-muted",
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent-soft text-accent",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/12 text-danger",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>
  );
}

const statusMap: Record<CommercialStatus, { label: string; tone: keyof typeof tones }> = {
  current: { label: "A la venta (verificado)", tone: "success" },
  in_stores: { label: "Disponible en tiendas", tone: "accent" },
  legacy: { label: "Modelo antiguo", tone: "neutral" },
  discontinued: { label: "Descatalogado", tone: "danger" },
  unverified: { label: "Estado sin verificar", tone: "warning" },
};

export function StatusBadge({ status }: { status: CommercialStatus }) {
  const s = statusMap[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const labelMap: Record<NewsLabel, { label: string; tone: keyof typeof tones }> = {
  official: { label: "Oficial", tone: "success" },
  analysis: { label: "Análisis", tone: "primary" },
  rumor: { label: "Rumor", tone: "warning" },
  leak: { label: "Filtración", tone: "danger" },
};

export function NewsLabelBadge({ label }: { label: NewsLabel }) {
  const s = labelMap[label];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
