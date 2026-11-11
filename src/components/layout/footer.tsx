import Link from "next/link";
import { cacheLife } from "next/cache";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/container";
import { mainNav, site, useCases } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-fg-muted">{site.tagline}. Datos con fuente, precios reales y opiniones verificables.</p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Explorar</h2>
          <ul className="space-y-2 text-sm text-fg-muted">
            {mainNav.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="hover:text-fg">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Por uso</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm text-fg-muted">
            {useCases.map((u) => (
              <li key={u.slug}>
                <Link href={`/laptops?uso=${u.slug}`} className="hover:text-fg">
                  {u.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Transparencia</h2>
          <ul className="space-y-2 text-sm text-fg-muted">
            <li>
              <Link href="/metodologia" className="hover:text-fg">
                Metodología y fuentes
              </Link>
            </li>
          </ul>
          <p className="mt-4 text-xs text-fg-muted">
            Las marcas y nombres de producto pertenecen a sus respectivos propietarios. Los precios convertidos son
            orientativos y no constituyen ofertas comerciales.
          </p>
        </div>
      </Container>
      <div className="border-t border-border py-4 text-center text-xs text-fg-muted">
        © <CurrentYear /> {site.name}
      </div>
    </footer>
  );
}

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getUTCFullYear()}</>;
}
