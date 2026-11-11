"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X, ZoomIn } from "lucide-react";

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  angle: string | null;
  isOfficial: boolean;
  credit: string | null;
  sourceUrl: string | null;
  license: string | null;
}

const angleLabels: Record<string, string> = {
  front: "Frontal",
  side: "Lateral",
  back: "Trasera",
  top: "Superior",
  open: "Abierta",
  keyboard: "Teclado",
  ports: "Puertos",
  closed: "Cerrada",
};

function Provenance({ img }: { img: GalleryImage }) {
  return (
    <p className="text-xs text-fg-muted">
      {img.isOfficial ? "Foto oficial" : "Foto verificada"}
      {img.credit && <> · © {img.credit}</>}
      {img.license && <> · {img.license}</>}
      {img.sourceUrl && (
        <>
          {" · "}
          <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
            Fuente <ExternalLink className="h-3 w-3" />
          </a>
        </>
      )}
    </p>
  );
}

export function Gallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const current = images[index];

  const go = useCallback((d: number) => setIndex((i) => (i + d + images.length) % images.length), [images.length]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [go]);

  if (!current) return null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="group relative block w-full overflow-hidden rounded-2xl border border-border bg-white"
        aria-label={`Ampliar imagen: ${current.alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- official CDNs vary */}
        <img src={current.src} alt={current.alt} className="aspect-[4/3] w-full object-contain p-6" />
        <span className="absolute right-3 top-3 rounded-lg bg-black/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100">
          <ZoomIn className="h-4 w-4" />
        </span>
        {current.angle && (
          <span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
            {angleLabels[current.angle] ?? current.angle}
          </span>
        )}
      </button>
      <Provenance img={current} />
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Miniaturas">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver imagen ${i + 1}: ${img.alt}`}
                aria-current={i === index}
                className={`h-16 w-20 overflow-hidden rounded-lg border-2 bg-white ${i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        aria-label={`Galería de ${name}`}
        className="m-auto max-h-[95vh] w-[min(1200px,95vw)] rounded-2xl bg-surface p-0 text-fg backdrop:bg-black/80"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="relative bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.src} alt={current.alt} className="max-h-[80vh] w-full object-contain" />
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Cerrar" className="absolute right-3 top-3 rounded-lg bg-black/60 p-2 text-white">
            <X className="h-5 w-5" />
          </button>
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Anterior" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Siguiente" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white">
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Provenance img={current} />
          <span className="text-xs text-fg-muted">
            {index + 1} / {images.length}
          </span>
        </div>
      </dialog>
    </div>
  );
}
