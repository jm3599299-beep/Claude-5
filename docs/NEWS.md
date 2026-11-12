# Noticias semanales y LaptopVerse Weekly

## Flujo (`npm run news:weekly`, GitHub Actions cada lunes 09:17 UTC)
1. Lee los feeds activos de `news_feeds` (RSS/Atom; un reintento ante errores de red).
2. Descarta entradas sin fecha válida, con fecha futura o fuera de la ventana (7 días por defecto).
3. Filtra por relevancia (términos de laptops, procesadores y GPU móviles) y **excluye ofertas comerciales**.
4. Deduplica: URL canónica (sin parámetros de seguimiento) y títulos casi idénticos entre fuentes (Jaccard ≥ 0,5).
   Una misma historia en otra fuente se registra como **corroboración**.
5. Clasifica por categoría (el título decide; el extracto solo aporta temas) y etiqueta: **Oficial** (solo fuentes
   oficiales; lo impone la base de datos), **Análisis**, **Rumor** o **Filtración**.
6. Resume en español con Claude (`claude-opus-5-5`, salida estructurada, solo con el texto de la fuente).
   Cada cifra del resumen se busca en el texto original: si no aparece, la noticia va a revisión.
7. Guarda en `news_articles`. Publicación automática **solo** si el feed lo permite (`auto_publish`), el resumen es
   válido, no es rumor/filtración y la fuente es oficial o está corroborada. Todo lo demás queda **pendiente**.
8. Arma el Weekly de la semana anterior (lunes–domingo, UTC) con secciones: lanzamientos, procesadores, GPU,
   laptops destacadas, tecnologías, fabricantes y anuncios a seguir. Con menos de 3 noticias se publica como
   **semana tranquila** (sin relleno). Queda pendiente de aprobación salvo `NEWS_AUTO_PUBLISH_WEEKLY=true`.
9. Registra la ejecución en `sync_runs` y revalida la caché (`news`, `weekly`).

## Fuentes configuradas (verificadas el 2026-11-12)
Oficiales (publicación automática si pasan las verificaciones): AMD, NVIDIA, Apple Newsroom, Lenovo StoryHub,
Windows Blog. Revisión editorial: Dell Blog, The Verge (laptops), Notebookcheck, Tom's Hardware.
Sin feed accesible hoy: Intel Newsroom (403), Qualcomm, ASUS y HP (sin feed en la ruta estándar).

## Imágenes
Solo con autorización explícita (`news_feeds.images_authorized`). Por defecto **no** se guardan imágenes de las
fuentes (la base de datos descarta `image_url` sin autorización); se muestra una ilustración propia por categoría.

## Panel editorial (`/admin/noticias`, rol editor o admin)
Revisar, corregir (título, resumen, categoría, etiqueta), aprobar, rechazar; aprobar el Weekly; ver las últimas
ejecuciones. Para nombrar editores: `update profiles set role = 'editor' where id = '<uuid>';` en el editor SQL.

## Claves
`ANTHROPIC_API_KEY` (secreto de GitHub). Sin clave, todo queda pendiente de resumen editorial.

## Pruebas
`src/lib/news/news.test.ts`: lectura de feeds, relevancia, categorías (incluidas regresiones con títulos reales),
ofertas, etiquetas, deduplicación, fechas, política de publicación, semana ISO y verificación de cifras.
