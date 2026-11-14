#!/usr/bin/env python3
"""Genera edit.jsx (montaje para Higgsedit, el editor de Higgsfield) a partir de:
  - guion.json del episodio (escenas, imágenes, datos grandes)
  - palabras.json: [{"w","a","b"}] tiempos por palabra de la narración (faster-whisper)
Uso: python3 higgsedit_plan.py <carpeta_episodio> palabras.json <duracion_total> > edit.jsx
"""
import json, re, sys, unicodedata

ep, palabras_f, DUR = sys.argv[1], sys.argv[2], float(sys.argv[3])
g = json.load(open(f"{ep}/guion.json", encoding="utf-8"))
W = json.load(open(palabras_f, encoding="utf-8"))


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in s if unicodedata.category(c) != "Mn"))


# arreglos de transcripción ("me diría" -> "mediría")
fix = []
i = 0
while i < len(W):
    w = W[i]
    if i + 1 < len(W) and norm(w["w"]) == "me" and norm(W[i + 1]["w"]).startswith("diria"):
        fix.append({"w": "mediría" + re.sub(r"[\wíÍ]+", "", W[i + 1]["w"]), "a": w["a"], "b": W[i + 1]["b"]}); i += 2; continue
    fix.append(w); i += 1
W = fix

# asignar palabras a escenas por longitud acumulada de texto
NUMS = {"nueve": "9", "seis": "6"}
esc = g["escenas"]
lens = [len(norm(e["texto"]).replace("nueve", "9").replace("seis", "6")) for e in esc]
tot = sum(lens); lim = []; acc = 0
for L in lens:
    acc += L; lim.append(acc / tot)
wl = [len(norm(w["w"])) for w in W]; wt = sum(wl); acc = 0
for w, L in zip(W, wl):
    mid = (acc + L / 2) / wt; acc += L
    w["s"] = next(k for k, x in enumerate(lim) if mid <= x + 1e-9)
ini = [min(w["a"] for w in W if w["s"] == k) for k in range(len(esc))]
for k in range(len(esc)):
    esc[k]["ini"] = 0.0 if k == 0 else round(ini[k] - 0.15, 3)
for k in range(len(esc)):
    esc[k]["fin"] = esc[k + 1]["ini"] if k + 1 < len(esc) else DUR

CLAVE = {"tierra", "agujero", "negro", "canica", "espagueti", "sol", "luna", "puno", "mismo", "milimetros",
         "kilometros", "diminuto", "exactamente", "gravedad", "mano"}
caps = []
for j, w in enumerate(W):
    b = W[j + 1]["a"] if j + 1 < len(W) else w["b"] + 0.5
    b = max(b, w["a"] + 0.18)
    txt = w["w"].strip(" ,.;:¿?¡!").upper()
    if not txt:
        continue
    hot = bool(re.search(r"\d", txt)) or norm(txt) in CLAVE
    caps.append({"t": txt, "a": round(w["a"], 3), "d": round(min(b, w["a"] + 1.2) - w["a"], 3), "hot": hot})

plan = {"dur": DUR, "gancho": g.get("gancho", "").upper(), "cta": g.get("cta", "").upper(),
        "escenas": [{"img": e["imagen"], "ini": e["ini"], "fin": e["fin"], "mov": e.get("mov", "in"),
                     "dato": (e.get("dato") or "").upper()} for e in esc],
        "caps": caps}

import os
print("const EP = " + json.dumps(os.path.abspath(ep)) + "; const CANAL = \"@UniversoEnUnMinuto\";")
print("const PLAN = " + json.dumps(plan, ensure_ascii=False) + ";")
print(r'''
const W = 1080, H = 1920, Y = "#FFD60A";
export default async ({ project }) => {
  const p = await project({ size: "1080x1920", fps: 30, background: "#05050f" });
  const imgs = {};
  for (const e of PLAN.escenas) if (!imgs[e.img]) imgs[e.img] = await p.add(EP + "/" + e.img);
  const D = PLAN.dur;

  // 1) fondos: foto a pantalla completa con zoom/paneo lento y fundido cruzado
  PLAN.escenas.forEach((e, k) => {
    const X = k === 0 ? 0 : 0.35;
    const at = Math.max(0, e.ini - X / 2), dur = Math.min(D, e.fin + 0.2) - at;
    const zin = e.mov !== "out";
    const anim = [
      { property: "scale", from: zin ? 1.0 : 1.16, to: zin ? 1.16 : 1.0, duration: dur, easing: "linear" },
      { property: "offsetX", from: e.mov === "left" ? 40 : e.mov === "right" ? -40 : 0, to: e.mov === "left" ? -40 : e.mov === "right" ? 40 : 0, duration: dur, easing: "linear" },
    ];
    if (k > 0) anim.push({ property: "opacity", from: 0, to: 1, duration: X, easing: "ease-in-out" });
    p.compose(
      <media file={imgs[e.img]} x={0} y={0} width={W} height={H} fit="cover" animate={anim} />,
      { at, dur, name: "foto" + k }
    );
  });

  // 2) degradados para legibilidad + viñeta
  p.compose(
    <rect x={0} y={0} width={W} height={H} fill={{ kind: "linear", angle: 180, stops: [
      { offset: 0, color: "#000000", opacity: 0.6 }, { offset: 0.2, color: "#000000", opacity: 0 },
      { offset: 0.55, color: "#000000", opacity: 0.05 }, { offset: 1, color: "#000000", opacity: 0.8 }] }} />,
    { at: 0, dur: D, name: "degradado" });
  p.compose(
    <rect x={0} y={0} width={W} height={H} fill={{ kind: "radial", stops: [
      { offset: 0.55, color: "#000000", opacity: 0 }, { offset: 1, color: "#000000", opacity: 0.55 }] }} />,
    { at: 0, dur: D, name: "viñeta" });

  // 3) destello en cada corte
  PLAN.escenas.slice(1).forEach((e, k) => p.compose(
    <rect x={0} y={0} width={W} height={H} fill="#ffffff" animate={[{ property: "opacity", from: 0.4, to: 0, duration: 0.22 }]} />,
    { at: e.ini, dur: 0.22, name: "flash" + k }));

  // 4) gancho de la primera escena
  p.compose(
    <text x={60} y={240} width={960} height={520} fontFamily="Anton" fontSize={118} lineHeight={1.08} align="center"
      color="#ffffff" strokeColor="#000000" strokeWidth={14} shadow={{ x: 0, y: 8, blur: 24, color: "#000000" }}
      motion={{ by: "word", from: { opacity: 0, y: 40, scale: 0.6 }, duration: 0.35, overlap: 0.6, easing: "house" }}
      animate={[{ property: "opacity", keyframes: [{ at: 0, value: 1 }, { at: PLAN.escenas[0].fin - 0.45, value: 1 }, { at: PLAN.escenas[0].fin - 0.15, value: 0 }] }]}
    >{PLAN.gancho}</text>,
    { at: 0.1, dur: PLAN.escenas[0].fin - 0.1, name: "gancho" });

  // 5) dato grande de cada escena
  PLAN.escenas.forEach((e, k) => {
    if (!e.dato || k === 0) return;
    const dur = e.fin - e.ini - 0.2;
    const size = e.dato.length > 8 ? 112 : 230;
    p.compose(
      <text x={40} y={size > 150 ? 250 : 330} width={1000} height={size * 1.3} fontFamily="Anton" fontSize={size} align="center"
        color={Y} strokeColor="#000000" strokeWidth={size > 150 ? 18 : 12} shadow={{ x: 0, y: 0, blur: 40, color: "#FFB000" }}
        animate={[
          { property: "scale", keyframes: [{ at: 0, value: 0.3 }, { at: 0.18, value: 1.12 }, { at: 0.3, value: 1 }, { at: dur, value: 1.04 }] },
          { property: "opacity", keyframes: [{ at: 0, value: 0 }, { at: 0.12, value: 1 }, { at: dur - 0.2, value: 1 }, { at: dur, value: 0 }] },
        ]}
      >{e.dato}</text>,
      { at: e.ini + 0.2, dur, name: "dato" + k });
  });

  // 6) subtítulos palabra a palabra
  PLAN.caps.forEach((c, j) => p.compose(
    <text x={40} y={1250} width={1000} height={190} fontFamily="Anton" fontSize={c.t.length > 11 ? 112 : 136} align="center"
      color={c.hot ? Y : "#ffffff"} strokeColor="#000000" strokeWidth={16} shadow={{ x: 0, y: 10, blur: 20, color: "#000000" }}
      animate={[{ property: "scale", keyframes: [{ at: 0, value: 0.72 }, { at: 0.09, value: 1.08 }, { at: 0.16, value: 1 }] }]}
    >{c.t}</text>,
    { at: c.a, dur: c.d, name: "sub" + j }));

  // 7) barra de progreso
  p.compose(<rect x={0} y={0} width={W} height={12} fill="#ffffff" opacity={0.18} />, { at: 0, dur: D, name: "barra-fondo" });
  p.compose(
    <frame x={0} y={0} width={1} height={12} background={Y}
      animate={[{ property: "width", from: 1, to: W, duration: D - 0.01, easing: "linear" }]} />,
    { at: 0, dur: D, name: "barra" });

  // 8) cierre con llamada a la acción y marca del canal
  const last = PLAN.escenas[PLAN.escenas.length - 1];
  p.compose(
    <text x={80} y={1560} width={920} height={130} fontFamily="Montserrat" fontWeight={700} fontSize={50} align="center"
      color="#bfe3ff" strokeColor="#000000" strokeWidth={8}
      animate={[{ property: "opacity", from: 0, to: 1, duration: 0.4 }, { property: "scale", keyframes: [{ at: 0, value: 0.9 }, { at: 0.4, value: 1 }, { at: 1.2, value: 1.04 }, { at: 2, value: 1 }] }]}
    >{PLAN.cta}</text>,
    { at: last.ini + 0.3, dur: D - last.ini - 0.3, name: "cta" });
  p.compose(
    <text x={0} y={1790} width={W} height={60} fontFamily="Montserrat" fontWeight={700} fontSize={32} align="center"
      color="#ffffff" opacity={0.8} strokeColor="#000000" strokeWidth={6}>{CANAL}</text>,
    { at: 0, dur: D, name: "marca" });

  // 9) fundidos de entrada y salida
  p.compose(<rect x={0} y={0} width={W} height={H} fill="#000000" animate={[{ property: "opacity", from: 1, to: 0, duration: 0.25 }]} />, { at: 0, dur: 0.25, name: "fade-in" });
  p.compose(<rect x={0} y={0} width={W} height={H} fill="#000000" animate={[{ property: "opacity", from: 0, to: 1, duration: 0.5 }]} />, { at: D - 0.5, dur: 0.5, name: "fade-out" });

  if (process.env.SOLO_FOTOGRAMAS) {
    for (const t of process.env.SOLO_FOTOGRAMAS.split(",")) await p.frame(+t, `renders/f_${t}.png`);
  } else {
    await p.render("renders/imagen.mp4", { bitrate: 12000000 });
  }
};''')
