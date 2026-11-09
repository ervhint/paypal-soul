-- Send money from Chat (U21). A send starts in Chat, not from a support belief: Soul answers with a send card,
-- saved with the answer so it's back after a reload. An account the person types for someone is saved for
-- that person, so next time it's picked by itself. Both are the visitor's own rows (RLS) and go with Delete
-- My Data through the person. Soul's Test Account is never saved here.
-- Later on Nov 9 send money moved to Memory (U21 rewritten), so nothing reads chat_message.send any more. It
-- stays as applied on Staging; dropping it was declined for now.
alter table public.chat_message
  add column send jsonb; -- {"who": "Anna Bestie" | null, "amount": "30.00" | null}

create table public.send_account (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.person on delete cascade,
  account_id uuid not null references public.paypal_account on delete cascade,
  who text not null,
  email text not null,
  updated_at timestamptz not null default now()
);
create unique index send_account_who on public.send_account (person_id, account_id, lower(who));
create index on public.send_account (account_id);
alter table public.send_account enable row level security;
create policy "own send accounts" on public.send_account
  for all to authenticated using (person_id = (select auth.uid())) with check (person_id = (select auth.uid()));
