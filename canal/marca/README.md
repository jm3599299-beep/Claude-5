# Marca del canal

| Archivo | Uso | Medidas |
|---|---|---|
| `banner.jpg` | Imagen del banner del canal | 2560×1440, menos de 6 MB. El texto y el logo están dentro de la zona segura central de 1546×423, la parte visible en todos los dispositivos. |
| `avatar.png` | Foto de perfil | 800×800. YouTube la recorta en círculo; todo el diseño queda dentro. |

**Dónde subirlos:** YouTube Studio → Personalización → Branding → «Imagen del banner» y «Imagen».

**Cómo regenerarlos:** `node canal/marca/generar.js <fondo.jpg>` (el diseño está en `marca.html`; añade `--guias` para ver la zona segura).

**Créditos:**
- Fondo del banner: «Cosmic Cliffs» en la nebulosa Carina, del telescopio espacial James Webb (NASA, ESA, CSA, STScI). Imagen de dominio público de la NASA: https://images.nasa.gov/details/carina_nebula
- Tipografías Anton y Montserrat (SIL Open Font License), en `fuentes/`.
- Logo dibujado por código: no usa imágenes de terceros.
