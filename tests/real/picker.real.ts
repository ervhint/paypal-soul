// T-16.13: the question list against the real picker, stopping before the final answer to save credit. Costs
// money, so it runs only by hand: `REAL=1 npx vitest run`. ONLY=3,7 reruns those questions, and SCORE_FILE saves
// the results as JSON. Payments are made up, and today is fixed at Thursday, Nov 5, 2026.
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { pickFunctions, type Picked, type Turn } from "@/lib/chat";
import type { Ledger } from "@/lib/chat-functions";
import { askTools } from "@/lib/llm";
import type { StoryPayment } from "@/lib/totals";
import { QUESTIONS, type Question } from "./questions";

let n = 0;
const pay = (day: string, name: string, amount: number, category: string, extra: Partial<StoryPayment> = {}): StoryPayment => ({ id: `id-${++n}`, paypal_txn_id: `T${n}`, occurred_at: `${day}T10:00:00Z`, amount, currency: "USD", name, payee: "Test Store", event_code: "T0006", category, ...extra });
const payments = [
  pay("2026-09-10", "Gym membership", 30, "sports.sport_activities"),
  pay("2026-10-02", "Weekly groceries", 46.2, "groceries", { for_who: "your mum" }),
  pay("2026-10-09", "Snickers Bar", 1.5, "food_drinks.snacks_drinks"),
  pay("2026-10-20", "Morning coffee", 4.5, "food_drinks.snacks_drinks", { event_code: "T0002" }),
  pay("2026-11-02", "Morning coffee", 4.5, "food_drinks.snacks_drinks", { event_code: "T0002" }),
  pay("2026-11-02", "Bus fare", 2.4, "transportation.daily_transportation", { event_code: "T0002" }),
  pay("2026-11-03", "Mobile data", 15, "bills.mobile_data"),
];
const none = async () => [];
const ledger: Ledger = { today: "2026-11-05", payments, stopped: [], beliefs: none, chapters: none, corrections: none, actions: none, leftOut: none, lastRead: async () => null };

function score(x: Question, p: Picked) {
  if (x.ending) return p.ending === x.ending && !p.calls.length ? null : `wanted ${x.ending}, got ${p.ending} ${p.calls.map((c) => c.name)}`;
  const call = p.calls.find((c) => x.fn!.includes(c.name));
  if (!call) return `wanted ${x.fn}, got ${p.ending} ${p.calls.map((c) => c.name)}`;
  if (x.dates && (call.args.from !== x.dates[0] || call.args.to !== x.dates[1])) return `wanted ${x.dates}, got ${call.args.from} ${call.args.to}`;
  if (x.words && !JSON.stringify(call.args).toLowerCase().includes(x.words)) return `wanted ${x.words}, got ${JSON.stringify(call.args)}`;
  return null;
}

it("scores the picker on the question list", async () => {
  const only = process.env.ONLY?.split(",").map(Number);
  const list = QUESTIONS.map((x, i) => ({ x, i })).filter(({ i }) => !only || only.includes(i));
  const out: { i: number; q: string; miss: string | null; calls: Picked["calls"]; ending: string; rounds: number; ms: number }[] = [];
  const queue = [...list];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const history: Turn[] = (job.x.earlier ?? []).flatMap((e) => [{ role: "user" as const, text: e.question, paymentIds: [] }, { role: "soul" as const, text: e.answer, paymentIds: [] }]);
        const started = Date.now();
        const p = await pickFunctions(job.x.q, ledger, history, askTools).catch((e) => ({ ending: "answer", results: [], rounds: 0, calls: [], remember: null, failed: String(e) }) as Picked & { failed: string });
        out.push({ i: job.i, q: job.x.q, miss: "failed" in p ? p.failed : score(job.x, p), calls: p.calls, ending: p.ending, rounds: p.rounds, ms: Date.now() - started });
      }
    }),
  );
  out.sort((a, b) => a.i - b.i);
  if (process.env.SCORE_FILE) writeFileSync(process.env.SCORE_FILE, JSON.stringify(out, null, 1));
  const missed = out.filter((o) => o.miss);
  for (const m of missed) console.log(`MISS ${m.i} "${m.q}": ${m.miss}`);
  console.log(`SCORE ${out.length - missed.length}/${out.length}, rounds ${out.reduce((t, o) => t + o.rounds, 0)}, slowest ${Math.max(...out.map((o) => o.ms))}ms`);
});
