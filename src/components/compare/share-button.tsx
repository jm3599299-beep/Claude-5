"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "Comparación en LaptopVerse", url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user cancelled */
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition hover:opacity-90"
    >
      {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      {copied ? "Enlace copiado" : "Compartir comparación"}
    </button>
  );
}
