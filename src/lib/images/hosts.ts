/**
 * Hosts from which LaptopVerse may display images. Kept deliberately small:
 * every host here must offer content whose license we can document.
 * Manufacturer sites are NOT listed — their terms generally forbid republishing
 * (see docs/DATA_SOURCES.md). Images with written permission are mirrored to Supabase Storage.
 */
export const IMAGE_HOSTS = [
  "upload.wikimedia.org", // Wikimedia Commons (licencias abiertas, metadatos de autor/licencia)
] as const;

export function supabaseStorageHost(url = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  try {
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
}

/** Local Supabase (CLI: `supabase start`) runs on plain HTTP at localhost. */
export function isLocalSupabase(url = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  const host = supabaseStorageHost(url);
  return host === "localhost" || host === "127.0.0.1";
}

export function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const storage = supabaseStorageHost();
    const localStorage = isLocalSupabase() && u.hostname === storage && u.protocol === "http:";
    if (u.protocol !== "https:" && !localStorage) return false;
    if (storage && u.hostname === storage) return u.pathname.startsWith("/storage/v1/object/public/") || u.pathname.startsWith("/storage/v1/object/sign/user-photos/");
    return (IMAGE_HOSTS as readonly string[]).includes(u.hostname);
  } catch {
    return false;
  }
}
