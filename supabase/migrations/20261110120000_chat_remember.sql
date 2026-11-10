-- Chat remembers what you tell it (U20). An answer can carry one proposed belief, shown as a Remember This?
-- card. It's only a proposal: the belief is saved when the person taps Remember, and Remember or Not Now
-- clears it. RLS stays "own chat", and the BFF checks the proposal again when it's tapped.
alter table public.chat_message
  add column remember jsonb;
