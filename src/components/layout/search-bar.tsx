import Form from "next/form";
import { Search } from "lucide-react";

/** Global search. Progressive enhancement: works without JavaScript (GET /laptops?q=). */
export function SearchBar({ size = "md", defaultValue }: { size?: "md" | "lg"; defaultValue?: string }) {
  const lg = size === "lg";
  return (
    <Form action="/laptops" role="search" className="relative w-full">
      <label htmlFor={`q-${size}`} className="sr-only">
        Buscar laptops
      </label>
      <Search
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-fg-muted ${lg ? "left-4 h-5 w-5" : "left-3 h-4 w-4"}`}
        aria-hidden="true"
      />
      <input
        id={`q-${size}`}
        name="q"
        type="search"
        defaultValue={defaultValue}
        maxLength={120}
        placeholder={lg ? "Busca por marca, modelo, procesador o GPU…" : "Buscar laptops…"}
        className={`w-full rounded-xl border border-border bg-surface text-fg placeholder:text-fg-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          lg ? "h-14 pl-12 pr-32 text-base shadow-xl shadow-primary/5" : "h-9 pl-9 pr-3 text-sm"
        }`}
      />
      {lg && (
        <button
          type="submit"
          className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-fg transition hover:opacity-90"
        >
          Buscar
        </button>
      )}
    </Form>
  );
}
