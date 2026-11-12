# Fuentes de datos y registro de verificación

## Lotes importados

| Archivo | Modelos | Fuente | Verificado |
| --- | --- | --- | --- |
| `data/catalog/apple-macbook-air.json` | MacBook Air (13-inch, M5), MacBook Air (15-inch, M5) — 3 configuraciones estándar cada uno | [Apple — MacBook Air Tech Specs](https://www.apple.com/macbook-air/specs/); nombre, año e identificador: [Identify your MacBook Air model](https://support.apple.com/en-us/102869) | 2026-11-11 |

### Notas del lote Apple
- Solo se registraron valores que aparecen literalmente en la ficha oficial. Lo que Apple no publica (frecuencias y
  arquitectura de la CPU, tasa de refresco, pantalla táctil, ampliabilidad del SSD, refrigeración, cargador) queda vacío
  y se muestra como «Desconocido».
- **SKU:** Apple publica números de pieza por color/región sin asociarlos a cada configuración; no se asignaron
  (las variantes usan `key`).
- **Estado comercial «A la venta»:** comprobado en la ficha vigente de apple.com el 2026-11-11.
- Fecha de lanzamiento: comunicado de Apple Newsroom del 3 de marzo de 2026 (disponibilidad desde el 11 de marzo de 2026).
  Precios de partida en EE. UU. anotados en la fuente para la Fase 5: 13" 1.099 USD (999 USD educación), 15" 1.299 USD
  (1.199 USD educación).
- **Fotografías: no se usan.** Los términos de apple.com prohíben reproducir o mostrar públicamente su contenido
  (incluidas fotos y el enlace directo) sin permiso escrito. Esto incluye las imágenes de la ficha técnica y las del
  comunicado. Además, la mayoría de fotos del comunicado no indican si muestran el modelo de 13" o de 15".
  Vías para tener fotos: solicitar permiso a Apple (relaciones con medios), fotos propias o fotos CC de Wikimedia Commons
  del modelo exacto.
- **Acceso automatizado:** los mismos términos prohíben acceder al sitio con programas automáticos. A partir de ahora los
  datos de Apple se verifican manualmente.

## Fuentes evaluadas

### Lenovo PSREF (`psref.lenovo.com`)
- Fuente oficial y muy completa. Las fichas PDF de plataforma (`/syspool/Sys/PDF/<Serie>/<Producto>/<Producto>_Spec.pdf`)
  describen **todas las opciones configurables** de una plataforma; no deben importarse como una sola variante.
- Las configuraciones reales son los **MTM** (p. ej. modelos `21xx…`), cada uno con su propia página en la aplicación web
  de PSREF (requiere renderizar JavaScript). Pendiente: adaptador PSREF → formato de importación, a nivel de MTM.
- PSREF indica que no confirma disponibilidad: los modelos Lenovo deben importarse con `commercial_status` `unverified`
  salvo comprobación en la tienda oficial.

### Apple MacBook Pro
- La ficha vigente combina chips M6 y M5 Pro/M5 Max en tamaños de 14" y 16", y hay un modelo anunciado el
  2026-10-28. Pendiente de un lote propio para no mezclar generaciones.

### Wikimedia Commons (`commons.wikimedia.org`, `upload.wikimedia.org`)
- Fuente preferente de fotos con licencia abierta. `npm run images:commons -- "File:…"` obtiene autor y licencia de los
  metadatos y rechaza licencias no compatibles (NC, ND, uso justo…).
- Desde la red compartida de este entorno de desarrollo la API devolvió 429 (límite de peticiones); ejecútalo desde tu
  equipo o desde CI.
