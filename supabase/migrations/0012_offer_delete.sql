-- Allow deleting an offer (owner or the person who created it), matching the
-- pattern already used for vehicles/leads. message_drafts keeps its history
-- instead of blocking deletion or silently disappearing when the offer does.

alter table message_drafts drop constraint if exists message_drafts_offer_id_fkey;
alter table message_drafts add constraint message_drafts_offer_id_fkey
  foreign key (offer_id) references offers(id) on delete set null;

create policy "offers deletable by owner or creator" on offers
  for delete using (
    auth.uid() = created_by
    or exists (select 1 from users_profile where id = auth.uid() and role = 'owner')
  );
