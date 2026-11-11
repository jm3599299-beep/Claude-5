import { Database, Inbox } from "lucide-react";

/**
 * Honest empty state. LaptopVerse never fills sections with fictitious data:
 * when no verified records exist, it says so.
 */
export function EmptyState({
  title,
  description,
  reason,
}: {
  title: string;
  description?: string;
  reason?: "not_configured" | "error" | "empty";
}) {
  const Icon = reason === "not_configured" ? Database : Inbox;
  const detail =
    reason === "not_configured"
      ? "La base de datos aún no está conectada. Configura Supabase (ver README) para ver contenido."
      : reason === "error"
        ? "No se pudo cargar esta sección en este momento."
        : description;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-10 text-center">
      <Icon className="mb-3 h-7 w-7 text-fg-muted" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      {detail && <p className="mt-1 max-w-md text-sm text-fg-muted">{detail}</p>}
    </div>
  );
}
