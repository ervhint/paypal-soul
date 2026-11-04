-- Corrections (U5). What a person tells Soul is saved as a belief, so the story, chat and Memory all use
-- it, and Stop Using This (U6) undoes it. A support belief says some payments were for someone else
-- (`who`), so they no longer count as spending on the person; any told belief can also move its payments
-- to another category (`category`) for this person only, since payments are shared. `told_at` marks a
-- belief the person corrected or confirmed, so rebuilding the story never overwrites what they said.
-- A correction's Here's What Changed shows until the person has seen it (`seen_at`).
alter table public.belief
  drop constraint belief_kind_check,
  add constraint belief_kind_check check (kind in ('habit', 'check', 'interest', 'support', 'told')),
  add column who text,
  add column category text,
  add column told_at timestamptz;

alter table public.correction
  add column seen_at timestamptz;
