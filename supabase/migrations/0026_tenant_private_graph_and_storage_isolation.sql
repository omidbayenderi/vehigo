-- Phase 7 / Wave 1: tenant-private graph, platform governance, and Storage isolation.
-- This migration is intentionally additive-first: legacy rows are assigned to the
-- existing vehigo-default organization before tenant constraints are enforced.

-- Platform governance is independent from an organization owner role. Existing
-- legacy owners are bootstrapped once; future organization owners are not promoted.
create table if not exists public.platform_admins (
  user_id uuid primary key references public.users_profile(id) on delete cascade,
  granted_by uuid references public.users_profile(id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now()
);

insert into public.platform_admins (user_id, granted_by, reason)
select profile.id, profile.id, '0026 legacy owner bootstrap'
from public.users_profile profile
where profile.role = 'owner'
on conflict (user_id) do nothing;

alter table public.platform_admins enable row level security;
revoke insert, update, delete on table public.platform_admins from anon, authenticated;

drop policy if exists "platform admins readable by self" on public.platform_admins;
create policy "platform admins readable by self"
  on public.platform_admins for select
  using (user_id = auth.uid());

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins admin
    where admin.user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated, service_role;

-- A user's active organization is changed only through the validated RPC below.
alter table public.users_profile
  add column if not exists active_organization_id uuid
  references public.organizations(id) on delete set null;

update public.users_profile profile
set active_organization_id = (
  select member.organization_id
  from public.organization_members member
  where member.user_id = profile.id and member.status = 'active'
  order by member.joined_at nulls last, member.created_at, member.organization_id
  limit 1
)
where profile.active_organization_id is null;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profile.active_organization_id
  from public.users_profile profile
  join public.organization_members member
    on member.organization_id = profile.active_organization_id
   and member.user_id = profile.id
   and member.status = 'active'
  join public.organizations organization
    on organization.id = member.organization_id
   and organization.status = 'active'
  where profile.id = auth.uid();
$$;

revoke all on function public.current_organization_id() from public;
grant execute on function public.current_organization_id() to authenticated, service_role;

create or replace function public.set_active_organization(p_organization_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_organization_member(p_organization_id) then
    raise exception 'Active organization membership required.';
  end if;

  update public.users_profile
  set active_organization_id = p_organization_id
  where id = auth.uid();

  return p_organization_id;
end
$$;

revoke all on function public.set_active_organization(uuid) from public, anon;
grant execute on function public.set_active_organization(uuid) to authenticated;

-- Tenant roots and direct children all carry organization_id. Keeping the value on
-- every private row makes RLS auditable and allows parent/child tenant consistency.
alter table public.vehicles add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.vehicle_images add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.leads add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.lead_activity_log add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.matches add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.offers add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.compliance_checklist add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.message_drafts add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.watchlists add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.listing_alerts add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.listing_purchase_checklist add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.ai_evaluations add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.export_scenarios add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.export_scenario_results add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();
alter table public.export_scenario_documents add column if not exists organization_id uuid references public.organizations(id) on delete restrict default public.current_organization_id();

do $$
declare
  default_organization_id uuid;
begin
  select id into default_organization_id
  from public.organizations
  where slug = 'vehigo-default';

  if default_organization_id is null then
    raise exception 'vehigo-default organization is required before 0026.';
  end if;

  update public.vehicles set organization_id = default_organization_id where organization_id is null;
  update public.vehicle_images set organization_id = default_organization_id where organization_id is null;
  update public.leads set organization_id = default_organization_id where organization_id is null;
  update public.lead_activity_log set organization_id = default_organization_id where organization_id is null;
  update public.matches set organization_id = default_organization_id where organization_id is null;
  update public.offers set organization_id = default_organization_id where organization_id is null;
  update public.compliance_checklist set organization_id = default_organization_id where organization_id is null;
  update public.message_drafts set organization_id = default_organization_id where organization_id is null;
  update public.watchlists set organization_id = default_organization_id where organization_id is null;
  update public.listing_alerts set organization_id = default_organization_id where organization_id is null;
  update public.listing_purchase_checklist set organization_id = default_organization_id where organization_id is null;
  update public.ai_evaluations set organization_id = default_organization_id where organization_id is null;
  update public.export_scenarios set organization_id = default_organization_id where organization_id is null;
  update public.export_scenario_results set organization_id = default_organization_id where organization_id is null;
  update public.export_scenario_documents set organization_id = default_organization_id where organization_id is null;
end
$$;

alter table public.vehicles alter column organization_id set not null;
alter table public.vehicle_images alter column organization_id set not null;
alter table public.leads alter column organization_id set not null;
alter table public.lead_activity_log alter column organization_id set not null;
alter table public.matches alter column organization_id set not null;
alter table public.offers alter column organization_id set not null;
alter table public.compliance_checklist alter column organization_id set not null;
alter table public.message_drafts alter column organization_id set not null;
alter table public.watchlists alter column organization_id set not null;
alter table public.listing_alerts alter column organization_id set not null;
alter table public.listing_purchase_checklist alter column organization_id set not null;
alter table public.ai_evaluations alter column organization_id set not null;
alter table public.export_scenarios alter column organization_id set not null;
alter table public.export_scenario_results alter column organization_id set not null;
alter table public.export_scenario_documents alter column organization_id set not null;

create index if not exists vehicles_organization_updated_idx on public.vehicles (organization_id, updated_at desc);
create index if not exists leads_organization_updated_idx on public.leads (organization_id, updated_at desc);
create index if not exists offers_organization_created_idx on public.offers (organization_id, created_at desc);
create index if not exists watchlists_organization_user_idx on public.watchlists (organization_id, user_id, active);
create index if not exists listing_alerts_organization_created_idx on public.listing_alerts (organization_id, created_at desc);
create index if not exists ai_evaluations_organization_created_idx on public.ai_evaluations (organization_id, created_at desc);
create index if not exists export_scenarios_organization_updated_idx on public.export_scenarios (organization_id, updated_at desc);

create unique index if not exists vehicles_id_organization_uidx on public.vehicles (id, organization_id);
create unique index if not exists leads_id_organization_uidx on public.leads (id, organization_id);
create unique index if not exists offers_id_organization_uidx on public.offers (id, organization_id);
create unique index if not exists watchlists_id_organization_uidx on public.watchlists (id, organization_id);
create unique index if not exists export_scenarios_id_organization_uidx on public.export_scenarios (id, organization_id);
create unique index if not exists export_scenario_results_id_organization_uidx on public.export_scenario_results (id, organization_id);

alter table public.vehicle_images drop constraint if exists vehicle_images_vehicle_organization_fkey;
alter table public.vehicle_images add constraint vehicle_images_vehicle_organization_fkey foreign key (vehicle_id, organization_id) references public.vehicles(id, organization_id) on delete cascade not valid;
alter table public.lead_activity_log drop constraint if exists lead_activity_log_lead_organization_fkey;
alter table public.lead_activity_log add constraint lead_activity_log_lead_organization_fkey foreign key (lead_id, organization_id) references public.leads(id, organization_id) on delete cascade not valid;
alter table public.matches drop constraint if exists matches_lead_organization_fkey;
alter table public.matches add constraint matches_lead_organization_fkey foreign key (lead_id, organization_id) references public.leads(id, organization_id) on delete cascade not valid;
alter table public.matches drop constraint if exists matches_vehicle_organization_fkey;
alter table public.matches add constraint matches_vehicle_organization_fkey foreign key (vehicle_id, organization_id) references public.vehicles(id, organization_id) on delete cascade not valid;
alter table public.offers drop constraint if exists offers_lead_organization_fkey;
alter table public.offers add constraint offers_lead_organization_fkey foreign key (lead_id, organization_id) references public.leads(id, organization_id) not valid;
alter table public.offers drop constraint if exists offers_vehicle_organization_fkey;
alter table public.offers add constraint offers_vehicle_organization_fkey foreign key (vehicle_id, organization_id) references public.vehicles(id, organization_id) not valid;
alter table public.compliance_checklist drop constraint if exists compliance_offer_organization_fkey;
alter table public.compliance_checklist add constraint compliance_offer_organization_fkey foreign key (offer_id, organization_id) references public.offers(id, organization_id) on delete cascade not valid;
alter table public.message_drafts drop constraint if exists message_drafts_lead_organization_fkey;
alter table public.message_drafts add constraint message_drafts_lead_organization_fkey foreign key (lead_id, organization_id) references public.leads(id, organization_id) on delete cascade not valid;
alter table public.message_drafts drop constraint if exists message_drafts_offer_organization_fkey;
alter table public.message_drafts add constraint message_drafts_offer_organization_fkey foreign key (offer_id, organization_id) references public.offers(id, organization_id) on delete cascade not valid;
alter table public.listing_alerts drop constraint if exists listing_alerts_watchlist_organization_fkey;
alter table public.listing_alerts add constraint listing_alerts_watchlist_organization_fkey foreign key (watchlist_id, organization_id) references public.watchlists(id, organization_id) on delete cascade not valid;
alter table public.export_scenarios drop constraint if exists export_scenarios_vehicle_organization_fkey;
alter table public.export_scenarios add constraint export_scenarios_vehicle_organization_fkey foreign key (vehicle_id, organization_id) references public.vehicles(id, organization_id) not valid;
alter table public.export_scenarios drop constraint if exists export_scenarios_offer_organization_fkey;
alter table public.export_scenarios add constraint export_scenarios_offer_organization_fkey foreign key (offer_id, organization_id) references public.offers(id, organization_id) not valid;
alter table public.export_scenario_results drop constraint if exists export_results_scenario_organization_fkey;
alter table public.export_scenario_results add constraint export_results_scenario_organization_fkey foreign key (scenario_id, organization_id) references public.export_scenarios(id, organization_id) on delete cascade not valid;
alter table public.export_scenario_documents drop constraint if exists export_documents_scenario_organization_fkey;
alter table public.export_scenario_documents add constraint export_documents_scenario_organization_fkey foreign key (scenario_id, organization_id) references public.export_scenarios(id, organization_id) on delete cascade not valid;
alter table public.offers drop constraint if exists offers_export_result_organization_fkey;
alter table public.offers add constraint offers_export_result_organization_fkey foreign key (export_scenario_result_id, organization_id) references public.export_scenario_results(id, organization_id) not valid;

alter table public.vehicle_images validate constraint vehicle_images_vehicle_organization_fkey;
alter table public.lead_activity_log validate constraint lead_activity_log_lead_organization_fkey;
alter table public.matches validate constraint matches_lead_organization_fkey;
alter table public.matches validate constraint matches_vehicle_organization_fkey;
alter table public.offers validate constraint offers_lead_organization_fkey;
alter table public.offers validate constraint offers_vehicle_organization_fkey;
alter table public.compliance_checklist validate constraint compliance_offer_organization_fkey;
alter table public.message_drafts validate constraint message_drafts_lead_organization_fkey;
alter table public.message_drafts validate constraint message_drafts_offer_organization_fkey;
alter table public.listing_alerts validate constraint listing_alerts_watchlist_organization_fkey;
alter table public.export_scenarios validate constraint export_scenarios_vehicle_organization_fkey;
alter table public.export_scenarios validate constraint export_scenarios_offer_organization_fkey;
alter table public.export_scenario_results validate constraint export_results_scenario_organization_fkey;
alter table public.export_scenario_documents validate constraint export_documents_scenario_organization_fkey;
alter table public.offers validate constraint offers_export_result_organization_fkey;

-- One shared listing can have one acquisition checklist per organization.
alter table public.listing_purchase_checklist drop constraint if exists listing_purchase_checklist_listing_id_key;
create unique index if not exists listing_purchase_checklist_org_listing_uidx
  on public.listing_purchase_checklist (organization_id, listing_id);

-- Replace globally-authenticated policies with organization membership policies.
drop policy if exists "vehicles readable by authenticated" on public.vehicles;
drop policy if exists "vehicles insertable by authenticated" on public.vehicles;
drop policy if exists "vehicles updatable by owner or creator" on public.vehicles;
drop policy if exists "vehicles deletable by owner or creator" on public.vehicles;
create policy "vehicles readable by organization members" on public.vehicles for select using (public.is_organization_member(organization_id));
create policy "vehicles insertable by organization members" on public.vehicles for insert with check (public.is_organization_member(organization_id) and created_by = auth.uid());
create policy "vehicles editable by organization brokers" on public.vehicles for update using (public.is_organization_member(organization_id, array['owner','broker'])) with check (public.is_organization_member(organization_id, array['owner','broker']));
create policy "vehicles deletable by organization brokers" on public.vehicles for delete using (public.is_organization_member(organization_id, array['owner','broker']));

drop policy if exists "vehicle_images readable by authenticated" on public.vehicle_images;
drop policy if exists "vehicle_images writable by authenticated" on public.vehicle_images;
create policy "vehicle images readable by organization members" on public.vehicle_images for select using (public.is_organization_member(organization_id));
create policy "vehicle images writable by organization brokers" on public.vehicle_images for all using (public.is_organization_member(organization_id, array['owner','broker'])) with check (public.is_organization_member(organization_id, array['owner','broker']));

drop policy if exists "leads readable by authenticated" on public.leads;
drop policy if exists "leads insertable by authenticated" on public.leads;
drop policy if exists "leads updatable by owner or creator" on public.leads;
drop policy if exists "leads deletable by owner or creator" on public.leads;
create policy "leads readable by organization members" on public.leads for select using (public.is_organization_member(organization_id));
create policy "leads insertable by organization members" on public.leads for insert with check (public.is_organization_member(organization_id) and created_by = auth.uid());
create policy "leads editable by organization members" on public.leads for update using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy "leads deletable by organization brokers" on public.leads for delete using (public.is_organization_member(organization_id, array['owner','broker']));

drop policy if exists "lead_activity_log readable by authenticated" on public.lead_activity_log;
drop policy if exists "lead_activity_log insertable by authenticated" on public.lead_activity_log;
create policy "lead activity readable by organization members" on public.lead_activity_log for select using (public.is_organization_member(organization_id));
create policy "lead activity insertable by organization members" on public.lead_activity_log for insert with check (public.is_organization_member(organization_id) and performed_by = auth.uid());

drop policy if exists "matches readable by authenticated" on public.matches;
drop policy if exists "matches writable by authenticated" on public.matches;
create policy "matches readable by organization members" on public.matches for select using (public.is_organization_member(organization_id));
create policy "matches writable by organization members" on public.matches for all using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

drop policy if exists "offers readable by authenticated" on public.offers;
drop policy if exists "offers insertable by authenticated" on public.offers;
drop policy if exists "offers updatable by owner or creator" on public.offers;
drop policy if exists "offers deletable by owner or creator" on public.offers;
create policy "offers readable by organization members" on public.offers for select using (public.is_organization_member(organization_id));
create policy "offers insertable by organization members" on public.offers for insert with check (public.is_organization_member(organization_id) and created_by = auth.uid());
create policy "offers editable by organization brokers" on public.offers for update using (public.is_organization_member(organization_id, array['owner','broker'])) with check (public.is_organization_member(organization_id, array['owner','broker']));
create policy "offers deletable by organization brokers" on public.offers for delete using (public.is_organization_member(organization_id, array['owner','broker']));

drop policy if exists "compliance_checklist readable by authenticated" on public.compliance_checklist;
drop policy if exists "compliance_checklist writable by non-assistant" on public.compliance_checklist;
create policy "compliance readable by organization members" on public.compliance_checklist for select using (public.is_organization_member(organization_id));
create policy "compliance writable by organization brokers" on public.compliance_checklist for all using (public.is_organization_member(organization_id, array['owner','broker'])) with check (public.is_organization_member(organization_id, array['owner','broker']));

drop policy if exists "message_drafts readable by authenticated" on public.message_drafts;
drop policy if exists "message_drafts writable by non-assistant" on public.message_drafts;
create policy "message drafts readable by organization members" on public.message_drafts for select using (public.is_organization_member(organization_id));
create policy "message drafts writable by organization brokers" on public.message_drafts for all using (public.is_organization_member(organization_id, array['owner','broker'])) with check (public.is_organization_member(organization_id, array['owner','broker']));

drop policy if exists "watchlists readable by owner" on public.watchlists;
drop policy if exists "watchlists insertable by owner" on public.watchlists;
drop policy if exists "watchlists updatable by owner" on public.watchlists;
drop policy if exists "watchlists deletable by owner" on public.watchlists;
create policy "watchlists readable by organization members" on public.watchlists for select using (public.is_organization_member(organization_id));
create policy "watchlists insertable by organization members" on public.watchlists for insert with check (public.is_organization_member(organization_id) and user_id = auth.uid());
create policy "watchlists editable by owner user" on public.watchlists for update using (public.is_organization_member(organization_id) and user_id = auth.uid()) with check (public.is_organization_member(organization_id) and user_id = auth.uid());
create policy "watchlists deletable by owner user" on public.watchlists for delete using (public.is_organization_member(organization_id) and user_id = auth.uid());

drop policy if exists "listing_alerts readable by owner" on public.listing_alerts;
drop policy if exists "listing_alerts updatable by owner" on public.listing_alerts;
create policy "listing alerts readable by organization members" on public.listing_alerts for select using (public.is_organization_member(organization_id));
create policy "listing alerts insertable by organization members" on public.listing_alerts for insert with check (public.is_organization_member(organization_id) and user_id = auth.uid());
create policy "listing alerts editable by owner user" on public.listing_alerts for update using (public.is_organization_member(organization_id) and user_id = auth.uid()) with check (public.is_organization_member(organization_id) and user_id = auth.uid());

drop policy if exists "purchase checklist readable by authenticated" on public.listing_purchase_checklist;
drop policy if exists "purchase checklist writable by owner/broker" on public.listing_purchase_checklist;
create policy "purchase checklist readable by organization members" on public.listing_purchase_checklist for select using (public.is_organization_member(organization_id));
create policy "purchase checklist writable by organization brokers" on public.listing_purchase_checklist for all using (public.is_organization_member(organization_id, array['owner','broker'])) with check (public.is_organization_member(organization_id, array['owner','broker']));

drop policy if exists "ai evaluations readable by owner" on public.ai_evaluations;
drop policy if exists "ai evaluations updatable by owner" on public.ai_evaluations;
create policy "ai evaluations readable by organization members" on public.ai_evaluations for select using (public.is_organization_member(organization_id));
create policy "ai evaluations insertable by organization members" on public.ai_evaluations for insert with check (public.is_organization_member(organization_id) and (user_id is null or user_id = auth.uid()));
create policy "ai evaluations editable by organization brokers" on public.ai_evaluations for update using (public.is_organization_member(organization_id, array['owner','broker'])) with check (public.is_organization_member(organization_id, array['owner','broker']));

drop policy if exists "export scenarios readable by authenticated" on public.export_scenarios;
drop policy if exists "export scenarios insertable by creator" on public.export_scenarios;
drop policy if exists "export scenarios updatable by owner or creator" on public.export_scenarios;
drop policy if exists "export scenarios deletable by owner or creator" on public.export_scenarios;
create policy "export scenarios readable by organization members" on public.export_scenarios for select using (public.is_organization_member(organization_id));
create policy "export scenarios insertable by organization members" on public.export_scenarios for insert with check (public.is_organization_member(organization_id) and created_by = auth.uid());
create policy "export scenarios editable by organization brokers" on public.export_scenarios for update using (public.is_organization_member(organization_id, array['owner','broker'])) with check (public.is_organization_member(organization_id, array['owner','broker']));
create policy "export scenarios deletable by organization brokers" on public.export_scenarios for delete using (public.is_organization_member(organization_id, array['owner','broker']));

drop policy if exists "export results readable by authenticated" on public.export_scenario_results;
drop policy if exists "export results insertable by scenario owner" on public.export_scenario_results;
create policy "export results readable by organization members" on public.export_scenario_results for select using (public.is_organization_member(organization_id));
create policy "export results insertable by organization brokers" on public.export_scenario_results for insert with check (public.is_organization_member(organization_id, array['owner','broker']));

drop policy if exists "export documents readable by authenticated" on public.export_scenario_documents;
drop policy if exists "export documents writable by scenario owner" on public.export_scenario_documents;
create policy "export documents readable by organization members" on public.export_scenario_documents for select using (public.is_organization_member(organization_id));
create policy "export documents writable by organization brokers" on public.export_scenario_documents for all using (public.is_organization_member(organization_id, array['owner','broker'])) with check (public.is_organization_member(organization_id, array['owner','broker']));

-- Shared catalog and governed reference data remain readable to authenticated users,
-- but only a platform admin (not an organization owner) may mutate governance rows.
drop policy if exists "media rights manageable by owner" on public.listing_media_rights;
create policy "media rights manageable by platform admin" on public.listing_media_rights for all using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists "export routes manageable by owner" on public.export_routes;
create policy "export routes manageable by platform admin" on public.export_routes for all using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists "export rule sets manageable by owner" on public.export_rule_sets;
create policy "export rule sets manageable by platform admin" on public.export_rule_sets for all using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists "export rules manageable by owner" on public.export_rules;
create policy "export rules manageable by platform admin" on public.export_rules for all using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists "exchange rates manageable by owner" on public.exchange_rate_snapshots;
create policy "exchange rates manageable by platform admin" on public.exchange_rate_snapshots for all using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists "scanner_runs readable by owner role" on public.scanner_runs;
create policy "scanner runs readable by platform admin" on public.scanner_runs for select using (public.is_platform_admin());

-- New Storage objects use <organization-uuid>/... paths. Legacy objects remain
-- readable only when referenced by a tenant-owned database row.
create or replace function public.storage_object_organization_id(p_name text)
returns uuid
language sql
immutable
strict
set search_path = public
as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
    else null
  end;
$$;

revoke all on function public.storage_object_organization_id(text) from public;
grant execute on function public.storage_object_organization_id(text) to authenticated, service_role;

drop policy if exists "vehicle-images readable by authenticated" on storage.objects;
drop policy if exists "vehicle-images writable by authenticated" on storage.objects;
drop policy if exists "offer-pdfs readable by authenticated" on storage.objects;
drop policy if exists "offer-pdfs writable by authenticated" on storage.objects;

create policy "vehicle images tenant read"
  on storage.objects for select
  using (
    bucket_id = 'vehicle-images'
    and (
      public.is_organization_member(public.storage_object_organization_id(name))
      or exists (
        select 1 from public.vehicle_images image
        where image.storage_path = name
          and public.is_organization_member(image.organization_id)
      )
    )
  );

create policy "vehicle images tenant insert"
  on storage.objects for insert
  with check (
    bucket_id = 'vehicle-images'
    and public.is_organization_member(public.storage_object_organization_id(name), array['owner','broker'])
  );

create policy "vehicle images tenant update"
  on storage.objects for update
  using (bucket_id = 'vehicle-images' and public.is_organization_member(public.storage_object_organization_id(name), array['owner','broker']))
  with check (bucket_id = 'vehicle-images' and public.is_organization_member(public.storage_object_organization_id(name), array['owner','broker']));

create policy "vehicle images tenant delete"
  on storage.objects for delete
  using (bucket_id = 'vehicle-images' and public.is_organization_member(public.storage_object_organization_id(name), array['owner','broker']));

create policy "offer pdfs tenant read"
  on storage.objects for select
  using (
    bucket_id = 'offer-pdfs'
    and (
      public.is_organization_member(public.storage_object_organization_id(name))
      or exists (
        select 1 from public.offers offer
        where offer.pdf_storage_path = name
          and public.is_organization_member(offer.organization_id)
      )
    )
  );

create policy "offer pdfs tenant insert"
  on storage.objects for insert
  with check (
    bucket_id = 'offer-pdfs'
    and public.is_organization_member(public.storage_object_organization_id(name), array['owner','broker'])
  );

create policy "offer pdfs tenant update"
  on storage.objects for update
  using (bucket_id = 'offer-pdfs' and public.is_organization_member(public.storage_object_organization_id(name), array['owner','broker']))
  with check (bucket_id = 'offer-pdfs' and public.is_organization_member(public.storage_object_organization_id(name), array['owner','broker']));

create policy "offer pdfs tenant delete"
  on storage.objects for delete
  using (bucket_id = 'offer-pdfs' and public.is_organization_member(public.storage_object_organization_id(name), array['owner','broker']));

create or replace function public.guard_tenant_storage_path()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  candidate_path text;
begin
  candidate_path := case when tg_table_name = 'vehicle_images' then new.storage_path else new.pdf_storage_path end;
  if candidate_path is not null
     and candidate_path not like new.organization_id::text || '/%' then
    raise exception 'Storage path must start with the row organization UUID.';
  end if;
  return new;
end
$$;

drop trigger if exists vehicle_images_tenant_storage_guard on public.vehicle_images;
create trigger vehicle_images_tenant_storage_guard
  before insert or update of storage_path, organization_id on public.vehicle_images
  for each row execute function public.guard_tenant_storage_path();

drop trigger if exists offers_tenant_storage_guard on public.offers;
create trigger offers_tenant_storage_guard
  before insert or update of pdf_storage_path, organization_id on public.offers
  for each row execute function public.guard_tenant_storage_path();

-- Export approval authority follows the scenario organization, not the legacy
-- global profile role.
create or replace function public.guard_export_document_review()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.status in ('verified', 'not_applicable')
     and new.status is distinct from old.status
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.is_organization_member(new.organization_id, array['owner']) then
    raise exception 'Only an organization owner can finalize export document review.';
  end if;

  if new.status = 'verified' then
    if nullif(btrim(new.evidence_reference), '') is null then
      raise exception 'A verified document requires an evidence reference.';
    end if;

    new.evidence_sha256 := encode(
      digest(
        concat_ws(
          '|',
          new.scenario_id::text,
          new.document_code,
          btrim(new.evidence_reference),
          coalesce(btrim(new.notes), ''),
          coalesce(new.document_issued_at::text, ''),
          coalesce(new.valid_until::text, '')
        ),
        'sha256'
      ),
      'hex'
    );
  else
    new.evidence_sha256 := null;
  end if;

  return new;
end
$$;

create or replace function public.guard_export_scenario_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approval_status = 'approved'
     and old.approval_status is distinct from 'approved' then
    if coalesce(auth.role(), '') <> 'service_role'
       and not public.is_organization_member(new.organization_id, array['owner']) then
      raise exception 'Only an organization owner can approve an export scenario.';
    end if;

    if not exists (
      select 1
      from public.export_scenario_results result
      where result.scenario_id = new.id
        and result.organization_id = new.organization_id
        and result.compliance->>'calculationComplete' = 'true'
      order by result.calculated_at desc
      limit 1
    ) then
      raise exception 'A complete calculation result is required before approval.';
    end if;

    if exists (
      select 1
      from public.export_scenario_documents document
      where document.scenario_id = new.id
        and document.organization_id = new.organization_id
        and document.required = true
        and document.status not in ('verified', 'not_applicable')
    ) then
      raise exception 'Required documents must be finalized before approval.';
    end if;
  end if;

  return new;
end
$$;
