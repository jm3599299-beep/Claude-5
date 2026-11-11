# Datos del catálogo

Cada archivo `*.json` de esta carpeta se valida en CI y, al fusionarse en `main`, se importa a Supabase
(workflow **Catalog import**). Los archivos que empiezan por `_` (como `_plantilla.json`) se ignoran.

Reglas: solo datos con fuente; nada inventado. Formato completo en [`docs/IMPORTING.md`](../../docs/IMPORTING.md).
