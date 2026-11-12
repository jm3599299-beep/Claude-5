-- Fase 4: derechos de imagen.
-- Una imagen solo puede mostrarse si tiene una base de derechos documentada.
create type public.image_rights_basis as enum (
  'cc0',                -- dominio público / CC0
  'cc-by',              -- Creative Commons Attribution (requiere autor y enlace a licencia)
  'cc-by-sa',           -- Creative Commons Attribution-ShareAlike
  'written-permission', -- permiso escrito del titular (documentado en rights_reference)
  'own'                 -- foto propia de LaptopVerse
);

alter table public.images
  add column rights_basis public.image_rights_basis,
  add column license_url text,
  add column author text,
  add column rights_reference text,   -- p. ej. nº de expediente/correo del permiso escrito
  add column rights_verified_at timestamptz,
  add column checked_at timestamptz,  -- última comprobación técnica (URL accesible, tipo, tamaño)
  add column content_type text,
  add column bytes integer;

-- Imágenes verificadas: deben tener base de derechos y fecha de verificación.
alter table public.images add constraint images_verified_requires_rights
  check (not verified or (rights_basis is not null and rights_verified_at is not null));
-- Licencias con atribución: autor y URL de la licencia obligatorios.
alter table public.images add constraint images_attribution_complete
  check (rights_basis is null or rights_basis not in ('cc-by', 'cc-by-sa') or (author is not null and license_url is not null));
-- Permiso escrito: referencia obligatoria.
alter table public.images add constraint images_permission_documented
  check (rights_basis is distinct from 'written-permission' or rights_reference is not null);
-- Formatos permitidos (los mismos que el bucket de Storage).
alter table public.images add constraint images_content_type_allowed
  check (content_type is null or content_type in ('image/jpeg','image/png','image/webp','image/avif'));
