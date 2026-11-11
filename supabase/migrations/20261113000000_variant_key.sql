-- Separar el identificador interno de la variante del número de pieza real del fabricante.
-- Muchos fabricantes (p. ej. Apple) publican números de pieza por color/región sin
-- correspondencia 1:1 con una configuración; inventar un SKU sería información falsa.
alter table public.variants add column variant_key text;
update public.variants set variant_key = coalesce(lower(regexp_replace(sku, '[^A-Za-z0-9]+', '-', 'g')), id::text);
alter table public.variants
  alter column variant_key set not null,
  add constraint variants_key_format check (variant_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint variants_model_key_unique unique (model_id, variant_key);
comment on column public.variants.sku is 'Número de pieza real del fabricante (opcional; nunca inventado)';
comment on column public.variants.variant_key is 'Identificador estable de la configuración dentro del modelo (URL ?variante=)';
