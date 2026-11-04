-- Story (U4). Soul writes one chapter per week (Monday, UTC) that has payments, and rewrites it only
-- when that week's payments change, so each chapter keeps the payments it covered. Chapters with no
-- week (a purchase made in Soul, U8) are never rebuilt. Habits found by code are beliefs with a key
-- (the repeated name), so a rebuild updates the same belief instead of adding another.
alter table public.chapter
  add column week date,
  add column payment_ids uuid[] not null default '{}',
  add constraint chapter_one_per_week unique (person_id, account_id, week);

alter table public.belief
  add column key text,
  add constraint belief_one_per_key unique (person_id, account_id, key);
