import Link from "next/link";
import { Container } from "@/components/ui/container";
import { LogoMark } from "@/components/brand/logo";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <Container className="flex justify-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-xl shadow-primary/5">
        <LogoMark className="h-10 w-10" />
        <h1 className="mt-4 font-display text-2xl font-semibold">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-fg-muted">{subtitle}</p>
        {children}
        <p className="mt-6 text-center text-sm text-fg-muted">{footer}</p>
      </div>
    </Container>
  );
}

export const authLink = (href: string, label: string) => (
  <Link href={href} className="font-medium text-primary hover:underline">
    {label}
  </Link>
);
