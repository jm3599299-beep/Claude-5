"use client";

import { useOptimistic, useTransition, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { toggleFavoriteAction } from "@/lib/actions/favorites";

export function FavoriteButton({ modelId, initial, loggedIn, next }: { modelId: string; initial: boolean; loggedIn: boolean; next: string }) {
  const [saved, setSaved] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cls = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition";

  if (!loggedIn)
    return (
      <Link href={`/entrar?next=${encodeURIComponent(next)}`} className={`${cls} border-border hover:border-primary hover:text-primary`}>
        <Heart className="h-4 w-4" aria-hidden="true" /> Guardar
      </Link>
    );
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-pressed={optimistic}
        onClick={() =>
          start(async () => {
            setOptimistic(!optimistic);
            const r = await toggleFavoriteAction(modelId, !saved);
            setError(r.ok ? null : (r.message ?? "Error"));
            setSaved(r.saved);
          })
        }
        className={`${cls} ${optimistic ? "border-danger/40 bg-danger/10 text-danger" : "border-border hover:border-primary hover:text-primary"}`}
      >
        <Heart className={`h-4 w-4 ${optimistic ? "fill-current" : ""}`} aria-hidden="true" /> {optimistic ? "Guardada" : "Guardar"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
