import type { NextConfig } from "next";
import { IMAGE_HOSTS, isLocalSupabase, supabaseStorageHost } from "./src/lib/images/hosts";

const storageHost = supabaseStorageHost();
// Only for local Supabase development (http://localhost:54321); never enabled against a hosted project.
const localSupabase = isLocalSupabase();

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowLocalIP: localSupabase,
    remotePatterns: [
      ...IMAGE_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/**" })),
      ...(storageHost
        ? (["/storage/v1/object/public/**", "/storage/v1/object/sign/user-photos/**"] as const).map((pathname) => ({
            protocol: localSupabase ? ("http" as const) : ("https" as const),
            hostname: storageHost,
            pathname,
          }))
        : []),
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
