-- Manual scans must be able to claim one active site agent even when its
-- scheduled next_run_at is still in the future. Scheduled calls remain due-only.

drop function if exists public.claim_due_site_search_agents(text, int, int, text);

create function public.claim_due_site_search_agents(
  p_worker_id text,
  p_limit int default 1,
  p_lease_seconds int default 300,
  p_source_key text default null,
  p_force boolean default false
)
returns setof public.site_search_agents
language plpgsql
security definer
set search_path = public
as $$
declare
  storage_rights_verified boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required.'; end if;
  if nullif(btrim(p_worker_id), '') is null then raise exception 'Worker ID is required.'; end if;
  if p_limit <> 1 then raise exception 'This synchronous claim API requires p_limit = 1.'; end if;

  select exists (
    select 1 from public.provider_storage_rights_evidence evidence
    where evidence.provider_key = 'brave_web' and evidence.revoked_at is null
      and evidence.effective_at <= now() and evidence.expires_at > now()
      and array['result_url','result_title','result_snippet','seller_name','derived_listing']::text[]
        <@ evidence.permitted_data_classes
  ) into storage_rights_verified;

  if not storage_rights_verified then
    update public.site_search_agent_runs run
    set status = 'blocked', request_count = run.reserved_request_count,
        error_code = 'storage_rights_unverified',
        error_message = 'Active Brave storage-rights evidence is missing, expired, or revoked.', completed_at = now()
    from public.site_search_agents agent
    where run.agent_id = agent.id and run.status = 'running'
      and run.lease_token = agent.lease_token and agent.status = 'active'
      and agent.processing_mode = 'persistent_search';

    update public.site_search_agents
    set status = 'blocked', last_status = 'blocked', last_error_code = 'storage_rights_unverified',
        last_error_message = 'Active Brave storage-rights evidence is missing, expired, or revoked.',
        locked_until = null, locked_by = null, lease_token = null, reserved_request_count = 0
    where status = 'active' and processing_mode = 'persistent_search';
  end if;

  update public.site_search_agent_runs run
  set status = 'failed', request_count = run.reserved_request_count,
      error_code = 'lease_expired', error_message = 'Worker lease expired before terminal completion.', completed_at = now()
  from public.site_search_agents agent
  where run.agent_id = agent.id and run.status = 'running'
    and run.lease_token = agent.lease_token and agent.locked_until <= now();

  return query
  with candidates as (
    select agent.id, gen_random_uuid() as next_lease_token,
      least(
        agent.max_queries_per_run * agent.max_pages_per_query,
        agent.daily_query_limit - case when agent.daily_budget_date = current_date then agent.daily_request_count else 0 end,
        4
      )::int as reservation
    from public.site_search_agents agent
    where agent.status = 'active'
      and (agent.processing_mode = 'transient_search' or storage_rights_verified)
      and (p_force or agent.next_run_at <= now())
      and (agent.locked_until is null or agent.locked_until <= now())
      and (p_source_key is null or agent.source_key = p_source_key)
      and (case when agent.daily_budget_date = current_date then agent.daily_request_count else 0 end) < agent.daily_query_limit
    order by agent.next_run_at, agent.consecutive_failures, agent.source_key
    for update skip locked
    limit 1
  )
  update public.site_search_agents agent
  set locked_by = p_worker_id,
      locked_until = now() + make_interval(secs => greatest(60, least(p_lease_seconds, 900))),
      lease_token = candidates.next_lease_token, reserved_request_count = candidates.reservation,
      daily_budget_date = current_date,
      daily_request_count = case when agent.daily_budget_date = current_date then agent.daily_request_count else 0 end + candidates.reservation,
      last_started_at = now()
  from candidates
  where agent.id = candidates.id and candidates.reservation > 0
  returning agent.*;
end
$$;

revoke all on function public.claim_due_site_search_agents(text, int, int, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_due_site_search_agents(text, int, int, text, boolean) to service_role;
