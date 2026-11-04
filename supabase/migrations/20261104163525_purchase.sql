-- Purchases made in Soul (U8). Soul adds a captured payment to the story at once from PayPal's capture
-- result, without waiting for the report rows. It belongs to the person who made it (`person_id`), so
-- other people on the same prepared account never see it. Rows imported from PayPal have no person. When
-- the buyer's report row for it arrives later, the import leaves it out, so it's counted once.
alter table public.payment
  add column person_id uuid references public.person on delete cascade;
create index on public.payment (person_id);

alter policy "read payments of readable accounts" on public.payment
  using (
    (person_id is null or person_id = (select auth.uid()))
    and exists (
      select 1 from public.paypal_account a
      where a.id = account_id and (a.owner_id is null or a.owner_id = (select auth.uid()))));
