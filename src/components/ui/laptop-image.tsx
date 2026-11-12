import Image from "next/image";
import type { ModelImage } from "@/lib/data/types";
import { LogoMark } from "@/components/brand/logo";
import { supabaseUrl } from "@/lib/supabase/env";
import { isAllowedImageUrl } from "@/lib/images/hosts";

export function imageSrc(img: Pick<ModelImage, "url" | "storage_path">): string | null {
  if (img.storage_path && supabaseUrl) return `${supabaseUrl}/storage/v1/object/public/laptop-images/${img.storage_path}`;
  return img.url;
}

/**
 * An image may be displayed only if it is verified (exact model), has a
 * documented rights basis, and is served from an authorised host.
 */
export function isDisplayable(img: ModelImage): boolean {
  const src = imageSrc(img);
  return Boolean(img.verified && !img.is_placeholder && img.rights_basis && src && isAllowedImageUrl(src));
}

export function primaryImage(images: ModelImage[] | null | undefined): ModelImage | null {
  return images?.find(isDisplayable) ?? null;
}

/**
 * Shows a verified, rights-cleared photo, or a clearly-labelled substitute.
 * Never shows a photo of a similar model or one without a license.
 */
export function LaptopImage({ image, name, className = "", sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" }: { image: ModelImage | null; name: string; className?: string; sizes?: string }) {
  const src = image && isDisplayable(image) ? imageSrc(image) : null;
  if (!image || !src) {
    return (
      <div
        className={`relative flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-2 to-surface ${className}`}
        role="img"
        aria-label={`Imagen de sustitución: no hay fotografía verificada y con licencia de ${name}`}
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
      <Image src={src} alt={image.alt} fill sizes={sizes} className="object-contain p-4" />
      {image.is_official && (
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">Foto oficial</span>
      )}
    </div>
  );
}
