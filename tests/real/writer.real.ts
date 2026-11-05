// T-16.13's wording check: whole answers from the real picker and writer on a few questions, to read by eye and
// to count how often the writer's reply can't be used. Costs money, so it runs only by hand:
// `REAL=1 npx vitest run writer`. REPEAT=3 asks each question that many times.
import { it } from "vitest";
import { answer, type ChatStore, type Turn } from "@/lib/chat";
import { askJson, askTools, type AskJson } from "@/lib/llm";
import type { StoryPayment } from "@/lib/totals";

let n = 0;
const pay = (day: string, name: string, amount: number, category: string, extra: Partial<StoryPayment> = {}): StoryPayment => ({ id: `id-${++n}`, paypal_txn_id: `T${n}`, occurred_at: `${day}T10:00:00Z`, amount, currency: "USD", name, payee: "Test Store", event_code: "T0006", category, ...extra });
const drinks = "food_drinks.snacks_drinks";
const payments = [
  pay("2026-10-05", "Weekly groceries", 46.2, "groceries", { for_who: "your mum" }),
  pay("2026-10-09", "Snickers Bar", 1.5, drinks),
  ...["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map((d) => pay(d, "Morning coffee", 4.5, drinks, { event_code: "T0002" })),
  pay("2026-11-02", "Bus fare", 2.75, "transportation.daily_transportation", { event_code: "T0002" }),
  pay("2026-11-03", "Mobile data", 15, "bills.mobile_data"),
];
const none = async () => [];
const store = (): ChatStore => {
  const turns: Turn[] = [];
  return {
    history: async (limit) => turns.slice(-limit),
    askedSince: async () => 0,
    payments: async () => payments,
    beliefs: async () => [{ kind: "support", text: "You buy the weekly groceries for your mum.", sureness: "sure", checked: true, paymentIds: [payments[0].id] }],
    stopped: async () => [],
    chapters: none,
    corrections: none,
    actions: none,
    leftOut: none,
    lastRead: async () => null,
    save: async (q, a) => void turns.push({ role: "user", text: q, paymentIds: [] }, { role: "soul", ...a }),
  };
};
const QUESTIONS = ["How much would I save without coffee?", "What does coffee cost me per year?", "How much did I spend this month?", "Any chocolate?", "Is my spending going up?", "What's my average per week?", "Where will I end up this month?", "What do I spend most on?", "How much did I spend on myself?", "What's my PayPal balance?"];

it("words whole answers", async () => {
  let failed = 0;
  const ask: AskJson = async (...a) => {
    try {
      return await askJson(...a);
    } catch (e) {
      failed++;
      throw e;
    }
  };
  const times = Number(process.env.REPEAT ?? 1);
  for (const q of QUESTIONS) {
    for (let i = 0; i < times; i++) {
      const r = await answer(store(), q, { ask, pick: askTools, credit: async () => 10 }, new Date("2026-11-05T09:00:00Z"));
      console.log(`Q ${q}\nA [${r.status}] ${r.status === "answered" ? `${r.text} (${r.sources.length} payments)` : r.message}`);
    }
  }
  console.log(`WRITER FAILED ${failed} of ${QUESTIONS.length * times}`);
});
