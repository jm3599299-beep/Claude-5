"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { MAX_COMPARE, compareHref } from "@/lib/compare";

interface Result {
  slug: string;
  name: string;
  brand: { name: string } | null;
  variants: { variant_key: string; name: string }[];
}

/** Search a model and add one of its configurations to the comparison (URL-driven). */
export function ComparePicker({ current }: { current: { slug: string; key: string }[] }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const full = current.length >= MAX_COMPARE;

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/buscar?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const body = (await r.json()) as { results: Result[] };
        setResults(body.results ?? []);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const add = (slug: string, key: string) => {
    if (full || current.some((c) => c.slug === slug && c.key === key)) return;
    router.push(compareHref([...current, { slug, key }]), { scroll: false });
    setQ("");
    setResults([]);
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {full ? `Máximo ${MAX_COMPARE} laptops` : "Añadir una laptop a la comparación"}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        <input
          id={id}
          type="search"
          value={q}
          disabled={full}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim().length < 2) setResults([]);
          }}
          placeholder="Escribe un modelo, p. ej. «MacBook» o «ThinkBook»"
          className="h-10 w-full rounded-xl border border-border bg-bg pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          autoComplete="off"
        />
      </div>
      <div aria-live="polite" className="mt-2">
        {loading && <p className="text-xs text-fg-muted">Buscando…</p>}
        {!loading && q.trim().length >= 2 && results.length === 0 && <p className="text-xs text-fg-muted">Sin resultados publicados.</p>}
        {results.length > 0 && (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {results.map((m) => (
              <li key={m.slug} className="rounded-xl border border-border p-2">
                <p className="text-sm font-semibold">
                  {m.brand?.name} {m.name}
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {m.variants.map((v) => {
                    const added = current.some((c) => c.slug === m.slug && c.key === v.variant_key);
                    return (
                      <li key={v.variant_key}>
                        <button
                          type="button"
                          disabled={added || full}
                          onClick={() => add(m.slug, v.variant_key)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:border-primary hover:text-primary disabled:opacity-50"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" /> {v.name}
                          {added && " (añadida)"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
