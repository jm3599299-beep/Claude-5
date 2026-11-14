#!/usr/bin/env python3
"""Descarga imágenes candidatas libres de derechos para una escena.

Uso: python3 canal/motor/imagenes.py "black hole" DIR_SALIDA [--n 6] [--fuente nasa|commons]

- nasa: images-api.nasa.gov (dominio público; la NASA pide no implicar respaldo).
- commons: Wikimedia Commons (licencias libres; se guardan autor y licencia para los créditos).
Genera DIR/candidatos.jpg (hoja de contactos numerada) y DIR/creditos.json.
"""
import argparse, io, json, os, sys, urllib.parse, urllib.request
from PIL import Image, ImageDraw, ImageFont

UA = {"User-Agent": "canal-shorts-bot/1.0 (generador de video educativo)"}


def get(url, timeout=40):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()


def nasa(q, n):
    d = json.loads(get("https://images-api.nasa.gov/search?" + urllib.parse.urlencode({"q": q, "media_type": "image"})))
    out = []
    for it in d.get("collection", {}).get("items", []):
        if not it.get("links"):
            continue
        thumb = it["links"][0]["href"]
        meta = it.get("data", [{}])[0]
        out.append({
            "urls": [thumb.replace("~thumb", s) for s in ("~large", "~medium", "~orig")] + [thumb],
            "titulo": meta.get("title", ""), "autor": meta.get("secondary_creator") or meta.get("center") or "NASA",
            "licencia": "Dominio público (NASA)", "fuente": f"https://images.nasa.gov/details/{meta.get('nasa_id','')}",
        })
        if len(out) >= n * 2:
            break
    return out


def commons(q, n):
    p = {"action": "query", "format": "json", "generator": "search", "gsrsearch": f"filetype:bitmap {q}",
         "gsrnamespace": 6, "gsrlimit": n * 2, "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 1600}
    d = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p)))
    out = []
    for pg in sorted(d.get("query", {}).get("pages", {}).values(), key=lambda x: x.get("index", 0)):
        ii = pg.get("imageinfo", [{}])[0]
        em = ii.get("extmetadata", {})
        strip = lambda s: __import__("re").sub("<[^>]+>", "", s or "").strip()
        out.append({
            "urls": [ii.get("thumburl") or ii.get("url")], "titulo": pg.get("title", ""),
            "autor": strip(em.get("Artist", {}).get("value")) or "Wikimedia Commons",
            "licencia": strip(em.get("LicenseShortName", {}).get("value")), "fuente": ii.get("descriptionurl", ""),
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("consulta"); ap.add_argument("salida")
    ap.add_argument("--n", type=int, default=6); ap.add_argument("--fuente", default="nasa", choices=["nasa", "commons"])
    a = ap.parse_args()
    os.makedirs(a.salida, exist_ok=True)
    cands = (nasa if a.fuente == "nasa" else commons)(a.consulta, a.n)
    guardadas, creditos = [], []
    for c in cands:
        if len(guardadas) >= a.n:
            break
        for u in c["urls"]:
            try:
                im = Image.open(io.BytesIO(get(u))).convert("RGB")
            except Exception:
                continue
            if min(im.size) < 400:
                continue
            im.thumbnail((1800, 1800))
            k = len(guardadas) + 1
            p = os.path.join(a.salida, f"{k}.jpg")
            im.save(p, quality=90)
            guardadas.append(p); creditos.append({"archivo": f"{k}.jpg", **{x: c[x] for x in ("titulo", "autor", "licencia", "fuente")}})
            break
    json.dump(creditos, open(os.path.join(a.salida, "creditos.json"), "w"), ensure_ascii=False, indent=1)
    if not guardadas:
        print("sin resultados", file=sys.stderr); sys.exit(1)
    # hoja de contactos numerada
    W = 300; tiles = []
    for p in guardadas:
        im = Image.open(p); im.thumbnail((W, W)); t = Image.new("RGB", (W, W), "black")
        t.paste(im, ((W - im.width) // 2, (W - im.height) // 2)); tiles.append(t)
    sheet = Image.new("RGB", (W * min(3, len(tiles)), W * ((len(tiles) + 2) // 3)), "black")
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40)
    for i, t in enumerate(tiles):
        d = ImageDraw.Draw(t); d.text((10, 5), str(i + 1), font=f, fill="yellow", stroke_width=3, stroke_fill="black")
        sheet.paste(t, ((i % 3) * W, (i // 3) * W))
    sheet.save(os.path.join(a.salida, "candidatos.jpg"), quality=80)
    print(f"{len(guardadas)} imágenes en {a.salida} (ver candidatos.jpg)")


if __name__ == "__main__":
    main()
