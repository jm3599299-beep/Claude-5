#!/usr/bin/env python3
"""Flujo para sacar clips verticales (9:16, 1080x1920) con subtítulos palabra a palabra.

Ejecutar con el Python del entorno virtual (tiene faster-whisper, OpenCV y yt-dlp):
  PY=/root/vozenv/bin/python
  $PY clips.py descargar URL [--cookies cookies.txt]   -> outputs/fuente/original.mp4
  $PY clips.py transcribir outputs/fuente/original.mp4 -> transcripcion.json / transcripcion.txt
  (elegir momentos y escribir outputs/fuente/clips.json; ver README.md)
  $PY clips.py render outputs/fuente/original.mp4 outputs/fuente/clips.json
  $PY clips.py verificar                               -> outputs/clips/verificacion/

clips.json: lista de objetos
  {"inicio": 12.3, "fin": 48.0, "titulo": "...", "gancho": "...", "por_que": "...",
   "modo": "auto|recorte|dividido|desenfoque"}            (modo opcional, por defecto auto)
y opcionalmente al nivel raíz {"correcciones": {"palabra mal oída": "corrección"}, "clips": [...]}.

Encuadre:
  recorte    -> ventana 9:16 que sigue la cara (para planos donde la persona ocupa el cuadro)
  dividido   -> arriba el contenido (vídeo/juego) y abajo la cámara del streamer ampliada
                (para reacciones con webcam pequeña en una esquina)
  desenfoque -> el plano completo centrado sobre una copia desenfocada (sin estirar)
  auto       -> elige según el tamaño de la cara detectada (YuNet)
"""
import argparse, json, os, re, subprocess, sys
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.environ.get("CLIPS_RAIZ") or os.path.dirname(AQUI)  # outputs/ (CLIPS_RAIZ para pruebas)
FUENTE = os.path.join(RAIZ, "fuente")
SALIDA = os.path.join(RAIZ, "clips")
MODELO_CARA = os.path.join(AQUI, "face_detection_yunet_2023mar.onnx")
FUENTES_TIPO = os.path.join(AQUI, "fuentes")  # Anton (SIL OFL)
W, H = 1080, 1920


def sh(*a, **k):
    return subprocess.run(a, check=True, **k)


def fmt(t):
    return f"{int(t // 60):02d}:{t % 60:05.2f}"


# ---------------------------------------------------------------- descargar
def descargar(url, cookies=None):
    os.makedirs(FUENTE, exist_ok=True)
    cmd = [os.path.join(os.path.dirname(sys.executable), "yt-dlp"), "--no-playlist",
           "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]", "--merge-output-format", "mp4",
           "-o", os.path.join(FUENTE, "original.%(ext)s"), "--write-info-json", url]
    if cookies:
        cmd[1:1] = ["--cookies", cookies]
    sh(*cmd)


# ---------------------------------------------------------------- transcribir
def audio16k(video, ini=None, dur=None):
    cmd = ["ffmpeg", "-loglevel", "error"] + (["-ss", str(ini)] if ini is not None else []) + ["-i", video] + \
          (["-t", str(dur)] if dur is not None else []) + ["-ac", "1", "-ar", "16000", "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32)


def transcribir(video, modelo="medium"):
    from faster_whisper import WhisperModel
    m = WhisperModel(modelo, device="cpu", compute_type="int8")
    segs, info = m.transcribe(audio16k(video), language="es", word_timestamps=True, vad_filter=True)
    out = {"idioma": info.language, "segmentos": []}
    for s in segs:
        out["segmentos"].append({"a": round(s.start, 2), "b": round(s.end, 2), "texto": s.text.strip(),
                                 "palabras": [{"w": w.word.strip(), "a": round(w.start, 3), "b": round(w.end, 3)} for w in s.words]})
        print(f"[{fmt(s.start)} - {fmt(s.end)}] {s.text.strip()}", flush=True)
    os.makedirs(FUENTE, exist_ok=True)
    json.dump(out, open(os.path.join(FUENTE, "transcripcion.json"), "w"), ensure_ascii=False, indent=1)
    with open(os.path.join(FUENTE, "transcripcion.txt"), "w") as f:
        for s in out["segmentos"]:
            f.write(f"[{fmt(s['a'])} - {fmt(s['b'])}] {s['texto']}\n")


def palabras(trans):
    return [w for s in trans["segmentos"] for w in s["palabras"]]


# ---------------------------------------------------------------- encuadre
class Caras:
    def __init__(self):
        import cv2
        self.cv2 = cv2
        self.det = cv2.FaceDetectorYN.create(MODELO_CARA, "", (320, 320), 0.75, 0.3, 50)

    def detectar(self, frame):
        h, w = frame.shape[:2]
        esc = 640 / w
        peq = self.cv2.resize(frame, (640, int(h * esc)))
        self.det.setInputSize((peq.shape[1], peq.shape[0]))
        _, f = self.det.detect(peq)
        if f is None:
            return []
        return [(x / esc, y / esc, bw / esc, bh / esc, s) for x, y, bw, bh, s in f[:, [0, 1, 2, 3, 14]]]


def analizar_caras(video, ini, fin, paso=0.25):
    """Devuelve [(t, cara|None)] eligiendo la cara más grande y estable (la de quien está en cuadro)."""
    import cv2
    cap = cv2.VideoCapture(video)
    det = Caras()
    res, prev = [], None
    t = ini
    while t < fin:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, fr = cap.read()
        if not ok:
            break
        caras = det.detectar(fr)
        mejor = None
        if caras:
            def puntos(c):
                x, y, w, h, s = c
                p = w * h * s
                if prev is not None:  # continuidad: penaliza saltos grandes de una persona a otra
                    d = abs((x + w / 2) - (prev[0] + prev[2] / 2)) / fr.shape[1]
                    p *= 1 / (1 + 4 * d)
                return p
            mejor = max(caras, key=puntos)
            prev = mejor
        res.append((t, mejor))
        t += paso
    cap.release()
    return res


def suavizar(ts, vals, fps, ini, fin, ventana=1.2):
    """Interpola muestras a cada fotograma y aplica media móvil + zona muerta para que la cámara no tiemble."""
    n = int(round((fin - ini) * fps))
    tf = ini + np.arange(n) / fps
    v = np.interp(tf, ts, vals)
    k = max(1, int(ventana * fps))
    pad = np.pad(v, (k, k), mode="edge")
    v = np.convolve(pad, np.ones(2 * k + 1) / (2 * k + 1), mode="same")[k:-k]
    out = v.copy()
    for i in range(1, n):
        out[i] = out[i - 1] if abs(v[i] - out[i - 1]) < 6 else out[i - 1] + (v[i] - out[i - 1]) * 0.15
    return out


def elegir_modo(muestras, ancho, alto):
    caras = [c for _, c in muestras if c is not None]
    if len(caras) < 0.4 * max(1, len(muestras)):
        return "desenfoque"
    alt = np.median([c[3] for c in caras]) / alto
    return "recorte" if alt > 0.22 else "dividido"


# ---------------------------------------------------------------- subtítulos (ASS)
def ass_tiempo(t):
    t = max(0, t)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def franja_subtitulos(cara_out):
    """Elige la altura (centro, px) de los subtítulos que menos tape la cara.
    Franjas candidatas, de preferida a menos: baja, media-baja y alta. Todas fuera de la
    franja inferior (botones de TikTok/Reels/Shorts) y de la superior (pestañas)."""
    franjas = [1430, 1240, 380]
    if cara_out is None:
        return franjas[0]
    y0, y1 = cara_out
    def solape(c):
        a, b = c - 80, c + 80
        return max(0, min(b, y1) - max(a, y0))
    return min(franjas, key=lambda c: (solape(c), franjas.index(c)))


def subtitulos_ass(pal, ini, fin, modo, ruta, correcciones, y_sub=1430):
    """Frases cortas (≤3 palabras); la palabra que se está diciendo va en amarillo."""
    ws = []
    for w in pal:
        if w["b"] <= ini or w["a"] >= fin:
            continue
        txt = w["w"]
        for mal, bien in correcciones.items():
            if re.fullmatch(re.escape(mal), txt.strip(" ,.;:¿?¡!"), re.I):
                txt = txt.replace(txt.strip(" ,.;:¿?¡!"), bien)
        ws.append({"w": txt.strip(), "a": max(0, w["a"] - ini), "b": min(fin, w["b"]) - ini})
    grupos, cur = [], []
    for w in ws:
        cur.append(w)
        limpio = " ".join(x["w"] for x in cur)
        if len(cur) >= 3 or len(limpio) >= 16 or re.search(r"[.,;:?!…]$", w["w"]) or \
                (len(cur) and w is not ws[-1] and ws[ws.index(w) + 1]["a"] - w["b"] > 0.6):
            grupos.append(cur); cur = []
    if cur:
        grupos.append(cur)
    pos = r"{\an5\pos(540,960)}" if modo == "dividido" else r"{\an5\pos(540,%d)}" % y_sub
    margen = 430  # deja libre la franja inferior donde TikTok/Reels/Shorts ponen sus botones y texto
    lineas = [
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 0", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Sub,Anton,104,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,1,0,1,9,4,2,90,90,{margen},1",
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    for gi, gr in enumerate(grupos):
        fin_grupo = grupos[gi + 1][0]["a"] if gi + 1 < len(grupos) else gr[-1]["b"] + 0.4
        fin_grupo = min(fin_grupo, gr[-1]["b"] + 0.8)
        for j, w in enumerate(gr):
            a = w["a"]
            b = gr[j + 1]["a"] if j + 1 < len(gr) else fin_grupo
            if b <= a:
                continue
            partes = []
            for k, x in enumerate(gr):
                t = x["w"].upper().replace("{", "(").replace("}", ")")
                partes.append(r"{\c&H00D2FF&}" + t + r"{\c&HFFFFFF&}" if k == j else t)
            pop = r"{\fscx92\fscy92\t(0,90,\fscx100\fscy100)}" if j == 0 else ""
            lineas.append(f"Dialogue: 0,{ass_tiempo(a)},{ass_tiempo(b)},Sub,,0,0,0,,{pos}{pop}{' '.join(partes)}")
    open(ruta, "w", encoding="utf-8").write("\n".join(lineas) + "\n")
    return ws


# ---------------------------------------------------------------- render
def ajustar_limites(pal, ini, fin):
    """No corta palabras: empieza al inicio de la primera palabra y termina al final de la última completa."""
    dentro = [w for w in pal if w["a"] >= ini - 0.4 and w["b"] <= fin + 0.4]
    if not dentro:
        return ini, fin
    return max(0, dentro[0]["a"] - 0.15), dentro[-1]["b"] + 0.35


def render_clip(video, clip, n, pal, correcciones, info):
    import cv2
    fps = info["fps"]; vw, vh = info["w"], info["h"]
    ini, fin = ajustar_limites(pal, clip["inicio"], clip["fin"])
    muestras = analizar_caras(video, ini, fin)
    modo = clip.get("modo", "auto")
    if modo == "auto":
        modo = elegir_modo(muestras, vw, vh)
    con = [(t, c) for t, c in muestras if c is not None]
    if con:
        ts = [t for t, _ in con]
        cx = suavizar(ts, [c[0] + c[2] / 2 for _, c in con], fps, ini, fin)
        cy = suavizar(ts, [c[1] + c[3] / 2 for _, c in con], fps, ini, fin)
        ch = float(np.median([c[3] for _, c in con]))
    else:
        cx = cy = None; ch = vh * .2
    os.makedirs(SALIDA, exist_ok=True)
    ass = os.path.join(SALIDA, f".clip_{n:02d}.ass")
    cara_out = None
    if con and modo == "recorte":  # caja de la cara (con margen) en coordenadas de salida
        esc = H / vh
        y0 = np.median([c[1] for _, c in con]) * esc - 40
        y1 = (np.median([c[1] + c[3] for _, c in con]) + ch * .25) * esc + 40
        cara_out = (y0, y1)
    elif con and modo == "desenfoque":
        fh = int(W * vh / vw); fy = (H - fh) // 2 - 120; esc = W / vw
        cara_out = (fy + np.median([c[1] for _, c in con]) * esc - 30, fy + np.median([c[1] + c[3] for _, c in con]) * esc + 30)
    subtitulos_ass(pal, ini, fin, modo, ass, correcciones, franja_subtitulos(cara_out))
    out = os.path.join(SALIDA, f"clip_{n:02d}.mp4")
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error",
                           "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                           "-ss", f"{ini:.3f}", "-t", f"{fin - ini:.3f}", "-i", video,
                           "-map", "0:v", "-map", "1:a?", "-vf", f"ass={ass}:fontsdir={FUENTES_TIPO}",
                           "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
                           "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out],
                          stdin=subprocess.PIPE)
    cap = cv2.VideoCapture(video)
    cap.set(cv2.CAP_PROP_POS_MSEC, ini * 1000)
    total = int(round((fin - ini) * fps))
    lienzo = np.zeros((H, W, 3), np.uint8)
    for i in range(total):
        ok, fr = cap.read()
        if not ok:
            break
        if modo == "recorte":
            cw = int(round(vh * 9 / 16)); x0 = int(np.clip((cx[i] if cx is not None else vw / 2) - cw / 2, 0, vw - cw))
            lienzo = cv2.resize(fr[:, x0:x0 + cw], (W, H), interpolation=cv2.INTER_AREA if cw > W else cv2.INTER_CUBIC)
        elif modo == "dividido":
            # arriba: contenido completo (16:9) sobre fondo desenfocado, abajo: cámara ampliada alrededor de la cara
            arriba = fondo_desenfocado(cv2, fr, W, H // 2)
            fh = int(W * vh / vw); fy = (H // 2 - fh) // 2
            arriba[fy:fy + fh] = cv2.resize(fr, (W, fh), interpolation=cv2.INTER_AREA)
            bh = ch * 3.2; bw = bh * W / (H // 2)
            bx = int(np.clip((cx[i] if cx is not None else vw / 2) - bw / 2, 0, vw - bw))
            by = int(np.clip((cy[i] if cy is not None else vh / 2) - bh * .45, 0, vh - bh))
            abajo = cv2.resize(fr[by:by + int(bh), bx:bx + int(bw)], (W, H // 2), interpolation=cv2.INTER_CUBIC)
            lienzo = np.vstack([arriba, abajo])
        else:  # desenfoque
            lienzo = fondo_desenfocado(cv2, fr, W, H)
            fh = int(W * vh / vw); fy = (H - fh) // 2 - 120
            lienzo[fy:fy + fh] = cv2.resize(fr, (W, fh), interpolation=cv2.INTER_AREA)
        ff.stdin.write(lienzo.tobytes())
    cap.release(); ff.stdin.close(); ff.wait()
    os.remove(ass)
    return {"archivo": os.path.basename(out), "inicio": round(ini, 2), "fin": round(fin, 2), "duracion": round(fin - ini, 1), "modo": modo}


def fondo_desenfocado(cv2, fr, w, h):
    vh, vw = fr.shape[:2]
    esc = max(w / vw, h / vh)
    peq = cv2.resize(fr, (int(vw * esc / 8) + 1, int(vh * esc / 8) + 1))
    peq = cv2.GaussianBlur(peq, (0, 0), 6)
    big = cv2.resize(peq, (int(vw * esc), int(vh * esc)))
    y0 = (big.shape[0] - h) // 2; x0 = (big.shape[1] - w) // 2
    return (big[y0:y0 + h, x0:x0 + w] * 0.55).astype(np.uint8)


def info_video(video):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                   "stream=width,height,r_frame_rate", "-of", "json", video], capture_output=True, check=True).stdout)
    s = j["streams"][0]; a, b = map(int, s["r_frame_rate"].split("/"))
    return {"w": s["width"], "h": s["height"], "fps": round(a / b, 3)}


def render(video, clips_json):
    cfg = json.load(open(clips_json))
    clips = cfg["clips"] if isinstance(cfg, dict) else cfg
    corr = cfg.get("correcciones", {}) if isinstance(cfg, dict) else {}
    trans = json.load(open(os.path.join(FUENTE, "transcripcion.json")))
    pal = palabras(trans); info = info_video(video)
    hechos = []
    for n, c in enumerate(clips, 1):
        r = render_clip(video, c, n, pal, corr, info)
        hechos.append({**c, **r}); print("ok", r, flush=True)
    with open(os.path.join(SALIDA, "descripcion.txt"), "w") as f:
        f.write(f"Clips extraídos de: {os.path.basename(video)}\n\n")
        for c in hechos:
            texto = " ".join(w["w"] for w in pal if w["a"] >= c["inicio"] and w["b"] <= c["fin"])
            f.write(f"{c['archivo']}  [{fmt(c['inicio'])} - {fmt(c['fin'])}]  {c['duracion']} s  (encuadre: {c['modo']})\n"
                    f"  Título: {c.get('titulo', '')}\n  Gancho: {c.get('gancho', '')}\n  Por qué: {c.get('por_que', '')}\n"
                    f"  Transcripción: {texto}\n\n")


# ---------------------------------------------------------------- verificar
def verificar():
    from faster_whisper import WhisperModel
    import difflib
    ver = os.path.join(SALIDA, "verificacion"); os.makedirs(ver, exist_ok=True)
    m = WhisperModel("small", device="cpu", compute_type="int8")
    ok_total = True
    for f in sorted(x for x in os.listdir(SALIDA) if re.fullmatch(r"clip_\d+\.mp4", x)):
        p = os.path.join(SALIDA, f)
        pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,width,height:format=duration",
                                        "-of", "json", p], capture_output=True).stdout)
        cod = {s["codec_name"]: s for s in pr["streams"]}
        dur = float(pr["format"]["duration"])
        errores = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "null", "-"], capture_output=True, text=True).stderr.strip()
        v = cod.get("h264", {})
        dims = (v.get("width"), v.get("height")) == (W, H)
        sh("ffmpeg", "-y", "-loglevel", "error", "-i", p, "-vf", f"fps=4/{dur:.2f},scale=270:480,tile=4x1", "-frames:v", "1",
           os.path.join(ver, f.replace(".mp4", ".jpg")))
        oido = " ".join(s.text for s in m.transcribe(audio16k(p), language="es")[0])
        estado = "OK" if (dims and "aac" in cod and not errores and 15 <= dur <= 75) else "REVISAR"
        ok_total &= estado == "OK"
        print(f"{f}: {estado} | {v.get('width')}x{v.get('height')} h264={'h264' in cod} aac={'aac' in cod} "
              f"dur={dur:.1f}s errores_decodificación={'no' if not errores else errores[:80]} | audio: {oido.strip()[:90]}…")
    print("TODO OK" if ok_total else "HAY CLIPS PARA REVISAR")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="cmd", required=True)
    d = sp.add_parser("descargar"); d.add_argument("url"); d.add_argument("--cookies")
    t = sp.add_parser("transcribir"); t.add_argument("video"); t.add_argument("--modelo", default="medium")
    r = sp.add_parser("render"); r.add_argument("video"); r.add_argument("clips")
    sp.add_parser("verificar")
    a = ap.parse_args()
    if a.cmd == "descargar": descargar(a.url, a.cookies)
    elif a.cmd == "transcribir": transcribir(a.video, a.modelo)
    elif a.cmd == "render": render(a.video, a.clips)
    else: verificar()
