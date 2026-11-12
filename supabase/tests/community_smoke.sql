-- Community rules (run after stubs + migrations + seed). Each check prints PASS/FAIL.
\set ON_ERROR_STOP 0
\pset tuples_only on
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;
grant execute on all functions in schema public to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1','old@example.com','{}'),
  ('00000000-0000-0000-0000-0000000000b2','new@example.com','{}'),
  ('00000000-0000-0000-0000-0000000000c3','c@example.com','{}'),
  ('00000000-0000-0000-0000-0000000000d4','d@example.com','{}');
update public.profiles set created_at = now() - interval '3 days' where id <> '00000000-0000-0000-0000-0000000000b2';
insert into public.models (brand_id, slug, name, published) select id, 'community-test', 'Community TEST', true from public.brands where slug = 'lenovo';

create temp table results (name text, ok boolean);
grant all on results to authenticated;

set role authenticated;
-- old account review → visible
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
insert into public.reviews (model_id,user_id,rating,title,body,experience_tags)
  select id, auth.uid(), 4, 'Buena para clase', repeat('Experiencia real de uso. ',3), '{estudios}' from public.models where slug='community-test';
insert into results select 'old account review visible', status='visible' from public.reviews where user_id=auth.uid();
-- user cannot change protected fields
update public.reviews set status='visible', likes_count=99, is_professional=true where user_id=auth.uid();
insert into results select 'protected fields unchanged', likes_count=0 and not is_professional from public.reviews where user_id=auth.uid();
-- self like is rejected
do $$ begin
  insert into public.likes (user_id,target_type,target_id) select auth.uid(),'review',id from public.reviews where user_id=auth.uid();
  insert into results values ('self like rejected', false);
exception when others then insert into results values ('self like rejected', true); end $$;

-- new account review → pending (fake-review protection)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',false);
insert into public.reviews (model_id,user_id,rating,title,body)
  select id, auth.uid(), 5, 'Increíble', repeat('Texto de cuenta nueva. ',3) from public.models where slug='community-test';
insert into results select 'new account review pending', status='pending' from public.reviews where user_id=auth.uid();
-- like someone else's visible review → counter +1, unlike → 0
insert into public.likes (user_id,target_type,target_id) select auth.uid(),'review',id from public.reviews where user_id='00000000-0000-0000-0000-0000000000a1';
insert into results select 'like increments counter', likes_count=1 from public.reviews where user_id='00000000-0000-0000-0000-0000000000a1';
insert into results select 'like does not mark review as edited', updated_at = created_at from public.reviews where user_id='00000000-0000-0000-0000-0000000000a1';
delete from public.likes where user_id=auth.uid();
insert into results select 'unlike decrements counter', likes_count=0 from public.reviews where user_id='00000000-0000-0000-0000-0000000000a1';
-- comment + reply ok, reply to reply rejected
insert into public.comments (model_id, review_id, user_id, body)
  select r.model_id, r.id, auth.uid(), 'Pregunta sobre la batería' from public.reviews r where r.user_id='00000000-0000-0000-0000-0000000000a1';
insert into public.comments (model_id, review_id, parent_id, user_id, body)
  select c.model_id, c.review_id, c.id, auth.uid(), 'Respuesta' from public.comments c where c.parent_id is null;
insert into results select 'one-level reply allowed', count(*)=2 from public.comments;
do $$ begin
  insert into public.comments (model_id, review_id, parent_id, user_id, body)
    select c.model_id, c.review_id, c.id, auth.uid(), 'Respuesta anidada' from public.comments c where c.parent_id is not null;
  insert into results values ('nested reply rejected', false);
exception when others then insert into results values ('nested reply rejected', true); end $$;
-- self report rejected
do $$ begin
  insert into public.reports (reporter_id,target_type,target_id,reason) select auth.uid(),'comment',id,'spam' from public.comments where user_id=auth.uid() limit 1;
  insert into results values ('self report rejected', false);
exception when others then insert into results values ('self report rejected', true); end $$;

-- 3 reports from different users auto-hide the review (regression: used to be reverted by the protect trigger)
do $$ declare u text; begin
  foreach u in array array['00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000d4'] loop
    perform set_config('request.jwt.claim.sub', u, false);
    insert into public.reports (reporter_id,target_type,target_id,reason)
      select auth.uid(),'review',id,'spam' from public.reviews where user_id='00000000-0000-0000-0000-0000000000a1';
  end loop;
end $$;
reset role;
insert into results select 'three reports auto-hide review', status='hidden' from public.reviews where user_id='00000000-0000-0000-0000-0000000000a1';
insert into results select 'rating stats exclude hidden/pending', not exists (select 1 from public.model_rating_stats s join public.models m on m.id=s.model_id where m.slug='community-test');

select case when ok then 'PASS ' else 'FAIL ' end || name from results;
