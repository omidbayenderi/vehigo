alter table public.audit_log alter column organization_id set not null;
alter table public.scanner_ingest_events alter column organization_id set not null;

alter table public.scanner_ingest_events
  drop constraint if exists scanner_ingest_events_source_key_idempotency_key_key;

drop policy if exists "scanner ingest events readable by owner" on public.scanner_ingest_events;
drop policy if exists "scanner ingest events readable by organization owners" on public.scanner_ingest_events;
create policy "scanner ingest events readable by organization owners"
  on public.scanner_ingest_events
  for select
  using (public.is_organization_member(organization_id, array['owner']));
 
revoke update on table public.organization_members from authenticated;

create or replace function public.set_organization_member_role(p_organization_id uuid, p_target_user_id uuid, p_new_role text)
returns public.organization_members
language plpgsql
security definer
set search_path = public
as $$
declare
  current_member public.organization_members;
  updated_member public.organization_members;
  organization_slug text;
begin
  if not public.is_organization_member(p_organization_id, array['owner']) then
    raise exception 'Organization owner required.';
  end if;
  if p_new_role not in ('owner', 'broker', 'assistant') then
    raise exception 'Unsupported organization role: %', p_new_role;
  end if;

  select * into current_member
  from public.organization_members
  where organization_id = p_organization_id and user_id = p_target_user_id
  for update;
  if current_member.user_id is null then raise exception 'Organization membership not found.'; end if;

  if current_member.role = 'owner'
     and p_new_role <> 'owner'
     and not exists (
       select 1 from public.organization_members
       where organization_id = p_organization_id
         and user_id <> p_target_user_id
         and role = 'owner'
         and status = 'active'
     ) then
    raise exception 'The last active organization owner cannot be demoted.';
  end if;

  update public.organization_members
  set role = p_new_role
  where organization_id = p_organization_id and user_id = p_target_user_id
  returning * into updated_member;

  select slug into organization_slug from public.organizations where id = p_organization_id;
  if organization_slug = 'vehigo-default' then
    update public.users_profile set role = p_new_role where id = p_target_user_id;
  end if;

  insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), 'organization_member_role_changed', 'organization_member', p_target_user_id, jsonb_build_object('old_role', current_member.role, 'new_role', p_new_role));
  return updated_member;
end
$$;

revoke all on function public.set_organization_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_organization_member_role(uuid, uuid, text) to authenticated, service_role;

create or replace function public.set_user_role(target_user_id uuid, new_role text)
returns public.users_profile
language plpgsql
security definer
set search_path = public
as $$
declare
  default_organization_id uuid;
  updated_profile public.users_profile;
begin
  select member.organization_id into default_organization_id
  from public.organization_members member
  join public.organizations organization on organization.id = member.organization_id
  where member.user_id = auth.uid()
    and member.role = 'owner'
    and member.status = 'active'
    and organization.slug = 'vehigo-default'
    and organization.status = 'active'
  limit 1;
  if default_organization_id is null then raise exception 'Default organization owner required.'; end if;
  perform public.set_organization_member_role(default_organization_id, target_user_id, new_role);
  select * into updated_profile from public.users_profile where id = target_user_id;
  return updated_profile;
end
$$;

revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;
