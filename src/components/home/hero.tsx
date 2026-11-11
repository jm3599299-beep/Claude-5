import Link from "next/link";
import { ShieldCheck, Coins, Users, Newspaper } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SearchBar } from "@/components/layout/search-bar";
import { useCases } from "@/lib/site";

const principles = [
  { icon: ShieldCheck, title: "Datos con fuente", text: "Cada especificación indica su procedencia. Lo no verificado se marca." },
  { icon: Coins, title: "Precios reales", text: "USD, DOP y MXN. Las conversiones se distinguen de los precios de tienda." },
  { icon: Users, title: "Comunidad real", text: "Opiniones de usuarios separadas de las pruebas profesionales." },
  { icon: Newspaper, title: "Weekly", text: "Resumen semanal verificado con enlace a cada fuente original." },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="lv-hero-bg absolute inset-0" aria-hidden="true" />
      <div className="lv-grid-bg absolute inset-0" aria-hidden="true" />
      <Container className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-3xl animate-fade-up text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-fg-muted backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> El universo mundial de las laptops
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            Investiga, compara y elige tu próxima{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">laptop</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-fg-muted">
            Fichas técnicas por variante, fotografías oficiales, precios internacionales, noticias y experiencias reales de
            usuarios de todo el mundo.
          </p>
          <div className="mx-auto mt-8 max-w-2xl">
            <SearchBar size="lg" />
          </div>
          <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Buscar por uso">
            {useCases.map((u) => (
              <li key={u.slug}>
                <Link
                  href={`/laptops?uso=${u.slug}`}
                  className="inline-block rounded-full border border-border bg-surface/80 px-3 py-1 text-sm text-fg-muted transition hover:border-primary hover:text-primary"
                >
                  {u.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <ul className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {principles.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur">
              <Icon className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm text-fg-muted">{text}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
