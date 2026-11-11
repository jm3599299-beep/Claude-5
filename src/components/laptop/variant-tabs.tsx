"use client";

import { useEffect, useId, useState } from "react";

export interface VariantTab {
  id: string;
  key: string; // URL-friendly identifier (SKU or id)
  label: string;
  sublabel?: string;
  content: React.ReactNode;
}

/**
 * Accessible tabs for model variants. Selection syncs to `?variante=` so a
 * specific configuration can be shared by link without making the page dynamic.
 */
export function VariantTabs({ tabs }: { tabs: VariantTab[] }) {
  const [active, setActive] = useState(0);
  const base = useId();

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("variante");
    const idx = key ? tabs.findIndex((t) => t.key === key) : -1;
    if (idx > 0) setActive(idx); // eslint-disable-line react-hooks/set-state-in-effect -- sync from URL after hydration
  }, [tabs]);

  function select(i: number) {
    setActive(i);
    const url = new URL(window.location.href);
    if (i === 0) url.searchParams.delete("variante");
    else url.searchParams.set("variante", tabs[i].key);
    window.history.replaceState(null, "", url);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = (active + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    select(next);
    document.getElementById(`${base}-tab-${next}`)?.focus();
  }

  if (tabs.length === 1) return <>{tabs[0].content}</>;

  return (
    <div>
      <div role="tablist" aria-label="Variantes del modelo" onKeyDown={onKey} className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            id={`${base}-tab-${i}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls={`${base}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => select(i)}
            className={`shrink-0 rounded-xl border px-4 py-2 text-left text-sm transition ${
              i === active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-fg-muted hover:border-primary/60"
            }`}
          >
            <span className="block font-semibold">{t.label}</span>
            {t.sublabel && <span className="block text-xs opacity-80">{t.sublabel}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} id={`${base}-panel-${i}`} role="tabpanel" aria-labelledby={`${base}-tab-${i}`} hidden={i !== active}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
