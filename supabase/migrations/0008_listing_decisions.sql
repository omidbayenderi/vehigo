-- Capture trader feedback so opportunity ranking can improve over time.
alter table listing_alerts
  add column if not exists decision_status text not null default 'new'
    check (decision_status in ('new','shortlisted','rejected','actioned')),
  add column if not exists decision_reason text
    check (decision_reason in ('good_price','right_vehicle','trusted_seller','too_expensive','wrong_vehicle','bad_condition','sold','duplicate','other')),
  add column if not exists decided_at timestamptz;

create index if not exists listing_alerts_user_decision_created_idx
  on listing_alerts (user_id, decision_status, created_at desc);
