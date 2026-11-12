# Hoja de ruta

- [x] **Fase 1** — Arquitectura, identidad visual (logo, paleta, tipografías, claro/oscuro), layout, esquema SQL + RLS, home.
- [x] **Fase 2** — Navegación, home, catálogo con filtros, marcas, familias (`/marcas/[marca]/[familia]`) y ficha técnica
  `/laptops/[slug]`: variantes con pestañas compartibles (`?variante=SKU`), verificación por campo, diferencias entre
  variantes, galería con ampliación y procedencia, análisis editorial, JSON-LD Product/BreadcrumbList y sitemap completo.
- [x] **Fase 3** — Importador de catálogo JSON (`npm run catalog:import`): validación estricta, transacción por archivo,
  idempotente, procedencia por campo, `sync_runs`, revalidación de caché (`/api/revalidate`), JSON Schema para editores,
  workflow que importa al fusionar en `main`. Primer lote real: MacBook Air 13"/15" M5 (6 configuraciones,
  verificado en apple.com). Adaptador Lenovo PSREF por MTM (`psref:convert`, exportaciones descargadas a mano)
  con 1 MTM de prueba. Pendiente: MacBook Pro, más marcas y MTM, y edición desde el panel (Fase 8).
  Ver `docs/DATA_SOURCES.md`.
- [x] **Fase 4** — Imágenes: base de derechos obligatoria (BD + validador), hosts autorizados, `next/image` (AVIF/WebP,
  tamaños adaptativos, carga diferida), atribución CC en galería, verificador técnico (`images:check`), asistente de
  Wikimedia Commons (`images:commons`). Pendiente: primeras fotos reales con licencia (Apple no permite reutilizar las
  suyas sin permiso; Commons limitado desde este entorno) y subida a Storage desde el panel (Fase 8).
- [ ] **Fase 5** — Precios USD/DOP/MXN, API de tipos de cambio, comparador 2–4 con enlaces compartibles.
- [ ] **Fase 6** — Auth, comunidad, reseñas, moderación.
- [ ] **Fase 7** — Ingesta semanal de noticias (GitHub Actions cron + RSS), LaptopVerse Weekly, revisión editorial.
- [ ] **Fase 8** — Panel administrativo, SEO avanzado (JSON-LD, OG por página), endurecimiento de seguridad.
- [ ] **Fase 9** — Pruebas E2E completas.
