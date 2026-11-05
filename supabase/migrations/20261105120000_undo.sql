-- Undo a correction (U12). A correction keeps what it changed as it was before: the beliefs, and the
-- chapters of the weeks it rewrote. Undo puts those back word for word, with no LLM call, and sets
-- `undone_at`, so the correction stays on record as undone. Corrections saved before this have no copy
-- and can't be undone.
alter table public.correction
  add column undo jsonb;
