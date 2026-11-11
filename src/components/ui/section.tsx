import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "./container";

export function Section({
  id,
  title,
  eyebrow,
  description,
  href,
  hrefLabel = "Ver todo",
  children,
}: {
  id?: string;
  title: string;
  eyebrow?: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="py-12 sm:py-16">
      <Container>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>}
            <h2 id={id ? `${id}-title` : undefined} className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h2>
            {description && <p className="mt-2 max-w-2xl text-fg-muted">{description}</p>}
          </div>
          {href && (
            <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {hrefLabel} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        {children}
      </Container>
    </section>
  );
}
