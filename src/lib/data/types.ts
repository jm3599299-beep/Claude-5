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

export interface Cpu {
  manufacturer: string;
  model: string;
  architecture: string | null;
  process_node: string | null;
  cores: number | null;
  performance_cores: number | null;
  efficiency_cores: number | null;
  threads: number | null;
  base_clock_ghz: number | null;
  boost_clock_ghz: number | null;
  tdp_w: number | null;
  npu_tops: number | null;
}

export interface Gpu {
  manufacturer: string;
  model: string;
  is_integrated: boolean;
  vram_gb: number | null;
  vram_type: string | null;
  tgp_min_w: number | null;
  tgp_max_w: number | null;
}

export interface SpecSource {
  field: string;
  verified: boolean;
  source_url: string | null;
  verified_at: string | null;
  source: { name: string; is_official: boolean } | null;
}

export interface Variant {
  id: string;
  variant_key: string;
  sku: string | null;
  name: string;
  region: string | null;
  is_default: boolean;
  cpu: Cpu | null;
  gpu: Gpu | null;
  igpu: Gpu | null;
  /** null = desconocido, false = no tiene GPU dedicada */
  has_dgpu: boolean | null;
  ram_gb: number | null;
  ram_type: string | null;
  ram_speed_mts: number | null;
  ram_slots: number | null;
  ram_soldered_gb: number | null;
  ram_max_gb: number | null;
  storage_gb: number | null;
  storage_type: string | null;
  storage_interface: string | null;
  storage_slots: number | null;
  storage_free_slots: number | null;
  storage_upgradeable: boolean | null;
  display_size_in: number | null;
  display_resolution: string | null;
  display_panel: string | null;
  display_refresh_hz: number | null;
  display_brightness_nits: number | null;
  display_color_gamut: string | null;
  display_touch: boolean | null;
  battery_wh: number | null;
  battery_life_claim: string | null;
  charger_w: number | null;
  weight_kg: number | null;
  dimensions_mm: string | null;
  materials: string | null;
  keyboard: string | null;
  webcam: string | null;
  ports: string[];
  wifi: string | null;
  bluetooth: string | null;
  os: string | null;
  cooling: string | null;
  security_features: string[];
  spec_sources: SpecSource[];
}

export interface ModelDetail extends Omit<ModelCard, "images"> {
  release_date: string | null;
  use_cases: string[];
  status_verified_at: string | null;
  status_source: { name: string; homepage_url: string | null } | null;
  summary: string | null;
  pros: string[];
  cons: string[];
  performance_notes: string | null;
  thermals_notes: string | null;
  upgradeability_notes: string | null;
  official_url: string | null;
  updated_at: string;
  brand: Pick<Brand, "slug" | "name"> | null;
  family: Pick<Family, "slug" | "name"> | null;
  images: (ModelImage & { id: string; angle: string | null; license: string | null; sort_order: number; variant_id: string | null })[];
  variants: Variant[];
}
