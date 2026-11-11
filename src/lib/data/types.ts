export type CommercialStatus = "current" | "in_stores" | "legacy" | "discontinued" | "unverified";
export type NewsLabel = "official" | "analysis" | "rumor" | "leak";

export interface Brand {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  website_url: string | null;
  logo_url: string | null;
  description: string | null;
  is_featured: boolean;
}

export interface Family {
  id: string;
  brand_id: string;
  slug: string;
  name: string;
  segment: string | null;
  description: string | null;
}

export interface ModelImage {
  url: string | null;
  storage_path: string | null;
  alt: string;
  is_official: boolean;
  is_placeholder: boolean;
  verified: boolean;
  credit: string | null;
  source_url: string | null;
}

export interface ModelCard {
  id: string;
  slug: string;
  name: string;
  generation: string | null;
  release_year: number | null;
  category: string | null;
  commercial_status: CommercialStatus;
  is_featured: boolean;
  popularity: number;
  brand: Pick<Brand, "slug" | "name"> | null;
  family: Pick<Family, "slug" | "name"> | null;
  images: ModelImage[];
}

export interface NewsCard {
  id: string;
  slug: string;
  title: string;
  summary_es: string;
  category: string;
  label: NewsLabel;
  image_url: string | null;
  image_authorized: boolean;
  published_at: string;
  source: { name: string } | null;
}

export interface ReviewCard {
  id: string;
  rating: number;
  title: string;
  body: string;
  is_professional: boolean;
  created_at: string;
  model: { slug: string; name: string } | null;
  author: { display_name: string | null; username: string | null } | null;
}

export interface ComparisonCard {
  id: string;
  slug: string;
  title: string | null;
  variant_ids: string[];
}

/** Result wrapper: lets the UI distinguish "no data yet" from "backend not configured". */
export type DataResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_configured" | "error"; data: T };
