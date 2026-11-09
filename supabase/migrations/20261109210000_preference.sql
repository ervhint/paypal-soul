-- Tell Soul About You (U19). A person can tell Soul about themselves, not about a payment: "I love baking",
-- "I'm saving for a trip to Japan". It's saved as a belief of kind `preference`, in their own words, so it
-- has no payments behind it (NF-7: shown as what they said, never as evidence). `topic` says what it is
-- (a priority, a hobby or a preference) and `categories` the categories from the list it relates to, maybe
-- none, so the story and chat can tie it to that kind of spending.
alter table public.belief
  drop constraint belief_kind_check,
  add constraint belief_kind_check check (kind in ('habit', 'check', 'interest', 'support', 'told', 'preference')),
  drop constraint belief_payment_ids_check,
  add constraint belief_payment_ids_check check (cardinality(payment_ids) > 0 or kind = 'preference'),
  add column categories text[] not null default '{}',
  add column topic text check (topic in ('priority', 'hobby', 'preference'));
