create table if not exists regulations (
  id             uuid        primary key default gen_random_uuid(),
  authority      text        not null,
  corridor       text        not null,
  title          text        not null,
  summary        text        not null,
  source_url     text,
  effective_date date,
  tags           text[]      not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists regulations_corridor_idx  on regulations (corridor);
create index if not exists regulations_authority_idx on regulations (authority);
create index if not exists regulations_tags_gin_idx  on regulations using gin (tags);

alter table regulations enable row level security;

create policy "Authenticated users can read regulations"
  on regulations for select
  to authenticated
  using (true);

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger regulations_updated_at
  before update on regulations
  for each row execute procedure update_updated_at();
