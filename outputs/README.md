# Flujo de clips verticales (TikTok · Reels · Shorts)

Script: `outputs/herramientas/clips.py`. Ejecútalo con el Python del entorno virtual: `PY=/root/vozenv/bin/python`.

## Herramientas

| Herramienta | Estado | Para qué |
|---|---|---|
| ffmpeg / ffprobe 6.1 (con libass y libx264) | instalado | cortar, componer, incrustar subtítulos y exportar H.264/AAC |
| yt-dlp | instalado en `/root/vozenv` (`pip install yt-dlp`) | descargar el vídeo |
| faster-whisper | instalado en `/root/vozenv` | transcripción con marcas de tiempo por palabra |
| OpenCV + YuNet (`herramientas/face_detection_yunet_2023mar.onnx`) | instalado (`pip install opencv-python-headless`) | detectar y seguir la cara para el encuadre |
| Fuente Anton (`herramientas/fuentes/`) | incluida | subtítulos (SIL Open Font License) |

En una sesión nueva, reinstala con:

```bash
python3 -m venv /root/vozenv
```

```bash
/root/vozenv/bin/pip install yt-dlp faster-whisper opencv-python-headless
```

## Pasos

1. **Conseguir el vídeo:**
   - Con enlace descargable: `$PY outputs/herramientas/clips.py descargar URL`
   - Si YouTube pide iniciar sesión (vídeo restringido por edad): sube el archivo y guárdalo como `outputs/fuente/original.mp4`.
2. **Transcribir:** `$PY outputs/herramientas/clips.py transcribir outputs/fuente/original.mp4`.
   - Genera `outputs/fuente/transcripcion.txt`, con marcas de tiempo por frase, y `transcripcion.json`, con tiempos por palabra.
   - Usa el modelo `medium`; añade `--modelo small` si tienes prisa.
3. **Elegir de 5 a 10 momentos y escribir `outputs/fuente/clips.json`.** Cada momento debe tener:
   - un gancho en los primeros segundos,
   - sentido sin ver el vídeo completo,
   - un final con remate o pregunta,
   - entre 20 y 60 segundos.

   Los cortes se ajustan solos al inicio y al final de las palabras, así que nunca quedan a mitad de palabra.

   ```json
   {"correcciones": {"palabra_mal_oída": "corrección"},
    "clips": [{"inicio": 83.2, "fin": 121.5, "titulo": "...", "gancho": "...", "por_que": "...", "modo": "auto"}]}
   ```
4. **Renderizar:** `$PY outputs/herramientas/clips.py render outputs/fuente/original.mp4 outputs/fuente/clips.json`.
   - Genera `outputs/clips/clip_01.mp4`, … y `outputs/clips/descripcion.txt`.
5. **Verificar:** `$PY outputs/herramientas/clips.py verificar`.
   - Comprueba en cada clip:
     - que mide 1080×1920 y usa H.264/AAC;
     - que dura entre 15 y 75 s;
     - que se decodifica sin errores;
     - que el audio se entiende (lo transcribe de nuevo).
   - Además genera una hoja de fotogramas por clip en `outputs/clips/verificacion/` para revisar encuadre y subtítulos.

## Encuadre (`modo`)

- `auto`: elige según la cara detectada.
- `recorte`: ventana 9:16 que sigue la cara con movimiento suavizado. Para cuando la persona ocupa el plano.
- `dividido`: arriba el contenido completo (tráiler o juego) y abajo la webcam ampliada alrededor de la cara. Para reacciones con la cámara en una esquina.
- `desenfoque`: el plano completo, sin estirar, sobre una copia desenfocada. Para cuando no hay cara.

Con varias personas sigue a la cara más grande y estable. No detecta quién habla por el audio; si hace falta, fuerza el modo o ajusta los tiempos del clip.

## Subtítulos

- Frases de hasta 3 palabras, con la palabra que se está diciendo en amarillo.
- Letra Anton 104 px con borde negro.
- Posición elegida para no tapar la cara, siempre fuera de las zonas donde las apps ponen sus botones (abajo) y pestañas (arriba).
- `correcciones` solo arregla errores evidentes de reconocimiento, palabra por palabra.
- No se añade música ni efectos: el audio es el del original.

## Derechos

Publica clips solo de vídeos tuyos o con permiso del creador. Muchos streamers lo dan por escrito o tienen un programa de clips. Los fragmentos de tráileres o partidas pueden recibir reclamaciones de Content ID de la editorial del juego.
