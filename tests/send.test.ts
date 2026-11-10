// Send money from Memory (U21). Unit: the people Memory offers it for (T-21.1), and Chat answering a request to
// send with code's line pointing to Memory, unsaved and uncounted, while a question about sends stays a question
// (T-21.2). The amount is checked in tests/action.test.ts (T-21.4), with the saved accounts on Staging (T-21.3).
import { describe, expect, it } from "vitest";
import { answer, DAILY_QUESTIONS, type ChatStore, type Llm, type Turn } from "@/lib/chat";
import type { AskJson, AskTools } from "@/lib/llm";
import { asksToSend, peopleOf, SEND_ON_MEMORY } from "@/lib/send";
import type { StoryPayment } from "@/lib/totals";

describe("the people Memory offers Send Money for (T-21.1)", () => {
  const beliefs = [
    { id: "b1", kind: "support", who: "your mum", active: true },
    { id: "b2", kind: "support", who: "your mum", active: true, oneOff: true }, // a birthday gift: no button
    { id: "b3", kind: "habit", who: null, active: true },
    { id: "b4", kind: "support", who: "Sam", active: false }, // stopped
    { id: "b5", kind: "told", who: null, active: true },
  ];
  const act = (id: string, recipient: string, status: string, at: string, amount = "30.00") => ({ id, kind: "send", recipient, status, amount, created_at: at });

  it("lists each person you support, then everyone you sent money to, with their latest send that moved or waits", () => {
    const actions = [
      act("a1", "your mum", "completed", "2026-11-09T10:00:00Z", "25.00"),
      act("a2", "your mum", "completed", "2026-11-09T11:00:00Z", "80.00"),
      act("a3", "Anna Bestie", "completed", "2026-11-09T12:00:00Z"),
      act("a4", "anna bestie", "cancelled", "2026-11-09T13:00:00Z"), // nothing moved: not the latest send
      act("a5", "Sam", "expired", "2026-11-09T09:00:00Z"), // never moved, and the belief is stopped: not listed
      { ...act("a6", "Test Store", "completed", "2026-11-09T14:00:00Z"), kind: "buy" }, // a purchase isn't a person
    ];
    expect(peopleOf(beliefs, actions)).toEqual([
      { who: "your mum", beliefId: "b1", last: { actionId: "a2", status: "completed", amount: 80, at: "2026-11-09T11:00:00Z" } },
      { who: "Anna Bestie", beliefId: null, last: { actionId: "a3", status: "completed", amount: 30, at: "2026-11-09T12:00:00Z" } },
    ]);
  });

  it("shows a waiting send, and nobody when there's no person to send to", () => {
    expect(peopleOf([], [act("a1", "Anna Bestie", "waiting", "2026-11-09T12:00:00Z")])[0].last?.status).toBe("waiting");
    expect(peopleOf(beliefs.filter((b) => b.kind !== "support"), [])).toEqual([]);
  });
});

const pay: StoryPayment = { id: "p1", paypal_txn_id: "TXN1", occurred_at: "2026-11-02T10:00:00Z", amount: 4.5, currency: "USD", name: "Morning coffee", payee: "Test Store", event_code: "T0002", category: "food_drinks.snacks_drinks" };
const NOW = new Date("2026-11-09T09:00:00Z");
const none = async () => [];
function memoryStore() {
  const turns: Turn[] = [];
  const store: ChatStore = {
    history: async (limit) => turns.slice(-limit),
    askedSince: async () => turns.filter((t) => t.role === "user").length,
    payments: async () => [pay],
    beliefs: none,
    stopped: none,
    chapters: none,
    corrections: none,
    actions: none,
    leftOut: none,
    lastRead: async () => null,
    save: async (q, a) => {
      turns.push({ role: "user", text: q, paymentIds: [] }, { role: "soul", ...a });
      return "m1";
    },
  };
  return { store, turns };
}
const never: AskJson & AskTools = (async () => {
  throw new Error("no LLM call");
}) as never;
const noLlm: Llm = { ask: never, pick: never, credit: async () => 10 };

describe("Chat points a request to send money to Memory (T-21.2)", () => {
  it("answers with code's line, with no LLM call, not saved and not counted, even with no questions left", async () => {
    const { store, turns } = memoryStore();
    expect(await answer(store, "send $30 to Anna Bestie", noLlm, NOW)).toEqual({ status: "refused", message: SEND_ON_MEMORY });
    expect(turns).toEqual([]);
    for (let i = 0; i < DAILY_QUESTIONS; i++) turns.push({ role: "user", text: "q", paymentIds: [] });
    expect(await answer(store, "can you transfer mum 50?", noLlm, NOW)).toEqual({ status: "refused", message: SEND_ON_MEMORY });
  });

  it("spots only a request to send now, so a question about sends stays a question", () => {
    for (const q of ["send $30 to Anna Bestie", "Send mum 50", "can you transfer 20 to Sam?", "please send my mum twenty dollars"]) expect(asksToSend(q), q).toBe(true);
    for (const q of ["how much did I send mum?", "Did I send money last week?", "Who do I send money to?", "What did I buy or send through Soul?", "how often do I transfer money?", "what did I spend on transfers?", "How much have I sent?"])
      expect(asksToSend(q), q).toBe(false);
  });
});
