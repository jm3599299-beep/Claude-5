import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/container";
import { mainNav } from "@/lib/site";
import { SearchBar } from "./search-bar";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/80 backdrop-blur-xl">
      <Container className="relative flex h-16 items-center gap-4">
        <Logo />
        <nav aria-label="Principal" className="ml-4 hidden md:block">
          <ul className="flex items-center gap-1">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="rounded-lg px-3 py-2 text-sm font-medium text-fg-muted transition hover:bg-surface-2 hover:text-fg">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto hidden w-64 lg:block">
          <SearchBar />
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <ThemeToggle />
          <MobileNav items={mainNav} />
        </div>
      </Container>
    </header>
  );
}
