-- =====================================================================
-- LaptopVerse — esquema inicial
-- Principios:
--   * Ningún dato se presenta como verificado sin fuente (source_id) y
--     marca de verificación.
--   * Los precios almacenados son SIEMPRE precios observados reales en su
--     moneda original. Las conversiones se calculan al vuelo y se marcan.
--   * Row Level Security en todas las tablas.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.user_role as enum ('user', 'moderator', 'editor', 'admin');
create type public.commercial_status as enum (
  'current',       -- comercializado actualmente por el fabricante (verificado)
  'in_stores',     -- ya no lo vende el fabricante, pero hay stock en tiendas (verificado)
  'legacy',        -- modelo antiguo
  'discontinued',  -- descatalogado oficialmente
  'unverified'     -- estado sin comprobar
);
create type public.laptop_category as enum (
  'gaming', 'business', 'ultrabook', 'workstation', 'student', 'creator',
  '2in1', 'chromebook', 'rugged', 'budget', 'mainstream'
);
create type public.source_kind as enum (
  'manufacturer', 'press_center', 'retailer', 'media', 'rss', 'api', 'community', 'other'
);
create type public.price_kind as enum ('launch', 'official', 'store');
create type public.news_label as enum ('official', 'analysis', 'rumor', 'leak');
create type public.news_status as enum ('pending', 'approved', 'rejected', 'published');
create type public.moderation_status as enum ('pending', 'visible', 'hidden', 'removed');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.content_target as enum ('review', 'comment', 'photo', 'news', 'profile');

-- ---------------------------------------------------------------------
-- Perfiles y roles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  avatar_url text,
  country_code char(2),
  preferred_currency char(3) default 'USD',
  role public.user_role not null default 'user',
  is_banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_role_is(roles public.user_role[])
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = any (roles) and not p.is_banned
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable as $$
  select public.current_role_is(array['moderator','editor','admin']::public.user_role[]);
$$;

create or replace function public.is_editor()
returns boolean language sql stable as $$
  select public.current_role_is(array['editor','admin']::public.user_role[]);
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.current_role_is(array['admin']::public.user_role[]);
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and not is_banned);
$$;

-- Crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impedir que un usuario cambie su propio rol o estado de baneo
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.is_banned is distinct from old.is_banned)
     and not public.is_admin() and current_user <> 'service_role' then
    raise exception 'No autorizado para cambiar rol o estado';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- ---------------------------------------------------------------------
-- Fuentes (procedencia de todo dato)
-- ---------------------------------------------------------------------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.source_kind not null,
  homepage_url text,
  is_official boolean not null default false,
  trust_level smallint not null default 3 check (trust_level between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  country text,
  founded_year smallint,
  website_url text,
  logo_url text,
  description text,
  is_featured boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  segment text,
  description text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug)
);

-- Componentes reutilizables
create table public.cpus (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,        -- Intel, AMD, Apple, Qualcomm, MediaTek
  model text not null,               -- p.ej. "Core Ultra 7 155H"
  architecture text,                 -- p.ej. "Meteor Lake"
  process_node text,
  cores smallint,
  performance_cores smallint,
  efficiency_cores smallint,
  threads smallint,
  base_clock_ghz numeric(4,2),
  boost_clock_ghz numeric(4,2),
  tdp_w numeric(5,1),
  npu_tops numeric(6,1),
  source_id uuid references public.sources (id),
  unique (manufacturer, model)
);

create table public.gpus (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  model text not null,
  is_integrated boolean not null default false,
  vram_gb numeric(5,1),
  vram_type text,
  tgp_min_w numeric(5,1),
  tgp_max_w numeric(5,1),
  source_id uuid references public.sources (id),
  unique (manufacturer, model)
);

create table public.models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  family_id uuid references public.families (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  generation text,
  release_year smallint check (release_year between 1980 and 2100),
  release_date date,
  category public.laptop_category,
  use_cases text[] not null default '{}',
  commercial_status public.commercial_status not null default 'unverified',
  status_verified_at timestamptz,
  status_source_id uuid references public.sources (id),
  summary text,
  pros text[] not null default '{}',
  cons text[] not null default '{}',
  performance_notes text,
  thermals_notes text,
  upgradeability_notes text,
  build_quality_score smallint check (build_quality_score between 1 and 10),
  is_featured boolean not null default false,
  popularity integer not null default 0,
  official_url text,
  published boolean not null default false,
  search tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un estado "current"/"in_stores" exige fecha y fuente de verificación
  constraint status_requires_verification check (
    commercial_status not in ('current', 'in_stores')
    or (status_verified_at is not null and status_source_id is not null)
  )
);
create index models_brand_idx on public.models (brand_id);
create index models_family_idx on public.models (family_id);
create index models_search_idx on public.models using gin (search);
create index models_name_trgm on public.models using gin (name gin_trgm_ops);

-- Variantes: cada configuración con sus propias especificaciones
create table public.variants (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models (id) on delete cascade,
  sku text,
  name text not null,
  region text,
  cpu_id uuid references public.cpus (id),
  gpu_id uuid references public.gpus (id),
  igpu_id uuid references public.gpus (id),
  -- RAM
  ram_gb smallint,
  ram_type text,
  ram_speed_mts integer,
  ram_slots smallint,
  ram_soldered_gb smallint,
  ram_max_gb smallint,
  -- Almacenamiento
  storage_gb integer,
  storage_type text,
  storage_interface text,
  storage_slots smallint,
  storage_free_slots smallint,
  storage_upgradeable boolean,
  -- Pantalla
  display_size_in numeric(4,1),
  display_resolution text,
  display_panel text,
  display_refresh_hz smallint,
  display_brightness_nits smallint,
  display_color_gamut text,
  display_touch boolean,
  -- Otros
  battery_wh numeric(5,1),
  battery_life_claim text,
  charger_w smallint,
  weight_kg numeric(5,3),
  dimensions_mm text,
  materials text,
  keyboard text,
  webcam text,
  ports text[] not null default '{}',
  wifi text,
  bluetooth text,
  os text,
  cooling text,
  security_features text[] not null default '{}',
  extra jsonb not null default '{}',
  is_default boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, sku)
);
create index variants_model_idx on public.variants (model_id);

-- Procedencia por campo de especificación (qué dato viene de qué fuente)
create table public.spec_sources (
  variant_id uuid not null references public.variants (id) on delete cascade,
  field text not null,
  source_id uuid not null references public.sources (id),
  source_url text,
  verified boolean not null default false,
  verified_at timestamptz,
  verified_by uuid references public.profiles (id),
  primary key (variant_id, field)
);

-- ---------------------------------------------------------------------
-- Imágenes
-- ---------------------------------------------------------------------
create table public.images (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models (id) on delete cascade,
  variant_id uuid references public.variants (id) on delete set null,
  url text,
  storage_path text,
  alt text not null,
  angle text,                         -- front, side, back, open, keyboard, ports...
  width integer,
  height integer,
  is_official boolean not null default false,
  is_placeholder boolean not null default false,
  source_id uuid references public.sources (id),
  source_url text,
  license text,
  credit text,
  verified boolean not null default false,
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  check (url is not null or storage_path is not null),
  -- Una imagen oficial debe tener fuente
  check (not is_official or (source_id is not null and source_url is not null))
);
create index images_model_idx on public.images (model_id);

-- ---------------------------------------------------------------------
-- Divisas, países, tiendas, precios
-- ---------------------------------------------------------------------
create table public.currencies (
  code char(3) primary key,
  name text not null,
  symbol text not null
);

create table public.countries (
  code char(2) primary key,
  name text not null,
  currency_code char(3) not null references public.currencies (code)
);

create table public.exchange_rates (
  id bigint generated always as identity primary key,
  base char(3) not null references public.currencies (code),
  quote char(3) not null references public.currencies (code),
  rate numeric(18,8) not null check (rate > 0),
  provider text not null,
  rate_date date not null,
  fetched_at timestamptz not null default now(),
  unique (base, quote, rate_date, provider)
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  homepage_url text,
  country_code char(2) references public.countries (code),
  source_id uuid references public.sources (id),
  is_official boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.prices (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants (id) on delete cascade,
  kind public.price_kind not null,
  store_id uuid references public.stores (id),
  country_code char(2) not null references public.countries (code),
  currency_code char(3) not null references public.currencies (code),
  amount numeric(12,2) not null check (amount > 0),
  product_url text,
  in_stock boolean,
  observed_at timestamptz not null,
  source_id uuid not null references public.sources (id),
  created_at timestamptz not null default now(),
  check (kind <> 'store' or store_id is not null)
);
create index prices_variant_idx on public.prices (variant_id, observed_at desc);

-- Resumen por variante/país/moneda de precios REALES de tienda (no convertidos)
create view public.price_stats with (security_invoker = true) as
select
  variant_id,
  country_code,
  currency_code,
  min(amount) as min_amount,
  max(amount) as max_amount,
  case when count(*) >= 3 then round(avg(amount), 2) end as avg_amount, -- solo con datos suficientes
  count(*) as samples,
  max(observed_at) as last_observed_at
from public.prices
where kind = 'store' and observed_at > now() - interval '90 days'
group by variant_id, country_code, currency_code;

-- Último tipo de cambio por par
create view public.latest_exchange_rates with (security_invoker = true) as
select distinct on (base, quote) base, quote, rate, provider, rate_date, fetched_at
from public.exchange_rates
order by base, quote, rate_date desc, fetched_at desc;

-- ---------------------------------------------------------------------
-- Noticias
-- ---------------------------------------------------------------------
create table public.news_feeds (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  feed_url text not null unique,
  default_category text,
  default_label public.news_label not null default 'analysis',
  enabled boolean not null default true,
  auto_publish boolean not null default false, -- solo fuentes que superen verificaciones
  keywords text[] not null default '{}',
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table public.weekly_issues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  week_start date not null unique,
  week_end date not null,
  title text not null,
  intro_es text,
  sections jsonb not null default '[]',
  is_quiet_week boolean not null default false,
  status public.news_status not null default 'pending',
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.news_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  original_title text,
  summary_es text not null,
  category text not null,
  label public.news_label not null,
  source_id uuid not null references public.sources (id),
  feed_id uuid references public.news_feeds (id) on delete set null,
  original_url text not null unique,
  dedupe_key text not null unique,      -- hash de URL canónica / título normalizado
  image_url text,
  image_credit text,
  image_authorized boolean not null default false,
  published_at timestamptz not null,    -- fecha de publicación de la fuente
  collected_at timestamptz not null default now(),
  verification jsonb not null default '{}',
  status public.news_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_notes text,
  weekly_issue_id uuid references public.weekly_issues (id) on delete set null,
  importance smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index news_published_idx on public.news_articles (status, published_at desc);

-- ---------------------------------------------------------------------
-- Comunidad
-- ---------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models (id) on delete cascade,
  variant_id uuid references public.variants (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 30 and 8000),
  experience_tags text[] not null default '{}',
  usage_months smallint check (usage_months between 0 and 240),
  observed_temp_c smallint check (observed_temp_c between 0 and 120),
  observed_battery_h numeric(4,1) check (observed_battery_h between 0 and 48),
  is_professional boolean not null default false, -- solo asignable por staff
  status public.moderation_status not null default 'visible',
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, user_id)
);
create index reviews_model_idx on public.reviews (model_id, created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models (id) on delete cascade,
  review_id uuid references public.reviews (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text,
  body text not null check (char_length(body) between 2 and 4000),
  status public.moderation_status not null default 'visible',
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_model_idx on public.comments (model_id, created_at desc);

create table public.user_photos (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  caption text check (char_length(caption) <= 300),
  status public.moderation_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.content_target not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.content_target not null,
  target_id uuid not null,
  reason text not null check (reason in ('spam','fake','offensive','off_topic','copyright','other')),
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

-- ---------------------------------------------------------------------
-- Cuentas: favoritos, listas, comparaciones, seguimiento, notificaciones
-- ---------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  model_id uuid not null references public.models (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, model_id)
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.list_items (
  list_id uuid not null references public.lists (id) on delete cascade,
  model_id uuid not null references public.models (id) on delete cascade,
  note text,
  added_at timestamptz not null default now(),
  primary key (list_id, model_id)
);

create table public.comparisons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  user_id uuid references public.profiles (id) on delete set null,
  variant_ids uuid[] not null check (cardinality(variant_ids) between 2 and 4),
  title text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.follows (
  user_id uuid not null references public.profiles (id) on delete cascade,
  model_id uuid not null references public.models (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, model_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  link text,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.view_history (
  user_id uuid not null references public.profiles (id) on delete cascade,
  model_id uuid not null references public.models (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, model_id)
);

-- ---------------------------------------------------------------------
-- Operación: auditoría, tareas, límites de solicitudes
-- ---------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  table_name text not null,
  row_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,                 -- news_weekly, exchange_rates, prices_import...
  status text not null check (status in ('running','success','partial','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}',
  error text
);

create table public.rate_limit_hits (
  key text not null,
  hit_at timestamptz not null default now()
);
create index rate_limit_key_idx on public.rate_limit_hits (key, hit_at);

-- Devuelve true si se permite la acción; registra el intento.
create or replace function public.check_rate_limit(p_action text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  k text := p_action || ':' || coalesce(auth.uid()::text, 'anon');
  n integer;
begin
  delete from public.rate_limit_hits where hit_at < now() - interval '1 day';
  select count(*) into n from public.rate_limit_hits
   where key = k and hit_at > now() - make_interval(secs => p_window_seconds);
  if n >= p_max then return false; end if;
  insert into public.rate_limit_hits (key) values (k);
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Triggers genéricos
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create or replace function public.audit_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor_id, table_name, row_id, action, old_data, new_data)
  values (
    auth.uid(), tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', null),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['brands','families','models','variants','news_articles','reviews','comments']
  loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
  foreach t in array array['brands','families','models','variants','cpus','gpus','images','prices','news_articles','news_feeds','weekly_issues','sources','stores']
  loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_changes()', t, t);
  end loop;
end $$;

-- Índice de búsqueda de modelos
create or replace function public.models_search_refresh()
returns trigger language plpgsql as $$
begin
  new.search :=
    setweight(to_tsvector('simple', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.generation, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(new.summary, '')), 'C');
  return new;
end;
$$;
create trigger models_search before insert or update on public.models
  for each row execute function public.models_search_refresh();

-- Los usuarios normales no pueden marcar su reseña como profesional ni cambiar contadores
create or replace function public.protect_review_fields()
returns trigger language plpgsql as $$
begin
  if not public.is_staff() then
    if tg_op = 'INSERT' then
      new.is_professional := false; new.status := 'visible'; new.likes_count := 0;
    else
      new.is_professional := old.is_professional; new.status := old.status; new.likes_count := old.likes_count;
    end if;
  end if;
  return new;
end;
$$;
create trigger reviews_protect before insert or update on public.reviews
  for each row execute function public.protect_review_fields();

create or replace function public.protect_comment_fields()
returns trigger language plpgsql as $$
begin
  if not public.is_staff() then
    if tg_op = 'INSERT' then new.status := 'visible'; new.likes_count := 0;
    else new.status := old.status; new.likes_count := old.likes_count; end if;
  end if;
  return new;
end;
$$;
create trigger comments_protect before insert or update on public.comments
  for each row execute function public.protect_comment_fields();

create or replace function public.protect_photo_fields()
returns trigger language plpgsql as $$
begin
  if not public.is_staff() then
    if tg_op = 'INSERT' then new.status := 'pending'; else new.status := old.status; end if;
  end if;
  return new;
end;
$$;
create trigger user_photos_protect before insert or update on public.user_photos
  for each row execute function public.protect_photo_fields();

-- Ocultar automáticamente contenido con 3+ reportes abiertos
create or replace function public.auto_hide_reported()
returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  select count(*) into n from public.reports
   where target_type = new.target_type and target_id = new.target_id and status = 'open';
  if n >= 3 then
    if new.target_type = 'review' then update public.reviews set status = 'hidden' where id = new.target_id;
    elsif new.target_type = 'comment' then update public.comments set status = 'hidden' where id = new.target_id;
    elsif new.target_type = 'photo' then update public.user_photos set status = 'hidden' where id = new.target_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger reports_auto_hide after insert on public.reports
  for each row execute function public.auto_hide_reported();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sources enable row level security;
alter table public.brands enable row level security;
alter table public.families enable row level security;
alter table public.cpus enable row level security;
alter table public.gpus enable row level security;
alter table public.models enable row level security;
alter table public.variants enable row level security;
alter table public.spec_sources enable row level security;
alter table public.images enable row level security;
alter table public.currencies enable row level security;
alter table public.countries enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.stores enable row level security;
alter table public.prices enable row level security;
alter table public.news_feeds enable row level security;
alter table public.weekly_issues enable row level security;
alter table public.news_articles enable row level security;
alter table public.reviews enable row level security;
alter table public.comments enable row level security;
alter table public.user_photos enable row level security;
alter table public.likes enable row level security;
alter table public.reports enable row level security;
alter table public.favorites enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.comparisons enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.view_history enable row level security;
alter table public.audit_log enable row level security;
alter table public.sync_runs enable row level security;
alter table public.rate_limit_hits enable row level security;

-- Perfiles: lectura pública de datos básicos, edición propia
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- Catálogo y referencia: lectura pública (publicado), escritura de editores
do $$
declare t text;
begin
  foreach t in array array['sources','cpus','gpus','currencies','countries','exchange_rates','stores','prices','spec_sources']
  loop
    execute format('create policy %I_read on public.%I for select using (true)', t, t);
    execute format('create policy %I_write on public.%I for all using (public.is_editor()) with check (public.is_editor())', t, t);
  end loop;
end $$;

create policy brands_read on public.brands for select using (published or public.is_staff());
create policy brands_write on public.brands for all using (public.is_editor()) with check (public.is_editor());
create policy families_read on public.families for select using (published or public.is_staff());
create policy families_write on public.families for all using (public.is_editor()) with check (public.is_editor());
create policy models_read on public.models for select using (published or public.is_staff());
create policy models_write on public.models for all using (public.is_editor()) with check (public.is_editor());
create policy variants_read on public.variants for select using (
  (published and exists (select 1 from public.models m where m.id = model_id and m.published)) or public.is_staff()
);
create policy variants_write on public.variants for all using (public.is_editor()) with check (public.is_editor());
create policy images_read on public.images for select using (
  exists (select 1 from public.models m where m.id = model_id and m.published) or public.is_staff()
);
create policy images_write on public.images for all using (public.is_editor()) with check (public.is_editor());

-- Noticias: solo publicadas son públicas
create policy news_read on public.news_articles for select using (status = 'published' or public.is_staff());
create policy news_write on public.news_articles for all using (public.is_editor()) with check (public.is_editor());
create policy weekly_read on public.weekly_issues for select using (status = 'published' or public.is_staff());
create policy weekly_write on public.weekly_issues for all using (public.is_editor()) with check (public.is_editor());
create policy feeds_staff on public.news_feeds for all using (public.is_editor()) with check (public.is_editor());

-- Reseñas / comentarios / fotos
create policy reviews_read on public.reviews for select using (status = 'visible' or user_id = auth.uid() or public.is_staff());
create policy reviews_insert on public.reviews for insert with check (user_id = auth.uid() and public.is_active_user());
create policy reviews_update on public.reviews for update using (user_id = auth.uid() or public.is_staff());
create policy reviews_delete on public.reviews for delete using (user_id = auth.uid() or public.is_staff());

create policy comments_read on public.comments for select using (status = 'visible' or user_id = auth.uid() or public.is_staff());
create policy comments_insert on public.comments for insert with check (user_id = auth.uid() and public.is_active_user());
create policy comments_update on public.comments for update using (user_id = auth.uid() or public.is_staff());
create policy comments_delete on public.comments for delete using (user_id = auth.uid() or public.is_staff());

create policy photos_read on public.user_photos for select using (status = 'visible' or user_id = auth.uid() or public.is_staff());
create policy photos_insert on public.user_photos for insert with check (user_id = auth.uid() and public.is_active_user());
create policy photos_update on public.user_photos for update using (public.is_staff());
create policy photos_delete on public.user_photos for delete using (user_id = auth.uid() or public.is_staff());

create policy likes_read on public.likes for select using (true);
create policy likes_own on public.likes for insert with check (user_id = auth.uid() and public.is_active_user());
create policy likes_delete on public.likes for delete using (user_id = auth.uid());

create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid() and public.is_active_user());
create policy reports_read on public.reports for select using (reporter_id = auth.uid() or public.is_staff());
create policy reports_staff on public.reports for update using (public.is_staff());

-- Datos personales: solo el propietario
create policy favorites_own on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy follows_own on public.follows for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy history_own on public.view_history for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own on public.notifications for select using (user_id = auth.uid());
create policy notifications_mark on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy lists_read on public.lists for select using (is_public or user_id = auth.uid());
create policy lists_own on public.lists for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy list_items_read on public.list_items for select using (
  exists (select 1 from public.lists l where l.id = list_id and (l.is_public or l.user_id = auth.uid()))
);
create policy list_items_own on public.list_items for all using (
  exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
) with check (
  exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
);

-- Comparaciones: compartibles por enlace (lectura pública), creación libre
create policy comparisons_read on public.comparisons for select using (true);
create policy comparisons_insert on public.comparisons for insert with check (
  (user_id is null or user_id = auth.uid()) and not is_featured
);
create policy comparisons_staff on public.comparisons for update using (public.is_editor());
create policy comparisons_delete on public.comparisons for delete using (user_id = auth.uid() or public.is_editor());

-- Operación: solo staff (los jobs usan service_role, que omite RLS)
create policy audit_staff on public.audit_log for select using (public.is_staff());
create policy sync_staff on public.sync_runs for select using (public.is_staff());
-- rate_limit_hits: sin políticas => solo accesible vía función security definer

-- ---------------------------------------------------------------------
-- Datos de referencia (no son datos de producto: son estándares ISO)
-- ---------------------------------------------------------------------
insert into public.currencies (code, name, symbol) values
  ('USD', 'Dólar estadounidense', 'US$'),
  ('DOP', 'Peso dominicano', 'RD$'),
  ('MXN', 'Peso mexicano', 'MX$'),
  ('EUR', 'Euro', '€');

insert into public.countries (code, name, currency_code) values
  ('US', 'Estados Unidos', 'USD'),
  ('DO', 'República Dominicana', 'DOP'),
  ('MX', 'México', 'MXN'),
  ('ES', 'España', 'EUR');

-- ---------------------------------------------------------------------
-- Storage: buckets
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('laptop-images', 'laptop-images', true, 8388608, array['image/jpeg','image/png','image/webp','image/avif']),
  ('user-photos', 'user-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "laptop images public read" on storage.objects for select using (bucket_id = 'laptop-images');
create policy "laptop images editor write" on storage.objects for insert with check (bucket_id = 'laptop-images' and public.is_editor());
create policy "laptop images editor delete" on storage.objects for delete using (bucket_id = 'laptop-images' and public.is_editor());
create policy "user photos public read" on storage.objects for select using (bucket_id = 'user-photos');
-- Los usuarios solo suben a su propia carpeta: user-photos/<uid>/archivo
create policy "user photos own upload" on storage.objects for insert with check (
  bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_user()
);
create policy "user photos own delete" on storage.objects for delete using (
  bucket_id = 'user-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
);
