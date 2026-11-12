# LaptopVerse

**El universo mundial de las laptops.** Plataforma internacional para investigar, comparar, conocer precios,
leer noticias y compartir experiencias reales sobre laptops.

> Principio rector: LaptopVerse nunca presenta información ficticia como real. Sin datos verificados, la
> interfaz lo dice. Ver [`docs/DATA_POLICY.md`](docs/DATA_POLICY.md).

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend / SSR / SEO | Next.js 16 (App Router, Cache Components, Partial Prefetching), React 19, TypeScript |
| Estilos | Tailwind CSS 4, tokens propios (modo claro/oscuro) |
| Backend | Supabase: PostgreSQL, Auth, Storage, Row Level Security |
| Validación | Zod |
| Automatización | GitHub Actions (CI, tareas semanales) |

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # rellena las variables de Supabase
npm run dev
```

Sin variables de Supabase la app funciona y muestra estados vacíos explicando que la base de datos no está conectada.

### Configurar Supabase

1. Crea un proyecto en <https://supabase.com> (gratuito para empezar).
2. **Project Settings → API**: copia `Project URL` → `NEXT_PUBLIC_SUPABASE_URL` y la clave `anon` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. La clave `service_role` → `SUPABASE_SERVICE_ROLE_KEY` **solo** en el servidor / secretos de GitHub. Nunca en el frontend.
4. Aplica el esquema y los datos iniciales (SQL Editor o Supabase CLI):
   ```bash
   supabase link --project-ref <ref>
   supabase db push              # aplica supabase/migrations
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```
5. Para hacerte administrador: `update profiles set role = 'admin' where id = '<tu-user-id>';`

## Estructura

```
src/app/              rutas (home, /laptops, /marcas, /metodologia, sitemap, robots)
src/components/       brand (logo), layout (header/footer/tema), ui, home
src/lib/data/         consultas públicas cacheadas ("use cache") y tipos
src/lib/supabase/     clientes: public (anon, cacheable), server (sesión), admin (service role, solo servidor)
supabase/migrations/  esquema SQL + RLS
supabase/seed.sql     marcas y familias (sin modelos ni precios inventados)
src/lib/catalog-import/  esquema y motor del importador
scripts/              CLI de importación y generador de JSON Schema
data/catalog/         archivos de datos del catálogo (revisables por PR)
supabase/tests/       stubs + pruebas de seguridad para Postgres plano (CI)
docs/                 arquitectura, política de datos, hoja de ruta
```

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm run lint`
- `npm run db:test` — valida migraciones, reglas de seguridad y el importador contra un Postgres local (`PGHOST`, `PGPORT`, `PGUSER`).
- `npm run catalog:validate -- data/catalog` / `npm run catalog:import -- <ruta> [--dry-run]` — ver [`docs/IMPORTING.md`](docs/IMPORTING.md).
- `npm run catalog:schema` — regenera el JSON Schema del formato de importación.
- `npm run images:check -- data/catalog` / `npm run images:commons -- "File:…"` — imágenes con licencia (ver `docs/IMPORTING.md`).
- `npm run psref:convert -- <exportaciones.xlsx>` — adaptador Lenovo PSREF (ver `docs/IMPORTING.md`).
- `npm run fx:sync` — guarda los tipos de cambio USD→DOP/MXN del día (`DATABASE_URL`; opcional `EXCHANGERATE_API_KEY`).
- `npm run test:unit` — pruebas unitarias.

Más detalle: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/ROADMAP.md`](docs/ROADMAP.md).
