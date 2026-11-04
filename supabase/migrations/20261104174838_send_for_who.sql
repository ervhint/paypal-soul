-- A send made in Soul is money for the person it went to (U9), kept on the payment so it never counts as
-- spending on you, and a category the person gave the support's other payments doesn't carry over to it.
-- Imported payments leave it empty; who they were for comes from what the person told Soul.
alter table public.payment add column for_who text;
