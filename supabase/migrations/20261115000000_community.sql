-- Fase 6: comunidad (reseñas, comentarios, me gusta, reportes, fotos de usuarios)

-- 1. Reseñas: campos protegidos y moderación previa para cuentas nuevas (< 24 h),
--    como protección contra reseñas falsas. Las actualizaciones hechas por otros
--    triggers (contador de me gusta) no se bloquean (pg_trigger_depth() > 1).
create or replace function public.protect_review_fields()
returns trigger language plpgsql security definer set search_path = public as $$
declare account_age interval;
begin
  if pg_trigger_depth() > 1 or public.is_staff() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    select now() - p.created_at into account_age from public.profiles p where p.id = new.user_id;
    new.is_professional := false;
    new.status := case when account_age is null or account_age < interval '24 hours' then 'pending' else 'visible' end;
    new.likes_count := 0;
  else
    new.is_professional := old.is_professional;
    new.likes_count := old.likes_count;
    new.status := old.status;
    new.user_id := old.user_id;
    new.model_id := old.model_id;
  end if;
  return new;
end;
$$;

create or replace function public.protect_comment_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or public.is_staff() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'visible';
    new.likes_count := 0;
  else
    new.status := old.status;
    new.likes_count := old.likes_count;
    new.user_id := old.user_id;
    new.model_id := old.model_id;
    new.review_id := old.review_id;
    new.parent_id := old.parent_id;
  end if;
  return new;
end;
$$;

-- 2. Comentarios: hilos de un solo nivel, siempre dentro del mismo modelo/reseña
create or replace function public.check_comment_thread()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent public.comments;
begin
  if new.review_id is not null then
    perform 1 from public.reviews r where r.id = new.review_id and r.model_id = new.model_id;
    if not found then raise exception 'La reseña no pertenece a este modelo'; end if;
  end if;
  if new.parent_id is not null then
    select * into parent from public.comments where id = new.parent_id;
    if parent.id is null then raise exception 'Comentario padre inexistente'; end if;
    if parent.parent_id is not null then raise exception 'Solo se permite un nivel de respuestas'; end if;
    if parent.model_id <> new.model_id or parent.review_id is distinct from new.review_id then
      raise exception 'La respuesta debe pertenecer al mismo hilo';
    end if;
  end if;
  return new;
end;
$$;
create trigger comments_thread before insert on public.comments
  for each row execute function public.check_comment_thread();

-- 3. Contadores de «me gusta» mantenidos por la base de datos
create or replace function public.sync_likes_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.content_target; tid uuid; delta int;
begin
  if tg_op = 'INSERT' then t := new.target_type; tid := new.target_id; delta := 1;
  else t := old.target_type; tid := old.target_id; delta := -1; end if;
  if t = 'review' then
    update public.reviews set likes_count = greatest(0, likes_count + delta) where id = tid;
  elsif t = 'comment' then
    update public.comments set likes_count = greatest(0, likes_count + delta) where id = tid;
  end if;
  return null;
end;
$$;
create trigger likes_count_sync after insert or delete on public.likes
  for each row execute function public.sync_likes_count();

-- Solo se puede dar «me gusta» a contenido visible y ajeno
create or replace function public.check_like_target()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if new.target_type = 'review' then
    select user_id into owner from public.reviews where id = new.target_id and status = 'visible';
  elsif new.target_type = 'comment' then
    select user_id into owner from public.comments where id = new.target_id and status = 'visible';
  else
    raise exception 'Este tipo de contenido no admite me gusta';
  end if;
  if owner is null then raise exception 'Contenido no disponible'; end if;
  if owner = new.user_id then raise exception 'No puedes dar me gusta a tu propio contenido'; end if;
  return new;
end;
$$;
create trigger likes_target_check before insert on public.likes
  for each row execute function public.check_like_target();

-- 4. Valoración agregada por modelo (opiniones de usuarios y pruebas profesionales por separado)
create view public.model_rating_stats with (security_invoker = true) as
select
  model_id,
  count(*) filter (where not is_professional) as user_reviews,
  round(avg(rating) filter (where not is_professional), 2) as user_avg,
  count(*) filter (where is_professional) as pro_reviews,
  round(avg(rating) filter (where is_professional), 2) as pro_avg
from public.reviews
where status = 'visible'
group by model_id;

-- 5. Reportes: el contenido debe existir y no ser propio
create or replace function public.check_report_target()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if new.target_type = 'review' then select user_id into owner from public.reviews where id = new.target_id;
  elsif new.target_type = 'comment' then select user_id into owner from public.comments where id = new.target_id;
  elsif new.target_type = 'photo' then select user_id into owner from public.user_photos where id = new.target_id;
  else raise exception 'Tipo de reporte no admitido';
  end if;
  if owner is null then raise exception 'Contenido no encontrado'; end if;
  if owner = new.reporter_id then raise exception 'No puedes reportar tu propio contenido'; end if;
  return new;
end;
$$;
create trigger reports_target_check before insert on public.reports
  for each row execute function public.check_report_target();

-- 6. Fotos de usuarios: bucket privado. Solo se pueden leer fotos aprobadas (o propias / staff),
--    servidas con URLs firmadas temporales. Antes de la aprobación no son accesibles públicamente.
update storage.buckets set public = false where id = 'user-photos';
drop policy if exists "user photos public read" on storage.objects;
create policy "user photos read approved" on storage.objects for select using (
  bucket_id = 'user-photos' and (
    exists (select 1 from public.user_photos p where p.storage_path = storage.objects.name and p.status = 'visible')
    or (storage.foldername(name))[1] = auth.uid()::text
    or public.is_staff()
  )
);

-- 7. «Editada» solo cuando cambia el contenido (no al cambiar contadores de me gusta o el estado de moderación)
create or replace function public.touch_content_updated_at()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'reviews' then
    if (new.title, new.body, new.rating, new.experience_tags, new.variant_id, new.usage_months, new.observed_temp_c, new.observed_battery_h)
       is distinct from (old.title, old.body, old.rating, old.experience_tags, old.variant_id, old.usage_months, old.observed_temp_c, old.observed_battery_h) then
      new.updated_at := now();
    else
      new.updated_at := old.updated_at;
    end if;
  elsif tg_table_name = 'comments' then
    new.updated_at := case when new.body is distinct from old.body then now() else old.updated_at end;
  end if;
  return new;
end;
$$;
drop trigger if exists reviews_touch on public.reviews;
drop trigger if exists comments_touch on public.comments;
create trigger reviews_touch before update on public.reviews for each row execute function public.touch_content_updated_at();
create trigger comments_touch before update on public.comments for each row execute function public.touch_content_updated_at();
