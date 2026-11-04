-- Send money (U9). A send starts from a support belief (the groceries for mum) and pays a sandbox account
-- that stands in for that person. The action keeps the belief, so the suggestion goes once it's sent and
-- the payment joins that support, and the sandbox email it pays.
alter table public.action
  add column belief_id uuid references public.belief on delete set null,
  add column payee_email text;
create index on public.action (belief_id);
