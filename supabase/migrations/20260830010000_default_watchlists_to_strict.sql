-- New alarms should enforce explicitly configured commercial filters by
-- default. Existing discovery alarms remain discovery, but application-level
-- notification quality gates still prevent incomplete price/year/km records
-- from being delivered as opportunities.
alter table public.watchlists
  alter column search_mode set default 'strict';
