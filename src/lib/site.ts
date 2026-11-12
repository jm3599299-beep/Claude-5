export const site = {
  name: "LaptopVerse",
  tagline: "El universo mundial de las laptops",
  description:
    "LaptopVerse es la plataforma internacional para investigar, comparar y conocer precios, noticias y experiencias reales sobre laptops de todas las marcas.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "es",
  currencies: ["USD", "DOP", "MXN"] as const,
} as const;

/**
 * Primary navigation. Only routes that are actually implemented are listed —
 * no decorative links. Later phases append: Comparar, Noticias, Weekly, Comunidad.
 */
export const mainNav: { href: string; label: string }[] = [
  { href: "/laptops", label: "Catálogo" },
  { href: "/marcas", label: "Marcas" },
  { href: "/comparar", label: "Comparar" },
];

export const useCases = [
  { slug: "gaming", label: "Gaming" },
  { slug: "estudiantes", label: "Estudiantes" },
  { slug: "programacion", label: "Programación" },
  { slug: "diseno", label: "Diseño" },
  { slug: "edicion", label: "Edición" },
  { slug: "empresariales", label: "Empresariales" },
  { slug: "economicas", label: "Económicas" },
  { slug: "alto-rendimiento", label: "Alto rendimiento" },
] as const;
