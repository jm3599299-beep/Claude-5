-- Fase 7: noticias automáticas
alter table public.news_feeds
  add column images_authorized boolean not null default false, -- solo si los términos de la fuente permiten reutilizar sus imágenes
  add column notes text;

-- Noticias: «oficial» solo si la fuente es oficial (coherencia de la etiqueta)
create or replace function public.check_news_label()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.label = 'official' and not exists (select 1 from public.sources s where s.id = new.source_id and s.is_official) then
    raise exception 'Solo las fuentes oficiales pueden etiquetarse como «oficial»';
  end if;
  if new.status = 'published' and (new.summary_es is null or char_length(trim(new.summary_es)) < 20) then
    raise exception 'No se puede publicar una noticia sin resumen en español';
  end if;
  if new.image_url is not null and not new.image_authorized then
    new.image_url := null; -- nunca se guarda una imagen sin autorización
  end if;
  return new;
end;
$$;
create trigger news_label_check before insert or update on public.news_articles
  for each row execute function public.check_news_label();

create index news_weekly_idx on public.news_articles (weekly_issue_id);
create index news_category_idx on public.news_articles (category, published_at desc);

-- Corrección: el bloqueo de cambio de rol aplica a los usuarios de la API (anon/authenticated),
-- no a las conexiones de administración (editor SQL de Supabase, service_role, migraciones).
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- PostgREST runs every API request with `set role anon|authenticated`.
  if (new.role is distinct from old.role or new.is_banned is distinct from old.is_banned)
     and current_setting('role', true) in ('anon', 'authenticated')
     and not public.is_admin() then
    raise exception 'No autorizado para cambiar rol o estado';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
