import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Metodología y fuentes",
  description: `Cómo ${site.name} verifica especificaciones, fotografías, precios y noticias.`,
  alternates: { canonical: "/metodologia" },
};

const rules = [
  ["Especificaciones", "Cada dato se asocia a una fuente (fabricante, ficha oficial, prueba profesional). Los datos sin confirmar se muestran como «No verificado» y nunca se mezclan especificaciones de variantes distintas."],
  ["Fotografías", "Solo mostramos como «Foto oficial» imágenes del modelo y generación exactos procedentes de fabricantes o centros de prensa, con su fuente y licencia registradas. Si no existe una imagen verificable, mostramos una imagen de sustitución identificada como tal."],
  ["Estado comercial", "Un modelo solo aparece como «A la venta» cuando hay una comprobación reciente con fuente y fecha. En otro caso se indica «Estado sin verificar»."],
  ["Precios", "Distinguimos precio de lanzamiento, precio oficial y precio de tienda observado. Las conversiones a USD, DOP o MXN se calculan con tipos de cambio fechados y se etiquetan como conversión: no son ofertas comerciales."],
  ["Noticias", "Se recopilan semanalmente desde fuentes oficiales y medios especializados, se deduplican, se resumen en español sin copiar artículos y siempre enlazan al original. Se distinguen anuncios oficiales, análisis, rumores y filtraciones."],
  ["Comunidad", "Las opiniones de usuarios se separan de las pruebas profesionales. Hay moderación, límites de publicación y reportes para combatir spam y reseñas falsas."],
] as const;

export default function MethodologyPage() {
  return (
    <Container className="max-w-3xl py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Metodología y fuentes</h1>
      <p className="mt-3 text-fg-muted">
        {site.name} no publica información ficticia como si fuera real. Estas son las reglas que aplicamos.
      </p>
      <dl className="mt-8 space-y-6">
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
