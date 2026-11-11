# Arquitectura de LaptopVerse

## Renderizado y caché
- Next.js 16 con **Cache Components**: las lecturas públicas (catálogo, marcas, noticias) son funciones `"use cache"`
  con `cacheLife` y `cacheTag`, por lo que se integran en el shell estático y se revalidan por etiqueta
  (`revalidateTag("models")`, etc.) cuando el panel o los jobs modifican datos.
- Lo que depende de la petición (`searchParams`, cookies/sesión) se renderiza dentro de `<Suspense>`.
- Tema claro/oscuro: script en línea antes del primer pintado (sin parpadeo) + clase `.dark`.

## Clientes de Supabase
| Cliente | Uso | Clave |
| --- | --- | --- |
| `getPublicClient()` | Lecturas públicas cacheables, sin cookies | anon |
| `getServerClient()` | Acciones del usuario autenticado (reseñas, favoritos) | anon + sesión |
| `getAdminClient()` | Jobs de confianza (noticias, tipos de cambio) | service_role (solo servidor) |

Todos los módulos de `src/lib/supabase` importan `server-only`, así que no pueden acabar en el bundle del navegador.

## Modelo de datos (resumen)
`brands → families → models → variants`, con `cpus`/`gpus` reutilizables.
- **Variantes** guardan sus propias especificaciones: nunca se mezclan configuraciones.
- **spec_sources**: procedencia por campo (fuente, URL, verificado por, fecha).
- **images**: `is_official` exige fuente; `is_placeholder` identifica sustituciones.
- **models.commercial_status**: `current`/`in_stores` exigen fecha y fuente de verificación (CHECK en BD).
- **prices**: solo precios observados en moneda original (`launch`/`official`/`store`). Las conversiones se
  calculan en la vista con `latest_exchange_rates` y se etiquetan como conversión. `price_stats` solo calcula
  promedio con ≥ 3 muestras.
- **news_articles**: `dedupe_key` único, `label` (oficial/análisis/rumor/filtración), flujo `pending → approved → published`.
- Comunidad: `reviews` (una por usuario y modelo), `comments` (hilos), `user_photos` (moderación previa), `likes`, `reports`
  (auto-ocultación con 3 reportes abiertos).
- Cuentas: `favorites`, `lists`, `comparisons` (enlaces compartibles), `follows`, `notifications`, `view_history`.
- Operación: `audit_log` (trigger en tablas editoriales), `sync_runs`, `check_rate_limit()`.

## Seguridad
- RLS en todas las tablas; roles `user/moderator/editor/admin` en `profiles`.
- Triggers impiden: auto-escalada de rol, que usuarios marquen reseñas como profesionales o alteren estado/contadores.
- Storage: `user-photos/<uid>/…` solo escribible por su dueño; tipos MIME y tamaño limitados por bucket.
- Entradas de URL validadas con Zod; el buscador funciona sin JavaScript.
