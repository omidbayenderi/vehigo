-- ========== OPPORTUNITY AGENTS ==========
-- Scout kaynaklardan ilan bulur, Analyst fırsat skorlar, Notifier patrona bildirir.

alter table listing_alerts
  add column if not exists opportunity_score int check (opportunity_score between 0 and 100),
  add column if not exists opportunity_label text check (opportunity_label in ('hot','good','watch','low')),
  add column if not exists opportunity_reasons jsonb;

alter table watchlists
  add column if not exists target_price numeric(12,2),
  add column if not exists must_have_keywords text[] default '{}',
  add column if not exists excluded_keywords text[] default '{}';
