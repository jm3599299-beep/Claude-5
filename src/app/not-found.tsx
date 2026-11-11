import Link from "next/link";
import { Container } from "@/components/ui/container";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center py-24 text-center">
      <LogoMark className="h-16 w-16" />
      <h1 className="mt-6 font-display text-3xl font-semibold">Página no encontrada</h1>
      <p className="mt-2 text-fg-muted">Esta página no existe en LaptopVerse o fue movida.</p>
      <Link href="/" className="mt-6 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-fg">
        Volver al inicio
      </Link>
    </Container>
  );
}
