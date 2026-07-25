create extension if not exists vector;

drop table if exists public.oxylabs_schedule_runs cascade;
drop table if exists public.oxylabs_schedules cascade;
drop table if exists public.logs cascade;
drop table if exists public.article_analyses cascade;
drop table if exists public.article_sources cascade;
drop table if exists public.article_summaries cascade;
drop table if exists public.article_body cascade;
drop table if exists public.articles cascade;
drop table if exists public.sources cascade;

create table public.sources (
  id text primary key,
  name text not null,
  listing_url text not null,
  parser_strategy text not null default 'generic',
  active boolean not null default true,
  logo_url text,
  created_at timestamptz not null default now()
);

create table public.articles (
  id text primary key,
  source_id text not null references public.sources(id),
  original_url text not null unique,
  canonical_url text,
  title text not null,
  image_url text not null,
  published_at timestamptz not null,
  raw_text text not null default '',
  scraped_at timestamptz not null default now(),
  analyzed_at timestamptz
);

create table public.article_analyses (
  id text primary key,
  article_id text not null unique references public.articles(id) on delete cascade,
  neutral_summary text not null,
  sentiment_score numeric not null check (sentiment_score between -1 and 1),
  sentiment_label text not null check (sentiment_label in ('positive', 'neutral', 'negative')),
  bias_score numeric not null check (bias_score between -1 and 1),
  bias_label text not null check (bias_label in ('left', 'center', 'right', 'mixed', 'unclear')),
  left_percentage integer not null check (left_percentage between 0 and 100),
  center_percentage integer not null check (center_percentage between 0 and 100),
  right_percentage integer not null check (right_percentage between 0 and 100),
  confidence numeric not null check (confidence between 0 and 1),
  framing_notes text not null default '',
  loaded_terms text[] not null default '{}',
  disclaimer text not null default 'AI analysis can make mistakes.',
  model_name text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  constraint article_analyses_percentages_sum check (left_percentage + center_percentage + right_percentage = 100)
);

create table public.logs (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.oxylabs_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_ids text[] not null default '{}',
  cron_expression text not null default '0 * * * *',
  active boolean not null default true,
  external_schedule_id text,
  created_at timestamptz not null default now()
);

create table public.oxylabs_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.oxylabs_schedules(id) on delete set null,
  external_run_id text,
  status text not null default 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists articles_published_at_idx on public.articles (published_at desc);
create index if not exists articles_source_id_idx on public.articles (source_id);
create index if not exists articles_analyzed_at_idx on public.articles (analyzed_at);
create index if not exists schedule_runs_schedule_id_idx on public.oxylabs_schedule_runs (schedule_id);
create index if not exists article_analyses_embedding_idx on public.article_analyses using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function match_related_articles(query_embedding vector(1536), exclude_article_id text, match_count int default 5)
returns table (article_id text)
language sql stable as $$
  select article_id from public.article_analyses
  where embedding is not null and article_id != exclude_article_id
  order by embedding <=> query_embedding
  limit match_count;
$$;

alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.article_analyses enable row level security;
alter table public.logs enable row level security;
alter table public.oxylabs_schedules enable row level security;
alter table public.oxylabs_schedule_runs enable row level security;

grant select on public.sources, public.articles, public.article_analyses to anon, authenticated;
grant all on public.sources, public.articles, public.article_analyses, public.logs, public.oxylabs_schedules, public.oxylabs_schedule_runs to service_role;