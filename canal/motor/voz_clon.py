#!/usr/bin/env python3
"""Narración con la voz clonada del dueño del canal (Chatterbox Multilingual, licencia MIT, corre en local).

Se ejecuta con el Python del entorno virtual que crea produce.py (~/vozenv):
  ~/vozenv/bin/python voz_clon.py referencia.wav trabajos.json
trabajos.json = [{"texto": "...", "salida": "/ruta/v0.wav"}, ...]

Cada frase se transcribe con Whisper y se compara con el texto; si no coincide lo
suficiente (cortes, repeticiones, balbuceos), se regenera hasta 3 veces y se queda la mejor.
"""
import difflib, json, re, sys, unicodedata
import numpy as np, torch, torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from faster_whisper import WhisperModel

torch.set_num_threads(max(1, torch.get_num_threads()))


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    for d, w in NUM.items():
        s = re.sub(rf"\b{d}\b", w, s)
    return re.sub(r"[^a-zñ]+", "", s)  # sin espacios: "me diría" == "mediría"


NUM = {"0": "cero", "1": "uno", "2": "dos", "3": "tres", "4": "cuatro", "5": "cinco", "6": "seis", "7": "siete",
       "8": "ocho", "9": "nueve", "10": "diez", "20": "veinte", "100": "cien", "1000": "mil"}


def main():
    ref, trabajos = sys.argv[1], json.load(open(sys.argv[2]))
    tts = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    asr = WhisperModel("small", device="cpu", compute_type="int8")
    for i, tr in enumerate(trabajos):
        mejor = (-1, None)
        for intento in range(3):
            torch.manual_seed(1234 + 97 * intento + i)
            w = tts.generate(tr["texto"], language_id="es", audio_prompt_path=ref,
                             exaggeration=0.55, cfg_weight=0.45, temperature=0.75)
            a16 = torchaudio.functional.resample(w, tts.sr, 16000)[0].numpy().astype(np.float32)
            oido = " ".join(s.text for s in asr.transcribe(a16, language="es")[0])
            sim = difflib.SequenceMatcher(None, norm(tr["texto"]), norm(oido)).ratio()
            print(f"frase {i+1}/{len(trabajos)} intento {intento+1}: parecido {sim:.2f} | {oido.strip()}", flush=True)
            if sim > mejor[0]:
                mejor = (sim, w)
            if sim >= 0.9:
                break
        if mejor[0] < 0.75:
            print(f"AVISO: la frase {i+1} no salió limpia (parecido {mejor[0]:.2f}); revísala o reescríbela", flush=True)
        torchaudio.save(tr["salida"], mejor[1], tts.sr)


if __name__ == "__main__":
    main()
