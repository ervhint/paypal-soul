-- Send money moved from Chat to Memory (U21 rewritten), so the send card column added in
-- 20261109101336_send_from_chat is unused. Dropped so Prod never gets it in P7.
alter table public.chat_message
  drop column if exists send;
