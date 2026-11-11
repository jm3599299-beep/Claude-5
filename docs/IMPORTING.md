# Importar laptops al catálogo

El catálogo crece mediante **archivos JSON revisables** en `data/catalog/`. Cada archivo se valida con un esquema
estricto (`src/lib/catalog-import/schema.ts`; JSON Schema generado en `data/schema/catalog.schema.json` para
autocompletado en el editor) y se importa en **una única transacción**: o entra todo el archivo o nada.

## Flujo recomendado

1. Copia `data/catalog/_plantilla.json` a `data/catalog/<marca>-<familia>.json`.
2. Rellena solo datos comprobados en la fuente (ficha oficial del fabricante, PSREF, página de especificaciones...).
3. `npm run catalog:validate -- data/catalog` — valida sin base de datos.
4. `npm run catalog:import -- data/catalog --dry-run` — importa y revierte, mostrando qué cambiaría.
5. Abre un pull request. Al fusionarlo, GitHub Actions importa a Supabase y revalida la caché del sitio.

## Estructura

| Clave | Contenido |
| --- | --- |
| `sources` | Fuentes del archivo, por clave. Todo `source` referenciado debe estar aquí. |
| `brands`, `families` | Opcional: nuevas marcas/familias (las principales ya existen por el seed). |
| `cpus`, `gpus` | Componentes, identificados por `manufacturer` + `model`. Reutilizables entre modelos. |
| `models[]` | Modelo con `variants[]` (una por configuración/SKU) e `images[]`. |

### Reglas que el validador impone
- `commercial_status` `current` o `in_stores` exige `verified_at` y `source` (también lo impone la base de datos).
- Cada variante tiene una `key` única dentro del modelo (se usa en la URL `?variante=`) y, opcionalmente, `sku`: el número de pieza real del fabricante. **Nunca inventes un SKU**: si el fabricante no lo asocia a esa configuración exacta, omítelo. Como mucho una variante `is_default`.
- `provenance`: indica qué fuente respalda qué campos. Un campo sin valor no puede tener fuente; un dato
  `verified` exige `url`; un campo no puede tener dos procedencias.
- `has_dgpu: false` = sin GPU dedicada (no se muestra «Desconocido»). Si se indica `gpu`, se asume `true`.
- Una imagen `is_official` exige `source` y `source_url`; una imagen `verified` exige `source_url`. Solo las imágenes
  `verified` se muestran en el sitio. `variant_key` asocia la foto a una configuración concreta.
- `published: false` por defecto: un editor decide cuándo un modelo es visible.
- Coherencia: RAM soldada ≤ RAM total, ranuras libres ≤ totales, `release_date` coincide con `release_year`.

### Comportamiento al reimportar
- Idempotente: modelos por `slug`, variantes por (`modelo`, `key`), imágenes por (`modelo`, `url`), componentes por
  (`manufacturer`, `model`), fuentes por `name`.
- Los campos del modelo y de las variantes importadas se sobrescriben con el contenido del archivo (el archivo es la
  fuente de verdad). La procedencia de cada variante importada se reemplaza completa.
- No se borran variantes ni imágenes que no aparezcan en el archivo.
- Cada ejecución queda en `sync_runs` y cada cambio en `audit_log`.

## Variables

| Variable | Dónde se obtiene |
| --- | --- |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (URI). Secreto. |
| `REVALIDATE_URL` | `https://<tu-dominio>/api/revalidate` |
| `REVALIDATE_SECRET` | `openssl rand -hex 32`; el mismo valor en el servidor web y en GitHub. Secreto. |
