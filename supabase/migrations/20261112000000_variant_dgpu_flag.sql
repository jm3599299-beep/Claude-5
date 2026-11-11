-- Distinguir "sin GPU dedicada" (false) de "desconocido" (null).
alter table public.variants add column has_dgpu boolean;
update public.variants set has_dgpu = true where gpu_id is not null;
alter table public.variants add constraint variants_dgpu_consistent
  check (gpu_id is null or has_dgpu is distinct from false);
