-- Migration 0026 added SELECT/INSERT/UPDATE policies for listing_alerts but
-- dropped the table's implicit permissive delete policy without replacing it
-- with a scoped one, so RLS silently blocked every delete (0 rows affected,
-- no error) once row level security was enforced for the table.
create policy "listing alerts deletable by owner user" on public.listing_alerts
  for delete using (public.is_organization_member(organization_id) and user_id = auth.uid());
