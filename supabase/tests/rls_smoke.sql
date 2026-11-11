-- Smoke tests for security rules. Run after stubs + migrations.
grant usage on schema auth to authenticated, anon;
\set ON_ERROR_STOP 0
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;
grant execute on all functions in schema public to authenticated, anon;
insert into auth.users values ('00000000-0000-0000-0000-000000000001','a@example.com','{}');
insert into public.brands (slug,name) values ('test','Test');
insert into public.models (brand_id, slug, name, published) select id,'m1','M1',true from public.brands where slug='test';

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
\echo '--- 1. user tries to make self admin (expect ERROR)'
update public.profiles set role='admin' where id=auth.uid();
\echo '--- 2. user tries to insert a brand (expect RLS ERROR)'
insert into public.brands (slug,name) values ('x','X');
\echo '--- 3. user posts review flagged professional (expect is_professional=f)'
insert into public.reviews (model_id,user_id,rating,title,body,is_professional)
  select id, auth.uid(), 5, 'Muy buena', repeat('texto de prueba ',5), true from public.models;
select is_professional, status from public.reviews;
\echo '--- 4. rate limit 2/min: expect t,t,f'
select public.check_rate_limit('review',2,60), public.check_rate_limit('review',2,60), public.check_rate_limit('review',2,60);
reset role;
\echo '--- 5. current status without source (expect CHECK ERROR)'
update public.models set commercial_status='current';
