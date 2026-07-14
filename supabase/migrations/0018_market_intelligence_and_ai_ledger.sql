create table if not exists market_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references market_listings(id) on delete cascade,
  analysis_version text not null,
  evidence_hash text not null,
  sample_quality text not null check (sample_quality in ('insufficient','low','medium','high')),
  claim_eligible boolean not null default false,
  comparable_count int not null default 0 check (comparable_count >= 0),
  source_count int not null default 0 check (source_count >= 0),
  comparable_listing_ids uuid[] not null default '{}',
  distribution jsonb not null default '{}'::jsonb,
  underpricing_percent numeric(7,2),
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  risk_score int not null default 0 check (risk_score between 0 and 100),
  risk_level text not null default 'unknown' check (risk_level in ('unknown','low','medium','high','critical')),
  risk_signals jsonb not null default '[]'::jsonb,
  seller_signals jsonb not null default '{}'::jsonb,
  price_trend jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (listing_id, analysis_version, evidence_hash)
);

create index if not exists market_intelligence_listing_latest_idx
  on market_intelligence_snapshots (listing_id, calculated_at desc);
create index if not exists market_intelligence_claims_idx
  on market_intelligence_snapshots (claim_eligible, sample_quality, calculated_at desc);

create table if not exists listing_media_rights (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references market_listings(id) on delete cascade,
  image_url text not null,
  rights_status text not null default 'unknown'
    check (rights_status in ('unknown','source_permitted','partner_authorized','user_authorized','prohibited')),
  analysis_allowed boolean not null default false,
  rights_source text,
  checked_by uuid references users_profile(id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, image_url),
  check (not analysis_allowed or rights_status in ('source_permitted','partner_authorized','user_authorized'))
);

create table if not exists ai_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users_profile(id) on delete set null,
  listing_id uuid not null references market_listings(id) on delete cascade,
  intelligence_snapshot_id uuid references market_intelligence_snapshots(id) on delete set null,
  evaluation_type text not null check (evaluation_type in ('market_review','damage_review','listing_summary')),
  status text not null default 'pending' check (status in ('pending','completed','failed','skipped')),
  provider text not null default 'openai',
  model text,
  prompt_version text not null,
  input_evidence jsonb not null default '{}'::jsonb,
  output jsonb,
  confidence numeric(4,3) check (confidence between 0 and 1),
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  cost_usd numeric(12,6) not null default 0 check (cost_usd >= 0),
  provider_response_id text,
  error text,
  human_decision text not null default 'pending'
    check (human_decision in ('pending','accepted','rejected','needs_review')),
  human_decision_reason text,
  reviewed_by uuid references users_profile(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_evaluations_listing_created_idx
  on ai_evaluations (listing_id, created_at desc);
create index if not exists ai_evaluations_user_created_idx
  on ai_evaluations (user_id, created_at desc);
create index if not exists ai_evaluations_monthly_cost_idx
  on ai_evaluations (created_at, provider, status);

drop trigger if exists listing_media_rights_set_updated_at on listing_media_rights;
create trigger listing_media_rights_set_updated_at before update on listing_media_rights
  for each row execute function set_updated_at();
drop trigger if exists ai_evaluations_set_updated_at on ai_evaluations;
create trigger ai_evaluations_set_updated_at before update on ai_evaluations
  for each row execute function set_updated_at();

alter table market_intelligence_snapshots enable row level security;
alter table listing_media_rights enable row level security;
alter table ai_evaluations enable row level security;

drop policy if exists "market intelligence readable by authenticated" on market_intelligence_snapshots;
create policy "market intelligence readable by authenticated" on market_intelligence_snapshots
  for select using (auth.role() = 'authenticated');

drop policy if exists "media rights readable by authenticated" on listing_media_rights;
create policy "media rights readable by authenticated" on listing_media_rights
  for select using (auth.role() = 'authenticated');
drop policy if exists "media rights manageable by owner" on listing_media_rights;
create policy "media rights manageable by owner" on listing_media_rights
  for all using (exists (select 1 from users_profile where id = auth.uid() and role = 'owner'))
  with check (exists (select 1 from users_profile where id = auth.uid() and role = 'owner'));

drop policy if exists "ai evaluations readable by owner" on ai_evaluations;
create policy "ai evaluations readable by owner" on ai_evaluations
  for select using (auth.uid() = user_id or exists (select 1 from users_profile where id = auth.uid() and role = 'owner'));
drop policy if exists "ai evaluations updatable by owner" on ai_evaluations;
create policy "ai evaluations updatable by owner" on ai_evaluations
  for update using (auth.uid() = user_id or exists (select 1 from users_profile where id = auth.uid() and role = 'owner'))
  with check (auth.uid() = user_id or exists (select 1 from users_profile where id = auth.uid() and role = 'owner'));
