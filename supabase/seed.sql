insert into public.sources (id, name, listing_url, parser_strategy, active)
values
  ('reuters', 'Reuters', 'https://www.reuters.com/', 'reuters', true),
  ('bbc', 'BBC News', 'https://www.bbc.com/news', 'bbc', true),
  ('ap', 'Associated Press', 'https://apnews.com/', 'ap', true),
  ('guardian', 'The Guardian', 'https://www.theguardian.com/international', 'guardian', true),
  ('npr', 'NPR', 'https://www.npr.org/', 'npr', true)
on conflict (id) do update set name = excluded.name, listing_url = excluded.listing_url, parser_strategy = excluded.parser_strategy, active = excluded.active;