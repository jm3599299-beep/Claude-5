import type { Metadata } from "next";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Normas de la comunidad",
  description: "Cómo funcionan las reseñas, comentarios y la moderación en LaptopVerse.",
  alternates: { canonical: "/normas" },
};

const rules = [
  ["Experiencias reales", "Opina solo sobre laptops que hayas usado. Las reseñas falsas, pagadas o copiadas se eliminan y la cuenta puede ser suspendida."],
  ["Una reseña por modelo", "Puedes editar la tuya en cualquier momento. Indica la configuración y cuánto tiempo la usas: ayuda a los demás."],
  ["Opinión ≠ prueba profesional", "Las reseñas de usuarios se muestran separadas de las pruebas profesionales verificadas por el equipo editorial."],
  ["Moderación", "Las reseñas de cuentas con menos de 24 horas se revisan antes de publicarse. Las fotos de usuarios siempre se revisan. El contenido con 3 reportes se oculta hasta su revisión."],
  ["Sin spam", "Máximo 2 enlaces por texto, sin publicidad, sin texto en mayúsculas ni repeticiones. Hay límites de publicación por hora."],
  ["Respeto", "Nada de insultos, acoso ni datos personales de terceros. Reporta lo que incumpla estas normas."],
  ["Fotos propias", "Sube solo fotos tuyas de tu laptop (JPEG, PNG o WebP, máx. 5 MB). No subas imágenes con datos personales visibles."],
] as const;

export default function RulesPage() {
  return (
    <Container className="max-w-3xl py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Normas de la comunidad</h1>
      <dl className="mt-8 space-y-4">
        {rules.map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-border bg-surface p-5">
            <dt className="font-display text-lg font-semibold">{t}</dt>
            <dd className="mt-1 text-fg-muted">{d}</dd>
          </div>
        ))}
      </dl>
    </Container>
  );
}
