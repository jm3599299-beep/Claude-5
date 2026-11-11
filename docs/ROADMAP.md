# Hoja de ruta

- [x] **Fase 1** — Arquitectura, identidad visual (logo, paleta, tipografías, claro/oscuro), layout, esquema SQL + RLS, home.
- [x] **Fase 2** — Navegación, home, catálogo con filtros, marcas, familias (`/marcas/[marca]/[familia]`) y ficha técnica
  `/laptops/[slug]`: variantes con pestañas compartibles (`?variante=SKU`), verificación por campo, diferencias entre
  variantes, galería con ampliación y procedencia, análisis editorial, JSON-LD Product/BreadcrumbList y sitemap completo.
- [x] **Fase 3** — Importador de catálogo JSON (`npm run catalog:import`): validación estricta, transacción por archivo,
  idempotente, procedencia por campo, `sync_runs`, revalidación de caché (`/api/revalidate`), JSON Schema para editores,
  workflow que importa al fusionar en `main`. Primer lote real: MacBook Air 13"/15" M5 (6 configuraciones,
  verificado en apple.com). Pendiente: adaptador Lenovo PSREF a nivel MTM, MacBook Pro, más marcas, y edición desde el panel (Fase 8).
  Ver `docs/DATA_SOURCES.md`.
- [ ] **Fase 4** — Galerías de fotos oficiales con procedencia y lightbox.
- [ ] **Fase 5** — Precios USD/DOP/MXN, API de tipos de cambio, comparador 2–4 con enlaces compartibles.
- [ ] **Fase 6** — Auth, comunidad, reseñas, moderación.
- [ ] **Fase 7** — Ingesta semanal de noticias (GitHub Actions cron + RSS), LaptopVerse Weekly, revisión editorial.
- [ ] **Fase 8** — Panel administrativo, SEO avanzado (JSON-LD, OG por página), endurecimiento de seguridad.
- [ ] **Fase 9** — Pruebas E2E completas.
