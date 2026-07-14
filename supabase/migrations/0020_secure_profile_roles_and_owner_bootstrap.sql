do $$
declare
  profile_count integer;
  bootstrap_user_id uuid;
begin
  if not exists (select 1 from public.users_profile where role = 'owner') then
    select count(*)
      into profile_count
      from public.users_profile;

    if profile_count = 1 then
      select id
        into bootstrap_user_id
        from public.users_profile
       order by created_at, id
       limit 1;

      update public.users_profile
         set role = 'owner'
       where id = bootstrap_user_id;
    elsif profile_count > 1 then
      raise exception 'Owner bootstrap requires an explicit account selection because % profiles exist.', profile_count;
    end if;
  end if;
end
$$;

drop policy if exists "profile is self-updatable" on public.users_profile;

create policy "profile fields are self-updatable"
  on public.users_profile
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke update on table public.users_profile from authenticated;
grant update (full_name, telegram_username, telegram_chat_id, telegram_verified_at)
  on table public.users_profile
  to authenticated;

create or replace function public.set_user_role(target_user_id uuid, new_role text)
returns public.users_profile
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.users_profile;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
      from public.users_profile
     where id = auth.uid()
       and role = 'owner'
  ) then
    raise exception 'Only an owner can change user roles.';
  end if;

  if new_role not in ('owner', 'broker', 'assistant') then
    raise exception 'Unsupported role: %', new_role;
  end if;

  if target_user_id = auth.uid()
     and new_role <> 'owner'
     and not exists (
       select 1
         from public.users_profile
        where role = 'owner'
          and id <> auth.uid()
     ) then
    raise exception 'The last owner cannot demote their own account.';
  end if;

  update public.users_profile
     set role = new_role
   where id = target_user_id
   returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'User profile not found.';
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'user_role_changed',
    'users_profile',
    target_user_id,
    jsonb_build_object('new_role', new_role)
  );

  return updated_profile;
end
$$;

revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users_profile (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'broker');
  return new;
end
$$;
