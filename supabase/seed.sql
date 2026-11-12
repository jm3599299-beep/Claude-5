-- LaptopVerse — datos iniciales
-- Solo se siembran marcas y familias (información pública y estable).
-- NO se siembran modelos, especificaciones, precios ni imágenes: esos datos
-- deben importarse desde fuentes verificadas (ver docs/DATA_POLICY.md).

insert into public.brands (slug, name, country, website_url, is_featured, description) values
  ('lenovo',    'Lenovo',    'China',          'https://www.lenovo.com',      true,  null),
  ('hp',        'HP',        'Estados Unidos', 'https://www.hp.com',          true,  null),
  ('dell',      'Dell',      'Estados Unidos', 'https://www.dell.com',        true,  null),
  ('asus',      'ASUS',      'Taiwán',         'https://www.asus.com',        true,  null),
  ('acer',      'Acer',      'Taiwán',         'https://www.acer.com',        true,  null),
  ('msi',       'MSI',       'Taiwán',         'https://www.msi.com',         true,  null),
  ('apple',     'Apple',     'Estados Unidos', 'https://www.apple.com',       true,  null),
  ('samsung',   'Samsung',   'Corea del Sur',  'https://www.samsung.com',     true,  null),
  ('microsoft', 'Microsoft', 'Estados Unidos', 'https://www.microsoft.com',   true,  null),
  ('razer',     'Razer',     'Singapur / Estados Unidos', 'https://www.razer.com', true, null),
  ('gigabyte',  'Gigabyte',  'Taiwán',         'https://www.gigabyte.com',    false, null),
  ('huawei',    'Huawei',    'China',          'https://consumer.huawei.com', false, null),
  ('lg',        'LG',        'Corea del Sur',  'https://www.lg.com',          false, null),
  ('framework', 'Framework', 'Estados Unidos', 'https://frame.work',          false, null),
  ('alienware', 'Alienware', 'Estados Unidos', 'https://www.dell.com/alienware', false, 'Marca de equipos gaming propiedad de Dell.'),
  ('honor',     'HONOR',     'China',          'https://www.honor.com',       false, null),
  ('xiaomi',    'Xiaomi',    'China',          'https://www.mi.com',          false, null),
  ('fujitsu',   'Fujitsu',   'Japón',          'https://www.fujitsu.com',     false, null),
  ('dynabook',  'Dynabook',  'Japón',          'https://dynabook.com',        false, 'Antigua división de PC de Toshiba.'),
  ('panasonic', 'Panasonic', 'Japón',          'https://na.panasonic.com',    false, null),
  ('chuwi',     'Chuwi',     'China',          'https://www.chuwi.com',       false, null)
on conflict (slug) do nothing;

with f(brand, slug, name, segment) as (values
  ('lenovo','thinkpad','ThinkPad','Empresarial'),
  ('lenovo','thinkbook','ThinkBook','Pymes'),
  ('lenovo','ideapad','IdeaPad','Consumo'),
  ('lenovo','yoga','Yoga','Premium / convertibles'),
  ('lenovo','legion','Legion','Gaming'),
  ('lenovo','loq','LOQ','Gaming de entrada'),
  ('hp','elitebook','EliteBook','Empresarial'),
  ('hp','probook','ProBook','Empresarial'),
  ('hp','pavilion','Pavilion','Consumo'),
  ('hp','envy','Envy','Premium'),
  ('hp','spectre','Spectre','Premium'),
  ('hp','victus','Victus','Gaming'),
  ('hp','omen','OMEN','Gaming'),
  ('dell','latitude','Latitude','Empresarial'),
  ('dell','precision','Precision','Workstation'),
  ('dell','inspiron','Inspiron','Consumo'),
  ('dell','xps','XPS','Premium'),
  ('asus','zenbook','Zenbook','Premium'),
  ('asus','vivobook','Vivobook','Consumo'),
  ('asus','expertbook','ExpertBook','Empresarial'),
  ('asus','tuf','TUF Gaming','Gaming'),
  ('asus','rog','ROG','Gaming'),
  ('acer','aspire','Aspire','Consumo'),
  ('acer','swift','Swift','Ultraligeras'),
  ('acer','travelmate','TravelMate','Empresarial'),
  ('acer','nitro','Nitro','Gaming'),
  ('acer','predator','Predator','Gaming'),
  ('apple','macbook-air','MacBook Air','Ultraligeras'),
  ('apple','macbook-pro','MacBook Pro','Profesional'),
  ('msi','stealth','Stealth','Gaming'),
  ('msi','raider','Raider','Gaming'),
  ('msi','titan','Titan','Gaming'),
  ('msi','katana','Katana','Gaming'),
  ('msi','prestige','Prestige','Productividad'),
  ('msi','modern','Modern','Consumo'),
  ('samsung','galaxy-book','Galaxy Book','Consumo / premium'),
  ('microsoft','surface-laptop','Surface Laptop','Premium'),
  ('microsoft','surface-pro','Surface Pro','2 en 1'),
  ('razer','blade','Blade','Gaming'),
  ('gigabyte','aorus','AORUS','Gaming'),
  ('gigabyte','aero','AERO','Creadores'),
  ('huawei','matebook','MateBook','Consumo / premium'),
  ('lg','gram','gram','Ultraligeras'),
  ('framework','laptop','Framework Laptop','Modular'),
  ('honor','magicbook','MagicBook','Consumo'),
  ('xiaomi','xiaomi-book','Xiaomi Book','Consumo'),
  ('fujitsu','lifebook','LIFEBOOK','Empresarial'),
  ('dynabook','portege','Portégé','Empresarial'),
  ('dynabook','tecra','Tecra','Empresarial'),
  ('panasonic','toughbook','TOUGHBOOK','Rugerizada'),
  ('panasonic','lets-note','Let''s note','Empresarial'),
  ('chuwi','corebook','CoreBook','Económica'),
  ('chuwi','herobook','HeroBook','Económica')
)
insert into public.families (brand_id, slug, name, segment)
select b.id, f.slug, f.name, f.segment from f join public.brands b on b.slug = f.brand
on conflict (brand_id, slug) do nothing;

-- Fuentes oficiales de noticias (la ingesta comprueba cada feed antes de usarlo)
insert into public.sources (name, kind, homepage_url, is_official, trust_level) values
  ('Intel Newsroom',  'press_center', 'https://newsroom.intel.com', true, 5),
  ('AMD Newsroom',    'press_center', 'https://www.amd.com/en/newsroom.html', true, 5),
  ('NVIDIA Newsroom', 'press_center', 'https://nvidianews.nvidia.com', true, 5),
  ('Apple Newsroom',  'press_center', 'https://www.apple.com/newsroom/', true, 5),
  ('Lenovo StoryHub', 'press_center', 'https://news.lenovo.com', true, 5),
  ('ASUS Pressroom',  'press_center', 'https://press.asus.com', true, 5),
  ('Qualcomm News',   'press_center', 'https://www.qualcomm.com/news', true, 5);

-- Fuentes y feeds de noticias verificados (respuesta RSS/Atom válida el 2026-11-12).
insert into public.sources (name, kind, homepage_url, is_official, trust_level) values
  ('Windows Blog (Microsoft)', 'press_center', 'https://blogs.windows.com', true, 5),
  ('Dell Blog', 'manufacturer', 'https://www.dell.com/en-us/blog/', true, 4),
  ('The Verge', 'media', 'https://www.theverge.com', false, 4),
  ('Notebookcheck', 'media', 'https://www.notebookcheck.net', false, 4),
  ('Tom''s Hardware', 'media', 'https://www.tomshardware.com', false, 4);

with f(source, url, auto, label, notes) as (values
  ('AMD Newsroom', 'https://ir.amd.com/news-events/press-releases/rss', true, 'official', null),
  ('NVIDIA Newsroom', 'https://nvidianews.nvidia.com/releases.xml', true, 'official', null),
  ('Apple Newsroom', 'https://www.apple.com/newsroom/rss-feed.rss', true, 'official', 'Feed RSS ofrecido para sindicación. Las imágenes NO se reutilizan (términos de apple.com).'),
  ('Lenovo StoryHub', 'https://news.lenovo.com/feed/', true, 'official', null),
  ('Windows Blog (Microsoft)', 'https://blogs.windows.com/feed/', true, 'official', null),
  ('Dell Blog', 'https://www.dell.com/en-us/blog/feed/', false, 'official', 'Blog corporativo: mezcla noticias e historias; revisión editorial.'),
  ('The Verge', 'https://www.theverge.com/rss/laptops/index.xml', false, 'analysis', 'Medio: siempre revisión editorial.'),
  ('Notebookcheck', 'https://www.notebookcheck.net/RSS-Feed-Notebook-Reviews.8156.0.html', false, 'analysis', 'Medio: siempre revisión editorial.'),
  ('Tom''s Hardware', 'https://www.tomshardware.com/feeds.xml', false, 'analysis', 'Medio: siempre revisión editorial.')
)
insert into public.news_feeds (source_id, feed_url, auto_publish, default_label, notes)
select s.id, f.url, f.auto, f.label::public.news_label, f.notes from f join public.sources s on s.name = f.source
on conflict (feed_url) do nothing;
