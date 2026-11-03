-- Soul schema v1. Shared tables (paypal_account, payment, left_out_row) are written only by the
-- server with the secret key; people can read the prepared account and their own. Personal tables
-- belong to one person (an anonymous Supabase user) and one account, so prepared data and an own
-- sandbox each keep their own story, memory and chat. No PayPal keys or tokens are stored (NF-5).

create table public.paypal_account (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('prepared', 'own')),
  paypal_account_id text not null,          -- PayPal merchant/payer ID, the only PayPal identifier kept
  tracking_id text,                         -- consent tracking ID, used by Check Connection
  owner_id uuid references auth.users on delete cascade,
  synced_through timestamptz,               -- import cursor: newest payment date already read
  created_at timestamptz not null default now(),
  check ((kind = 'prepared') = (owner_id is null)),
  unique (owner_id, paypal_account_id)
);
create unique index paypal_account_one_prepared on public.paypal_account (kind) where kind = 'prepared';

create table public.person (
  id uuid primary key references auth.users on delete cascade,
  account_id uuid references public.paypal_account on delete set null,  -- data in use, null before a choice
  last_visit_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.person (account_id);

create table public.payment (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.paypal_account on delete cascade,
  paypal_txn_id text not null,
  occurred_at timestamptz not null,
  amount numeric(12, 2) not null,           -- positive = money spent
  currency text not null,
  name text,                                -- transaction_subject, item name or note
  payee text,
  event_code text not null,
  category text,                            -- null until categorised, 'unknown' when unsure
  created_at timestamptz not null default now(),
  unique (account_id, paypal_txn_id)
);
create index on public.payment (account_id, occurred_at desc);

create table public.left_out_row (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.paypal_account on delete cascade,
  paypal_txn_id text not null,
  occurred_at timestamptz not null,
  amount numeric(12, 2) not null,
  currency text not null,
  event_code text not null,
  reason text not null,
  unique (account_id, paypal_txn_id)
);

create table public.belief (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.person on delete cascade,
  account_id uuid not null references public.paypal_account on delete cascade,
  kind text not null check (kind in ('habit', 'check', 'interest')),
  text text not null,
  sureness text not null check (sureness in ('not_sure', 'fairly_sure', 'sure')),
  source text not null,
  payment_ids uuid[] not null check (cardinality(payment_ids) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.belief (person_id, account_id);
create index on public.belief (account_id);

create table public.chapter (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.person on delete cascade,
  account_id uuid not null references public.paypal_account on delete cascade,
  title text not null,
  starts_on date not null,
  ends_on date not null,
  is_new boolean not null default false,
  suggestion jsonb,                         -- { text, label, href } for a suggested action
  created_at timestamptz not null default now()
);
create index on public.chapter (person_id, account_id, ends_on desc);
create index on public.chapter (account_id);

create table public.claim (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapter on delete cascade,
  person_id uuid not null references public.person on delete cascade,
  position int not null,
  text text not null,
  payment_ids uuid[] not null check (cardinality(payment_ids) > 0),  -- NF-7: every claim has evidence
  belief_id uuid references public.belief on delete set null,
  rewritten boolean not null default false
);
create index on public.claim (chapter_id, position);
create index on public.claim (person_id);
create index on public.claim (belief_id);

create table public.correction (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.person on delete cascade,
  account_id uuid not null references public.paypal_account on delete cascade,
  belief_id uuid references public.belief on delete set null,
  claim_id uuid references public.claim on delete set null,
  said text not null,                       -- the person's own words
  belief_before text,
  belief_after text,
  claim_before text,
  claim_after text,
  notes text[] not null default '{}',       -- Here's What Changed lines
  undone_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.correction (person_id, account_id, created_at desc);
create index on public.correction (account_id);
create index on public.correction (belief_id);
create index on public.correction (claim_id);

create table public.chat_message (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.person on delete cascade,
  account_id uuid not null references public.paypal_account on delete cascade,
  role text not null check (role in ('user', 'soul')),
  text text not null,
  payment_ids uuid[] not null default '{}', -- cited payments; empty means "no evidence" (NF-7)
  created_at timestamptz not null default now()
);
create index on public.chat_message (person_id, account_id, created_at desc);
create index on public.chat_message (account_id);

create table public.action (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.person on delete cascade,
  account_id uuid not null references public.paypal_account on delete cascade,
  kind text not null check (kind in ('send', 'buy')),
  paypal_order_id text unique,
  recipient text not null,
  amount numeric(12, 2) not null,
  currency text not null,
  fee numeric(12, 2),
  paypal_txn_id text,                       -- capture ID once completed
  status text not null default 'waiting' check (status in ('waiting', 'completed', 'cancelled', 'expired', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.action (person_id, account_id, created_at desc);
create index on public.action (account_id);
create index on public.action (status) where status = 'waiting';

-- Grants: nothing for visitors without a session, RLS decides the rest for signed-in (anonymous) people.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.paypal_account, public.payment, public.left_out_row, public.action to authenticated;
grant select, insert, update, delete on public.person, public.belief, public.chapter, public.claim,
  public.correction, public.chat_message to authenticated;

-- RLS on every table. The secret key (server only) bypasses it for imports, captures and the daily job.
alter table public.paypal_account enable row level security;
alter table public.person enable row level security;
alter table public.payment enable row level security;
alter table public.left_out_row enable row level security;
alter table public.belief enable row level security;
alter table public.chapter enable row level security;
alter table public.claim enable row level security;
alter table public.correction enable row level security;
alter table public.chat_message enable row level security;
alter table public.action enable row level security;

-- Shared data: read the prepared account or your own. No write policies.
create policy "read prepared or own account" on public.paypal_account
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy "read payments of readable accounts" on public.payment
  for select to authenticated using (exists (
    select 1 from public.paypal_account a
    where a.id = account_id and (a.owner_id is null or a.owner_id = (select auth.uid()))));
create policy "read left out rows of readable accounts" on public.left_out_row
  for select to authenticated using (exists (
    select 1 from public.paypal_account a
    where a.id = account_id and (a.owner_id is null or a.owner_id = (select auth.uid()))));

-- The person row: only yourself.
create policy "own person" on public.person
  for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Personal tables: only your own rows.
create policy "own beliefs" on public.belief
  for all to authenticated using (person_id = (select auth.uid())) with check (person_id = (select auth.uid()));
create policy "own chapters" on public.chapter
  for all to authenticated using (person_id = (select auth.uid())) with check (person_id = (select auth.uid()));
create policy "own claims" on public.claim
  for all to authenticated using (person_id = (select auth.uid())) with check (person_id = (select auth.uid()));
create policy "own corrections" on public.correction
  for all to authenticated using (person_id = (select auth.uid())) with check (person_id = (select auth.uid()));
create policy "own chat" on public.chat_message
  for all to authenticated using (person_id = (select auth.uid())) with check (person_id = (select auth.uid()));

-- Actions: read only. Status and fee come from PayPal through the server, never from the person.
create policy "read own actions" on public.action
  for select to authenticated using (person_id = (select auth.uid()));
