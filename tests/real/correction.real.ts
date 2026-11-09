// U17's check: does the real correction model tell a one-off from a broader correction, and single out the
// right payment? 10 of each on a sentence about three grocery payments for mum. Costs about $0.01, so it runs
// only by hand: `REAL=1 npx vitest run correction`.
import { expect, it } from "vitest";
import { changeFor, interpret } from "@/lib/correct";
import { askJson } from "@/lib/llm";
import type { Told } from "@/lib/story";
import type { StoryPayment } from "@/lib/totals";

const pays: StoryPayment[] = ["2026-11-02", "2026-11-09", "2026-11-16"].map((d, i) => ({ id: `g${i + 1}`, paypal_txn_id: `T${i}`, occurred_at: `${d}T10:00:00Z`, amount: 46.2, currency: "USD", name: "Weekly groceries", event_code: "T0006", category: "groceries", for_who: "your mum" }));
const mum: Told = { id: "mum", key: "support:your mum", text: "You buy the weekly groceries for your mum.", who: "your mum", category: null, paymentIds: pays.map((p) => p.id) };
const SENTENCE = "Each week the groceries went to your mum.";

// [what the person says, true when it's a one-off, the payment it singles out]
const CASES: [string, boolean, string | null][] = [
  ["that Nov 9 one was a birthday gift for my mum", true, "g2"],
  ["the last one was her birthday present, not groceries", true, "g3"],
  ["only the first one was a gift for mum", true, "g1"],
  ["the Nov 16 one was just this once, for her birthday party", true, "g3"],
  ["the middle one was an exception, I paid for her friend's dinner", true, "g2"],
  ["Nov 2 was a one-time thing, a present for mum", true, "g1"],
  ["that Nov 9 payment was a christmas gift for my mum", true, "g2"],
  ["the one on Nov 16 was a gift card for mum's birthday", true, "g3"],
  ["just that first one was special, it was for her anniversary", true, "g1"],
  ["the second one wasn't groceries, it was a one-off present for mum", true, "g2"],
  ["I buy mum's groceries every week now", false, null],
  ["these are for my mum and dad, not just mum", false, null],
  ["those groceries are for my mum, always", false, null],
  ["I do mum's shopping every week since she moved", false, null],
  ["these were for my sister, not mum", false, null],
  ["they're all for mum, she can't get out much", false, null],
  ["those are actually for my grandma", false, null],
  ["I pay for mum's food every week", false, null],
  ["those were mine, not mum's", false, null],
  ["those are household groceries we share", false, null],
];

it("tells one-offs from broader corrections", async () => {
  const rows: string[] = [];
  let right = 0;
  for (const [said, oneOff, which] of CASES) {
    const r = await interpret(said, SENTENCE, pays, askJson);
    const c = changeFor([mum], r, pays, said);
    const ok = c.oneOff === oneOff && (!oneOff || (c.add.paymentIds.length === 1 && c.add.paymentIds[0] === which));
    right += ok ? 1 : 0;
    rows.push(`${ok ? "ok  " : "MISS"} ${said} → oneOff ${c.oneOff} ${c.add.paymentIds.join(",")} who ${c.add.who} what ${r.what} | ${c.add.text}`);
  }
  console.log(`${rows.join("\n")}\nscore ${right}/${CASES.length}`);
  expect(right).toBeGreaterThanOrEqual(18);
});
