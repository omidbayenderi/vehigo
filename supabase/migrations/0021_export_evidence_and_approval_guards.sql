alter table public.export_scenario_documents
  add column if not exists evidence_reference text,
  add column if not exists evidence_sha256 text,
  add column if not exists document_issued_at date,
  add column if not exists valid_until date;

alter table public.export_scenario_documents
  drop constraint if exists export_scenario_documents_evidence_required_check;

alter table public.export_scenario_documents
  add constraint export_scenario_documents_evidence_required_check
  check (
    status <> 'verified'
    or (
      nullif(btrim(evidence_reference), '') is not null
      and evidence_sha256 ~ '^[0-9a-f]{64}$'
      and reviewed_by is not null
      and reviewed_at is not null
    )
  );

alter table public.export_scenario_documents
  drop constraint if exists export_scenario_documents_validity_check;

alter table public.export_scenario_documents
  add constraint export_scenario_documents_validity_check
  check (valid_until is null or document_issued_at is null or valid_until >= document_issued_at);

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
     and not exists (
       select 1
         from public.users_profile
        where id = auth.uid()
          and role = 'owner'
     ) then
    raise exception 'Only an owner can finalize export document review.';
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

drop trigger if exists export_document_review_guard on public.export_scenario_documents;
create trigger export_document_review_guard
  before update on public.export_scenario_documents
  for each row execute function public.guard_export_document_review();

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
       and not exists (
         select 1
           from public.users_profile
          where id = auth.uid()
            and role = 'owner'
       ) then
      raise exception 'Only an owner can approve an export scenario.';
    end if;

    if not exists (
      select 1
        from public.export_scenario_results
       where scenario_id = new.id
         and compliance->>'calculationComplete' = 'true'
       order by calculated_at desc
       limit 1
    ) then
      raise exception 'A complete calculation result is required before approval.';
    end if;

    if exists (
      select 1
        from public.export_scenario_documents
       where scenario_id = new.id
         and required = true
         and status not in ('verified', 'not_applicable')
    ) then
      raise exception 'Required documents must be finalized before approval.';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists export_scenario_approval_guard on public.export_scenarios;
create trigger export_scenario_approval_guard
  before update on public.export_scenarios
  for each row execute function public.guard_export_scenario_approval();
