"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>
      {open && (
        <nav id="mobile-menu" className="absolute inset-x-0 top-full border-b border-border bg-surface p-4 shadow-lg">
          <ul className="flex flex-col gap-1">
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 font-medium hover:bg-surface-2">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
