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
- No se añadieron ventajas/desventajas ni fotografías (pendiente de análisis editorial y de la Fase 4).

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
