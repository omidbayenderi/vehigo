-- ========== ORTAK ==========
create table users_profile (
  id uuid primary key references auth.users(id),
  full_name text,
  role text check (role in ('owner','broker','assistant')) default 'broker',
  created_at timestamptz default now()
);

-- ========== 1. ARAÇ İLANLARI ==========
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  source_site text,
  listing_url text,
  seller_name text,
  seller_country text,
  brand text,
  model text,
  year int,
  mileage_km int,
  price numeric(12,2),
  currency text default 'EUR',
  vat_status text check (vat_status in ('vat_included','vat_free','margin_scheme','unknown')),
  vehicle_type text check (vehicle_type in ('truck','trailer','construction','spare_part','bus','other')),
  tech_specs jsonb,
  euro_class text,
  condition text check (condition in ('new','used_excellent','used_good','used_fair','damaged')),
  availability_status text check (availability_status in ('available','reserved','sold','expired')) default 'available',
  notes text,
  created_by uuid references users_profile(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete cascade,
  storage_path text not null,
  is_primary boolean default false,
  sort_order int default 0
);

-- ========== 2. MÜŞTERİ / LEAD ==========
create table leads (
  id uuid primary key default gen_random_uuid(),
  company_or_name text not null,
  city text,
  phone_whatsapp text,
  telegram_handle text,
  instagram_handle text,
  business_type text,
  desired_vehicle_type text,
  budget_min numeric(12,2),
  budget_max numeric(12,2),
  budget_currency text default 'EUR',
  source text check (source in ('instagram','telegram','divar','sheypoor','google_maps','referral','manual')),
  seriousness_score int check (seriousness_score between 0 and 100) default 0,
  status text check (status in
    ('new','contacted','interested','vehicle_proposed','offer_sent',
     'deposit_requested','in_progress','closed_won','closed_lost')) default 'new',
  last_contact_date date,
  notes text,
  created_by uuid references users_profile(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table lead_activity_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  activity_type text,
  detail text,
  performed_by uuid references users_profile(id),
  created_at timestamptz default now()
);

-- ========== 3. EŞLEŞTİRME ==========
create table matches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete cascade,
  match_score int check (match_score between 0 and 100),
  match_reasoning jsonb,
  created_at timestamptz default now(),
  unique (lead_id, vehicle_id)
);

-- ========== 4. TEKLİF / MALİYET ==========
create table offers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  vehicle_id uuid references vehicles(id),
  base_vehicle_price numeric(12,2),
  export_company_fee numeric(12,2) default 0,
  transport_cost numeric(12,2) default 0,
  insurance_cost numeric(12,2) default 0,
  iran_customs_estimate numeric(12,2) default 0,
  internal_service_fee numeric(12,2) default 0,
  commission_type text check (commission_type in ('fixed','percentage')) default 'fixed',
  commission_value numeric(12,2) default 0,
  commission_amount_calculated numeric(12,2),
  final_customer_price numeric(12,2),
  currency text default 'EUR',
  validity_date date,
  delivery_terms text,
  payment_steps text,
  status text check (status in ('draft','sent','accepted','rejected','expired')) default 'draft',
  pdf_storage_path text,
  created_by uuid references users_profile(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== 5. UYUMLULUK / RİSK ==========
create table compliance_checklist (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id) on delete cascade,
  export_legality_checked boolean default false,
  sanctioned_entity_check_done boolean default false,
  vehicle_category_allowed boolean default false,
  documents_checked boolean default false,
  customs_partner_confirmed boolean default false,
  payment_method_agreed boolean default false,
  buyer_identity_verified boolean default false,
  reviewed_by uuid references users_profile(id),
  reviewed_at timestamptz,
  all_clear boolean generated always as (
    export_legality_checked and sanctioned_entity_check_done and
    vehicle_category_allowed and documents_checked and
    customs_partner_confirmed and payment_method_agreed and
    buyer_identity_verified
  ) stored
);

-- ========== 6. MESAJ TASLAKLARI (insan onaylı) ==========
create table message_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  offer_id uuid references offers(id),
  channel text check (channel in ('whatsapp','telegram','instagram')),
  draft_text text,
  status text check (status in ('draft','approved','sent','discarded')) default 'draft',
  approved_by uuid references users_profile(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- ========== AUDIT ==========
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users_profile(id),
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ========== updated_at trigger helper ==========
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger vehicles_set_updated_at before update on vehicles
  for each row execute function set_updated_at();
create trigger leads_set_updated_at before update on leads
  for each row execute function set_updated_at();
create trigger offers_set_updated_at before update on offers
  for each row execute function set_updated_at();

-- ========== new auth user -> profile ==========
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users_profile (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ========== ROW LEVEL SECURITY ==========
alter table users_profile enable row level security;
alter table vehicles enable row level security;
alter table vehicle_images enable row level security;
alter table leads enable row level security;
alter table lead_activity_log enable row level security;
alter table matches enable row level security;
alter table offers enable row level security;
alter table compliance_checklist enable row level security;
alter table message_drafts enable row level security;
alter table audit_log enable row level security;

-- users_profile: herkes kendi profilini görür/günceller
create policy "profile is self-readable" on users_profile
  for select using (auth.uid() = id);
create policy "profile is self-updatable" on users_profile
  for update using (auth.uid() = id);

-- vehicles: giriş yapmış tüm kullanıcılar okuyabilir (küçük ekip, ortak veri havuzu),
-- yazma/güncelleme sadece oluşturan kişide (owner rolü hariç, tüm işlemleri görür)
create policy "vehicles readable by authenticated" on vehicles
  for select using (auth.role() = 'authenticated');
create policy "vehicles insertable by authenticated" on vehicles
  for insert with check (auth.uid() = created_by);
create policy "vehicles updatable by owner or creator" on vehicles
  for update using (
    auth.uid() = created_by
    or exists (select 1 from users_profile where id = auth.uid() and role = 'owner')
  );
create policy "vehicles deletable by owner or creator" on vehicles
  for delete using (
    auth.uid() = created_by
    or exists (select 1 from users_profile where id = auth.uid() and role = 'owner')
  );

create policy "vehicle_images readable by authenticated" on vehicle_images
  for select using (auth.role() = 'authenticated');
create policy "vehicle_images writable by authenticated" on vehicle_images
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- leads: aynı prensip
create policy "leads readable by authenticated" on leads
  for select using (auth.role() = 'authenticated');
create policy "leads insertable by authenticated" on leads
  for insert with check (auth.uid() = created_by);
create policy "leads updatable by owner or creator" on leads
  for update using (
    auth.uid() = created_by
    or exists (select 1 from users_profile where id = auth.uid() and role = 'owner')
  );
create policy "leads deletable by owner or creator" on leads
  for delete using (
    auth.uid() = created_by
    or exists (select 1 from users_profile where id = auth.uid() and role = 'owner')
  );

create policy "lead_activity_log readable by authenticated" on lead_activity_log
  for select using (auth.role() = 'authenticated');
create policy "lead_activity_log insertable by authenticated" on lead_activity_log
  for insert with check (auth.uid() = performed_by);

create policy "matches readable by authenticated" on matches
  for select using (auth.role() = 'authenticated');
create policy "matches writable by authenticated" on matches
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "offers readable by authenticated" on offers
  for select using (auth.role() = 'authenticated');
create policy "offers insertable by authenticated" on offers
  for insert with check (auth.uid() = created_by);
create policy "offers updatable by owner or creator" on offers
  for update using (
    auth.uid() = created_by
    or exists (select 1 from users_profile where id = auth.uid() and role = 'owner')
  );

create policy "compliance_checklist readable by authenticated" on compliance_checklist
  for select using (auth.role() = 'authenticated');
create policy "compliance_checklist writable by non-assistant" on compliance_checklist
  for all using (
    exists (select 1 from users_profile where id = auth.uid() and role in ('owner','broker'))
  ) with check (
    exists (select 1 from users_profile where id = auth.uid() and role in ('owner','broker'))
  );

create policy "message_drafts readable by authenticated" on message_drafts
  for select using (auth.role() = 'authenticated');
create policy "message_drafts writable by non-assistant" on message_drafts
  for all using (
    exists (select 1 from users_profile where id = auth.uid() and role in ('owner','broker'))
  ) with check (
    exists (select 1 from users_profile where id = auth.uid() and role in ('owner','broker'))
  );

create policy "audit_log readable by authenticated" on audit_log
  for select using (auth.role() = 'authenticated');
create policy "audit_log insertable by authenticated" on audit_log
  for insert with check (auth.uid() = actor_id);

-- ========== STORAGE BUCKETS (private) ==========
insert into storage.buckets (id, name, public)
values ('vehicle-images', 'vehicle-images', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('offer-pdfs', 'offer-pdfs', false)
on conflict (id) do nothing;

create policy "vehicle-images readable by authenticated"
  on storage.objects for select
  using (bucket_id = 'vehicle-images' and auth.role() = 'authenticated');
create policy "vehicle-images writable by authenticated"
  on storage.objects for insert
  with check (bucket_id = 'vehicle-images' and auth.role() = 'authenticated');

create policy "offer-pdfs readable by authenticated"
  on storage.objects for select
  using (bucket_id = 'offer-pdfs' and auth.role() = 'authenticated');
create policy "offer-pdfs writable by authenticated"
  on storage.objects for insert
  with check (bucket_id = 'offer-pdfs' and auth.role() = 'authenticated');
