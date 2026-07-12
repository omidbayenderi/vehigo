-- Record what a deal actually cost/earned once it closes, so it can be compared
-- against the expected profit (commission_amount_calculated) that was projected
-- at offer time — and reported on by country/source/model.

alter table offers
  add column if not exists actual_total_cost numeric(12,2),
  add column if not exists actual_revenue numeric(12,2),
  add column if not exists closed_outcome text check (closed_outcome in ('won', 'lost')),
  add column if not exists closed_notes text,
  add column if not exists closed_at timestamptz;
