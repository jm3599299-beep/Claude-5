#!/usr/bin/env python3
"""Busca en YouTube qué vídeos del nicho están funcionando.

Uso: python3 canal/motor/tendencias.py [--periodo semana|mes|hoy] [--out informe.md] [consultas...]

Lee la página pública de resultados de YouTube (sin API key), filtra por fecha de
subida y ordena por visualizaciones. Saca un informe en Markdown.
"""
import argparse, json, re, sys, urllib.parse, urllib.request

CONSULTAS = [
    "curiosidades del espacio", "misterios del universo", "agujero negro",
    "datos del universo que dan miedo", "planetas extraños", "datos curiosos del espacio",
    "nasa descubrimiento", "el universo es aterrador", "que pasaria si espacio",
]
FILTRO = {"hoy": "EgIIAg%3D%3D", "semana": "EgIIAw%3D%3D", "mes": "EgIIBA%3D%3D", "año": "EgIIBQ%3D%3D"}
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"


def vistas(txt):
    """'1,9 K visualizaciones' / '683.269 visualizaciones' / '8,1 M de ...' -> int"""
    if not txt:
        return 0
    t = txt.replace("\xa0", " ").lower()
    m = re.search(r"([\d.,]+)\s*(k|m|mil|b)?\b", t)
    if not m:
        return 0
    num, suf = m.group(1), m.group(2)
    if suf:
        n = float(num.replace(".", "").replace(",", "."))
        return int(n * {"k": 1e3, "mil": 1e3, "m": 1e6, "b": 1e9}[suf])
    return int(re.sub(r"[.,]", "", num))


def buscar(q, periodo):
    url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(q)}&sp={FILTRO[periodo]}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html)
    if not m:
        return []
    data, res = json.loads(m.group(1)), []

    def walk(o):
        if isinstance(o, dict):
            if "videoRenderer" in o:
                v = o["videoRenderer"]
                res.append({
                    "tipo": "video", "id": v.get("videoId"),
                    "titulo": "".join(r.get("text", "") for r in v.get("title", {}).get("runs", [])),
                    "vistas": vistas(v.get("viewCountText", {}).get("simpleText", "")),
                    "hace": v.get("publishedTimeText", {}).get("simpleText", ""),
                    "canal": "".join(r.get("text", "") for r in v.get("ownerText", {}).get("runs", [])),
                    "duracion": v.get("lengthText", {}).get("simpleText", ""),
                })
            elif "shortsLockupViewModel" in o:
                v = o["shortsLockupViewModel"]
                md = v.get("overlayMetadata", {})
                vid = v.get("onTap", {}).get("innertubeCommand", {}).get("reelWatchEndpoint", {}).get("videoId")
                res.append({
                    "tipo": "short", "id": vid,
                    "titulo": md.get("primaryText", {}).get("content", ""),
                    "vistas": vistas(md.get("secondaryText", {}).get("content", "")),
                    "hace": "", "canal": "", "duracion": "",
                })
            for x in o.values():
                walk(x)
        elif isinstance(o, list):
            for x in o:
                walk(x)

    walk(data)
    for r in res:
        r["consulta"] = q
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("consultas", nargs="*")
    ap.add_argument("--periodo", default="semana", choices=FILTRO)
    ap.add_argument("--out")
    ap.add_argument("--top", type=int, default=40)
    a = ap.parse_args()
    vistos, todos = set(), []
    for q in a.consultas or CONSULTAS:
        try:
            for r in buscar(q, a.periodo):
                if r["id"] and r["id"] not in vistos:
                    vistos.add(r["id"]); todos.append(r)
        except Exception as e:
            print(f"aviso: fallo en '{q}': {e}", file=sys.stderr)
    todos.sort(key=lambda r: -r["vistas"])
    lines = [f"# Tendencias ({a.periodo})\n", "| Vistas | Tipo | Título | Canal | Hace | Consulta |", "|---:|---|---|---|---|---|"]
    for r in todos[: a.top]:
        t = r["titulo"].replace("|", "/")[:110]
        lines.append(f"| {r['vistas']:,} | {r['tipo']} | [{t}](https://youtu.be/{r['id']}) | {r['canal']} | {r['hace']} | {r['consulta']} |".replace(",", "."))
    out = "\n".join(lines) + "\n"
    if a.out:
        open(a.out, "w", encoding="utf-8").write(out)
    print(out)


if __name__ == "__main__":
    main()
