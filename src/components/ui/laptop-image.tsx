import type { ModelImage } from "@/lib/data/types";
import { LogoMark } from "@/components/brand/logo";
import { supabaseUrl } from "@/lib/supabase/env";

export function imageSrc(img: Pick<ModelImage, "url" | "storage_path">): string | null {
  if (img.storage_path && supabaseUrl) return `${supabaseUrl}/storage/v1/object/public/laptop-images/${img.storage_path}`;
  return img.url;
}

/** Picks the first verified, non-placeholder image. */
export function primaryImage(images: ModelImage[] | null | undefined): ModelImage | null {
  return images?.find((i) => i.verified && !i.is_placeholder && imageSrc(i)) ?? null;
}

/**
 * Shows a verified photo, or a clearly-labelled substitute when no verified
 * photo of the exact model exists. Never shows a photo of a similar model.
 */
export function LaptopImage({ image, name, className = "" }: { image: ModelImage | null; name: string; className?: string }) {
  const src = image ? imageSrc(image) : null;
  if (!image || !src) {
    return (
      <div
        className={`relative flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-2 to-surface ${className}`}
        role="img"
        aria-label={`Imagen de sustitución: no hay fotografía verificada de ${name}`}
      >
        <LogoMark className="h-12 w-12 opacity-40" />
        <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
          Imagen de sustitución
        </span>
      </div>
    );
  }
  return (
    <div className={`relative aspect-[4/3] overflow-hidden bg-white ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- sources vary (official CDNs / storage) */}
      <img src={src} alt={image.alt} loading="lazy" decoding="async" className="h-full w-full object-contain p-4" />
      {image.is_official && (
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          Foto oficial
        </span>
      )}
    </div>
  );
}
