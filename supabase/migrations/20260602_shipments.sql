create table if not exists shipments (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users (id) on delete cascade,
  conversation_id  uuid        references conversations (id) on delete set null,
  title            text,
  corridor         text,
  status           text        not null default 'active' check (status in ('active','completed','archived')),
  extracted_data   jsonb,
  risk_score       integer,
  risk_category    text,
  invoice_number   text,
  invoice_date     date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists shipments_user_status_idx  on shipments (user_id, status);
create index if not exists shipments_corridor_idx      on shipments (corridor);
create index if not exists shipments_conversation_idx  on shipments (conversation_id);

alter table shipments enable row level security;

create policy "Users can manage their own shipments"
  on shipments for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger shipments_updated_at
  before update on shipments
  for each row execute procedure update_updated_at();
