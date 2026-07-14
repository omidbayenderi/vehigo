create or replace function public.start_recovery_drill(p_drill_id uuid)
returns public.recovery_drills
language plpgsql
security definer
set search_path = public
as $$
declare drill public.recovery_drills;
begin
  select * into drill from public.recovery_drills where id = p_drill_id for update;
  if drill.id is null then raise exception 'Recovery drill not found.'; end if;
  if not public.is_organization_member(drill.organization_id, array['owner']) then raise exception 'Organization owner required.'; end if;
  if drill.status <> 'planned' then raise exception 'Only planned drills can be started.'; end if;
  update public.recovery_drills set status = 'running', started_at = now(), completed_at = null, reviewed_by = null where id = drill.id returning * into drill;
  insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (drill.organization_id, auth.uid(), 'recovery_drill_started', 'recovery_drill', drill.id, jsonb_build_object('drill_type', drill.drill_type));
  return drill;
end
$$;

create or replace function public.complete_recovery_drill(p_drill_id uuid, p_status text, p_evidence jsonb)
returns public.recovery_drills
language plpgsql
security definer
set search_path = public
as $$
declare drill public.recovery_drills;
begin
  if p_status not in ('passed', 'failed') then raise exception 'Completion status must be passed or failed.'; end if;
  if p_evidence is null or jsonb_typeof(p_evidence) <> 'object' or p_evidence = '{}'::jsonb then raise exception 'Non-empty evidence object required.'; end if;
  select * into drill from public.recovery_drills where id = p_drill_id for update;
  if drill.id is null then raise exception 'Recovery drill not found.'; end if;
  if not public.is_organization_member(drill.organization_id, array['owner']) then raise exception 'Organization owner required.'; end if;
  if drill.status <> 'running' then raise exception 'Only running drills can be completed.'; end if;
  update public.recovery_drills set status = p_status, evidence = p_evidence, completed_at = now(), reviewed_by = auth.uid() where id = drill.id returning * into drill;
  insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (drill.organization_id, auth.uid(), 'recovery_drill_completed', 'recovery_drill', drill.id, jsonb_build_object('status', p_status, 'drill_type', drill.drill_type));
  if p_status = 'failed' then
    insert into public.operation_alerts (organization_id, dedupe_key, alert_type, severity, title, details)
    values (drill.organization_id, 'recovery_drill:' || drill.id, 'recovery_drill', 'critical', 'Recovery drill failed: ' || drill.drill_type, jsonb_build_object('drill_id', drill.id, 'scope', drill.scope, 'evidence', p_evidence))
    on conflict (organization_id, dedupe_key) do update set status = 'open', severity = 'critical', details = excluded.details, occurrence_count = public.operation_alerts.occurrence_count + 1, last_occurred_at = now(), resolved_at = null;
  else
    update public.operation_alerts set status = 'resolved', resolved_at = now(), last_occurred_at = now() where organization_id = drill.organization_id and dedupe_key = 'recovery_drill:' || drill.id and status <> 'resolved';
  end if;
  return drill;
end
$$;

create or replace function public.run_operational_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare recovered_leases int; queue_retention jsonb; metrics_retention jsonb; overdue_drills int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required.'; end if;
  recovered_leases := public.recover_expired_operation_leases();
  queue_retention := public.purge_expired_operation_data();
  metrics_retention := public.purge_expired_operational_metrics();
  insert into public.operation_alerts (organization_id, dedupe_key, alert_type, severity, title, details)
  select drill.organization_id, 'recovery_drill_overdue:' || drill.id, 'recovery_drill', 'warning', 'Recovery drill overdue: ' || drill.drill_type,
    jsonb_build_object('drill_id', drill.id, 'scope', drill.scope, 'planned_for', drill.planned_for)
  from public.recovery_drills drill
  where drill.status = 'planned' and drill.planned_for is not null and drill.planned_for < now() - interval '1 hour'
  on conflict (organization_id, dedupe_key) do update set status = 'open', details = excluded.details, occurrence_count = public.operation_alerts.occurrence_count + 1, last_occurred_at = now(), resolved_at = null;
  get diagnostics overdue_drills = row_count;
  return jsonb_build_object('recovered_leases', recovered_leases, 'queue_retention', queue_retention, 'metrics_retention', metrics_retention, 'overdue_drill_alerts', overdue_drills, 'completed_at', now());
end
$$;

revoke all on function public.start_recovery_drill(uuid) from public, anon;
revoke all on function public.complete_recovery_drill(uuid, text, jsonb) from public, anon;
revoke all on function public.run_operational_maintenance() from public, anon, authenticated;
grant execute on function public.start_recovery_drill(uuid) to authenticated, service_role;
grant execute on function public.complete_recovery_drill(uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.run_operational_maintenance() to service_role;
