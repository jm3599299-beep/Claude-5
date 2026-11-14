# Canal: misterios del universo en español (Shorts)

**Nicho:** curiosidades y misterios del espacio en español: agujeros negros, el Sol, planetas raros, preguntas tipo «¿qué pasaría si…?».
**Por qué este nicho:** tiene muchísima demanda en español (vídeos con cientos de miles o millones de vistas), no hace falta salir en cámara y la NASA ofrece imágenes reales de dominio público, así que cada vídeo puede llevar fotos de verdad sin problemas de derechos.

Cada día se produce un short nuevo en `canal/episodios/AAAA-MM-DD-tema/`, con `short.mp4` y `PUBLICAR.md` (título, descripción y etiquetas) listos para subir a mano.

## Procedimiento diario (lo sigue la tarea programada)

Trabaja siempre en la rama `canal-youtube`.

1. **Tendencias.** Ejecuta `python3 canal/motor/tendencias.py --periodo semana --out canal/tendencias/AAAA-MM-DD.md`.
   - Si hay pocos resultados, repite con `--periodo mes`.
   - Puedes añadir consultas propias como argumentos.
   - Ignora los resultados que no son del nicho (bailes, películas…).
2. **Elegir tema.** Busca qué *formato* y qué *tema* se repiten entre los que más vistas tienen (por ejemplo «qué pasaría si», agujeros negros, el Sol). Elige un ángulo **propio** que encaje en esa tendencia:
   - No copies el título ni el guion de otro vídeo.
   - No repitas un tema ya hecho: revisa la lista de episodios de abajo y las carpetas de `canal/episodios/`.
3. **Guion** (`guion.json`; el formato está en la cabecera de `canal/motor/produce.py`):
   - Entre 5 y 8 escenas, de 30 a 45 segundos en total.
   - La primera frase es el gancho: una pregunta o una afirmación impactante.
   - Cada escena aporta un dato nuevo y la última cierra con un remate.
   - Comprueba **cada dato** con una búsqueda web y no inventes cifras.
   - En `texto`, escribe los números con letra para que la voz los lea bien. En `subtitulo`, usa cifras y marca con `*asteriscos*` lo que se debe resaltar.
   - `dato` es una cifra o palabra corta que aparece grande en pantalla.
4. **Imágenes.** Para cada escena, ejecuta `python3 canal/motor/imagenes.py "consulta en inglés" canal/episodios/<ep>/img/<n> --n 6`.
   - Usa `--fuente commons` para lo que no sea espacio.
   - Mira `candidatos.jpg` y elige la mejor. Evita fotos con texto, gráficas, personas en laboratorios o mala calidad.
5. **Previa.** Ejecuta `python3 canal/motor/produce.py canal/episodios/<ep> --previa` y revisa `previa.jpg`. Ajusta el encuadre (`foco`) o cambia las imágenes si hace falta.
6. **Render.** Ejecuta `python3 canal/motor/produce.py canal/episodios/<ep>`. Genera `short.mp4`, `miniatura.jpg` y `PUBLICAR.md`.
7. **Limpieza.** Borra de `img/<n>/` las candidatas que no se usan y deja solo la elegida, `creditos.json` y `candidatos.jpg`.
8. **Registro.** Añade el episodio a la lista de abajo y haz commit y push a `canal-youtube`.

## Episodios

| Fecha | Tema | Carpeta |
|---|---|---|
| 2026-11-14 | La luz del Sol es vieja (8 min y 100 000 años) | `episodios/2026-11-14-luz-vieja` |
| 2026-11-14 | Si la Tierra fuera un agujero negro mediría 9 mm | `episodios/2026-11-14-tierra-agujero-negro` |

## Notas

- **Hora de publicación:** a las **18:00, hora de Ciudad de México**. Según Buffer (1,8 M de Shorts analizados), la franja de 16:00 a 19:00 hora local es la mejor. La tarea diaria arranca a las 16:47 para que el vídeo esté listo antes. Cuando el canal tenga datos, ajústala con el informe «Cuándo están tus espectadores en YouTube» de YouTube Studio.
- **Montaje premium con Higgsfield** (manual, gasta créditos):
  - Voz: motor de ElevenLabs (`text2speech_v2`, variante `elevenlabs`) con la voz `Harrison` (id `573e5163-59b3-4926-aab1-951ef2985f81`). Es la más parecida a «James – Husky & Engaging», la voz destacada en la sección Narration de ElevenLabs. Cuesta unos 1,8 créditos por cada 580 caracteres.
  - Montaje: Higgsedit con `canal/motor/higgsedit_plan.py` (tiempos por palabra con faster-whisper, subtítulos palabra a palabra con la fuente Anton, fotos a pantalla completa con fundidos).
  - La tarea diaria no tiene acceso a Higgsfield, así que sigue usando el motor local con Piper.

- **Nombre del canal:** la marca que aparece en el vídeo es `@JoseMartines-hh4uw` (`CANAL` en `produce.py` y `higgsedit_plan.py`), el canal https://www.youtube.com/channel/UCk6wJ0Wz5JXbouZAW0pjnlg. Si cambias el identificador del canal, cámbialo ahí.
- **Voz:** si existe `canal/voz/referencia.wav` (una grabación de unos 8 a 15 s del dueño del canal hablando), la narración usa **su voz clonada** con Chatterbox Multilingual. Es de licencia MIT y corre en local: la grabación no se envía a ningún servicio. La primera vez se instala solo en `~/vozenv` y tarda unos minutos. Cada frase se transcribe con Whisper y se regenera si no se entiende bien.
  - Si no hay grabación, se usa la voz sintética Piper (`es_MX-claude-high`). También puedes forzarla con `--voz-sintetica`.
  - `canal/voz/` está en `.gitignore` porque el repo es **público** y la muestra permitiría clonar la voz. Si el repo pasa a ser privado, se puede quitar de `.gitignore` y subir la grabación para que la tarea diaria también narre con esa voz.
- **Música:** la sintetiza `produce.py`, así que no hay problemas de derechos.
- **Subida:** se hace a mano (Windsor.ai solo lee estadísticas de YouTube y no puede publicar). Usa Windsor.ai para revisar qué episodios funcionan mejor y orientar los siguientes temas.
