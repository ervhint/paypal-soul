// Send money from Memory (U21). Soul only knows a person matters to you because you told it a payment was
// for them, or you sent them money through Soul, so Memory lists those people with a plain Send Money button
// and claims no reason. Chat stays questions only: a request to send money gets code's line pointing to
// Memory, with no LLM call, not saved and not counted.

// "Send $30 to Anna", "can you transfer mum 50?". Asking about sends ("did I send…", "how much do I send…") is a normal question.
const SEND = /\b(send|transfer)\b/i;
const ASKS = /\b(did|do|does|have|has|had|how much|how often|when|why|was|were)\b/i;
export const asksToSend = (message: string) => SEND.test(message) && !ASKS.test(message);

export const SEND_ON_MEMORY = "I only answer questions about your payments. To send money, tap Send Money next to the person on Memory.";

/** A person on Memory who can be sent money, with their latest send that moved or is waiting. */
export type Person = { who: string; beliefId: string | null; last: { actionId: string; status: "waiting" | "completed"; amount: number; at: string } | null };
type BeliefIn = { id: string; kind: string; who?: string | null; active: boolean; oneOff?: boolean };
type ActionIn = { id: string; kind: string; recipient: string; status: string; amount: number | string; created_at: string };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The people on Memory (AC-21.1): each active support belief naming someone, never a one-off, then everyone
 * sent money through Soul with no such belief, newest send first. Each has their latest send that's paid or waiting.
 */
export function peopleOf(beliefs: BeliefIn[], actions: ActionIn[]): Person[] {
  const sends = actions.filter((a) => a.kind === "send" && (a.status === "completed" || a.status === "waiting")).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const last = (who: string): Person["last"] => {
    const a = sends.find((s) => same(s.recipient, who));
    return a ? { actionId: a.id, status: a.status as "waiting" | "completed", amount: Number(a.amount), at: a.created_at } : null;
  };
  const out: Person[] = [];
  for (const b of beliefs)
    if (b.kind === "support" && b.active && b.who && !b.oneOff && !out.some((p) => same(p.who, b.who!))) out.push({ who: b.who, beliefId: b.id, last: last(b.who) });
  for (const s of sends) if (!out.some((p) => same(p.who, s.recipient))) out.push({ who: s.recipient, beliefId: null, last: last(s.recipient) });
  return out;
}
