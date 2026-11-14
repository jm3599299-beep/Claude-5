#!/usr/bin/env python3
"""Produce un short completo a partir de canal/episodios/<carpeta>/guion.json.

Uso: python3 canal/motor/produce.py canal/episodios/<carpeta> [--previa]
  --previa  solo genera voz + fotogramas de muestra (previa.jpg) para revisar antes del render.

Formato de guion.json:
{
  "titulo": "...", "descripcion": "...", "etiquetas": ["..."],
  "gancho": "Texto grande de la primera escena",
  "cta": "Síguenos para más",
  "velocidad_voz": 0.92,            # <1 = más rápido
  "escenas": [
    {"texto": "Lo que dice la voz (números en letra)",
     "subtitulo": "Lo que se lee (puede llevar cifras y *resaltado*) [opcional]",
     "dato": "Cifra o frase grande arriba [opcional]",
     "imagen": "img/1.jpg", "mov": "in|out|left|right|up [opcional]", "foco": [0.5, 0.5]}
  ]
}
Salida: short.mp4, miniatura.jpg y PUBLICAR.md en la carpeta del episodio.
"""
import json, os, subprocess, sys, wave, urllib.request
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
VOZ_DIR = os.path.join(os.path.expanduser("~"), ".cache", "piper")
VOZ = "es_MX-claude-high"
VOZ_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/"
CANAL = "@UniversoEnUnMinuto"  # cámbialo por el nombre real del canal
PAUSA = 0.28        # silencio entre frases
INICIO = 0.35
COLA = 1.6          # tiempo tras la última frase


def sh(*a):
    subprocess.run(a, check=True)


def preparar_voz():
    try:
        import piper  # noqa
    except ImportError:
        sh(sys.executable, "-m", "pip", "install", "-q", "piper-tts")
    os.makedirs(VOZ_DIR, exist_ok=True)
    for f in (VOZ + ".onnx", VOZ + ".onnx.json"):
        p = os.path.join(VOZ_DIR, f)
        if not os.path.exists(p):
            urllib.request.urlretrieve(VOZ_URL + f, p)
    return os.path.join(VOZ_DIR, VOZ + ".onnx")


def dur(p):
    with wave.open(p) as w:
        return w.getnframes() / w.getframerate()


def tts(modelo, texto, salida, vel):
    subprocess.run([sys.executable, "-m", "piper", "-m", modelo, "--length-scale", str(vel), "-f", salida],
                   input=texto.encode(), check=True, capture_output=True)


def musica(salida, duracion, cortes, seed=1):
    SR = 44100; N = int(SR * duracion); t = np.arange(N) / SR
    rng = np.random.default_rng(seed)
    L = np.zeros(N); R = np.zeros(N)
    def add(sig, start, pan=.5, gain=1.):
        i = int(start * SR); n = min(len(sig), N - i)
        if n <= 0 or i < 0: return
        L[i:i+n] += sig[:n] * gain * np.cos(pan * np.pi / 2); R[i:i+n] += sig[:n] * gain * np.sin(pan * np.pi / 2)
    f = lambda m: 440 * 2 ** ((m - 69) / 12)
    progs = [[[45,52,57,60,64],[41,53,57,60,65],[48,52,55,60,64],[43,50,55,59,62]],
             [[50,57,62,65,69],[46,53,58,62,65],[43,50,55,58,62],[45,52,57,61,64]],
             [[40,47,52,55,59],[36,48,52,55,60],[43,50,55,59,62],[38,50,54,57,62]]]
    chords = progs[seed % len(progs)]; bar = 4.0
    for k in range(int(duracion / bar) + 1):
        ch = chords[k % 4]; n = int((bar + 1.2) * SR); tt = np.arange(n) / SR
        env = np.minimum(tt / 1.2, 1) * np.minimum((bar + 1.2 - tt) / 1.2, 1)
        for j, m in enumerate(ch):
            for det in (-.004, .004):
                fr = f(m) * (1 + det)
                s = np.sin(2*np.pi*fr*tt) + .3*np.sin(4*np.pi*fr*tt) + .12*np.sin(6*np.pi*fr*tt)
                add(s * env, k * bar, .3 + .1 * j if det < 0 else .7 - .1 * j, .033)
        for q in range(16):
            m = ch[1:][[0,2,1,3,2,3,1,2][(q + seed) % 8]] + 12; tt2 = np.arange(int(.6 * SR)) / SR
            add(np.sin(2*np.pi*f(m)*tt2) * np.exp(-tt2*7) + .25*np.sin(4*np.pi*f(m)*tt2)*np.exp(-tt2*10),
                k*bar + q*.25, .25 + .5*((q*7) % 5)/4, .05*(.6 + .4*(q % 2 == 0)))
        if k > 0:
            for q in range(4):
                tt3 = np.arange(int(.35 * SR)) / SR
                add(np.sin(2*np.pi*(48 + 50*np.exp(-tt3*30))*tt3) * np.exp(-tt3*9), k*bar + q, .5, .16)
    def whoosh(d=.7):
        n = int(d * SR); x = np.cumsum(rng.standard_normal(n)); x -= np.linspace(x[0], x[-1], n)
        x = np.diff(np.convolve(x, np.ones(40)/40, 'same'), prepend=0); x /= np.abs(x).max() + 1e-9
        return x * np.sin(np.pi * np.arange(n) / n) ** 2
    for c in cortes: add(whoosh(), c - .4, .5, .3)
    fade = np.minimum(t / .4, 1) * np.minimum((duracion - t) / 1.5, 1)
    M = np.stack([L, R], 1) * fade[:, None]; M /= np.abs(M).max(); M *= .8
    with wave.open(salida, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((M * 32767).astype('<i2').tobytes())


def main():
    ep = os.path.abspath(sys.argv[1]); previa = "--previa" in sys.argv
    spec = json.load(open(os.path.join(ep, "guion.json"), encoding="utf-8"))
    tmp = os.path.join(ep, ".tmp"); os.makedirs(tmp, exist_ok=True)
    modelo = preparar_voz(); vel = spec.get("velocidad_voz", 0.92)
    t = INICIO; voces = []
    for i, e in enumerate(spec["escenas"]):
        p = os.path.join(tmp, f"v{i}.wav"); tts(modelo, e["texto"].replace("*", ""), p, vel)
        d = dur(p); e["voz_ini"], e["voz_dur"] = round(t, 3), round(d, 3)
        e["ini"] = 0 if i == 0 else round(t - PAUSA / 2, 3)
        voces.append((p, t)); t += d + PAUSA
    duracion = round(t - PAUSA + COLA, 2)
    for i, e in enumerate(spec["escenas"]):
        e["fin"] = spec["escenas"][i + 1]["ini"] if i + 1 < len(spec["escenas"]) else duracion
    spec["duracion"] = duracion; spec.setdefault("canal", CANAL)
    for e in spec["escenas"]:
        if e.get("imagen"): e["imagen"] = os.path.join(ep, e["imagen"])
    if duracion > 59: print(f"AVISO: dura {duracion}s; YouTube Shorts admite hasta 3 min, pero <60s rinde mejor")
    res = os.path.join(tmp, "spec.json"); json.dump(spec, open(res, "w"), ensure_ascii=False)
    # muestras
    muestras = [round(e["voz_ini"] + e["voz_dur"] * .5, 2) for e in spec["escenas"]]
    sh("node", os.path.join(AQUI, "render.js"), res, os.path.join(tmp, "m.jpg"), "--stills", ",".join(map(str, muestras)))
    ins = []
    for x in muestras: ins += ["-i", os.path.join(tmp, f"m_{x}.jpg")]
    n = len(muestras)
    sh("ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex",
       "".join(f"[{i}]scale=270:480[s{i}];" for i in range(n)) + "".join(f"[s{i}]" for i in range(n)) + f"hstack=inputs={n}",
       os.path.join(ep, "previa.jpg"))
    sh("cp", os.path.join(tmp, f"m_{muestras[0]}.jpg"), os.path.join(ep, "miniatura.jpg"))
    print(f"previa.jpg lista ({duracion}s, {n} escenas)")
    if previa: return
    # audio
    musica(os.path.join(tmp, "musica.wav"), duracion, [e["ini"] for e in spec["escenas"][1:]], seed=len(spec["titulo"]))
    ins = ["-i", os.path.join(tmp, "musica.wav")]; fc = ""
    for j, (p, st) in enumerate(voces):
        ins += ["-i", p]; fc += f"[{j+1}]adelay={int(st*1000)}:all=1[a{j}];"
    nv = len(voces)
    fc += "".join(f"[a{j}]" for j in range(nv)) + f"amix=inputs={nv}:normalize=0,aresample=44100,pan=stereo|c0=c0|c1=c0," \
          "acompressor=threshold=-18dB:ratio=3:makeup=4,asplit[v][vs];[0][vs]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[m];" \
          f"[m]volume=0.5[mm];[v][mm]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,apad=whole_dur={duracion},atrim=0:{duracion}[out]"
    sh("ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", fc, "-map", "[out]", "-ar", "44100", os.path.join(tmp, "mezcla.wav"))
    # vídeo
    sh("node", os.path.join(AQUI, "render.js"), res, os.path.join(tmp, "video.mp4"))
    sh("ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(tmp, "video.mp4"), "-i", os.path.join(tmp, "mezcla.wav"),
       "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", os.path.join(ep, "short.mp4"))
    # ficha de publicación
    cred = []
    for e in spec["escenas"]:
        if e.get("imagen"):
            cf = os.path.join(os.path.dirname(e["imagen"]), "creditos.json")
            if os.path.exists(cf):
                for c in json.load(open(cf)):
                    if c["archivo"] == os.path.basename(e["imagen"]) and c not in cred: cred.append(c)
    creditos = "\n".join(f"- {c['titulo']} — {c['autor']} ({c['licencia']}) {c['fuente']}" for c in cred)
    desc = spec["descripcion"] + ("\n\nImágenes:\n" + creditos if creditos else "") + "\nVoz: síntesis de voz (Piper). Música original."
    open(os.path.join(ep, "PUBLICAR.md"), "w", encoding="utf-8").write(
        f"# Listo para subir\n\n**Archivo:** `short.mp4` ({duracion} s, 1080×1920)\n\n## Título\n```\n{spec['titulo']}\n```\n\n"
        f"## Descripción\n```\n{desc}\n```\n\n## Etiquetas\n```\n{', '.join(spec.get('etiquetas', []))}\n```\n\n"
        "## Al subir\n- Contenido alterado o sintético: **No** hace falta marcarlo (no muestra personas ni hechos reales falsos), "
        "pero la voz es sintética; márcalo si prefieres ser transparente.\n- Público: no es contenido para niños.\n")
    sh("rm", "-rf", tmp)
    print("OK ->", os.path.join(ep, "short.mp4"))


if __name__ == "__main__":
    main()
