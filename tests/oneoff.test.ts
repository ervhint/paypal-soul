// One-offs (U17). Unit: a correction that marks one payment as an exception gets its own belief, and the broader
// belief keeps its text and its other payments (T-17.1); the story brief marks it apart (T-17.2); repeats,
// habits and interests leave it out (T-17.3). Integration on Staging (T-17.4).
import type { CookieMethodsServer } from "@supabase/ssr";
import { afterAll, describe, expect, it } from "vitest";
import { changeFor, changeNotes, correct, readReading } from "@/lib/correct";
import type { AskJson } from "@/lib/llm";
import { applyTold, briefFor, buildStory, readStory, type Told } from "@/lib/story";
import { choosePrepared, preparedAccountId, secretClient, sessionClient } from "@/lib/supabase";
import { interests, repeats, totals, type StoryPayment } from "@/lib/totals";

let n = 0;
const pay = (day: string, name: string, amount: number, category: string): StoryPayment => ({
  id: `id-${++n}`,
  paypal_txn_id: `TXN${n}`,
  occurred_at: `${day}T10:00:00Z`,
  amount,
  currency: "USD",
  name,
  payee: "Test Store",
  event_code: "T0006",
  category,
});
const groceries = ["2026-11-02", "2026-11-04", "2026-11-06"].map((d) => pay(d, "Weekly groceries", 46.2, "groceries"));
const coffee = pay("2026-11-03", "Morning coffee", 4.5, "food_drinks.snacks_drinks");
const all = [...groceries, coffee];
const mum: Told = { id: "mum", key: "support:your mum", text: "You buy the weekly groceries for your mum.", who: "your mum", category: null, paymentIds: groceries.map((p) => p.id) };
const refs = new Map(groceries.map((p, i) => [`p${i + 1}`, p.id]));
const gift = { forSomeone: true, who: "your mum", category: "gift_charity.gift", payments: ["p2"], oneOff: true, what: "a birthday gift for your mum", belief: "You sent your mum a birthday gift on Nov 4." };

describe("a one-off correction (T-17.1)", () => {
  it("becomes its own belief, and the support belief keeps its text and its other payments", () => {
    const r = readReading(JSON.stringify(gift), refs);
    const c = changeFor([mum], r, groceries, "that one was a birthday gift for my mum");
    expect(c.oneOff).toBe(true);
    expect(c.add).toMatchObject({ key: `oneoff:${groceries[1].id}`, who: "your mum", paymentIds: [groceries[1].id] });
    expect(c.next.find((t) => t.id === "mum")).toEqual({ ...mum, paymentIds: [groceries[0].id, groceries[2].id] });
  });

  it("isn't a one-off when it covers every payment of the sentence and of the belief", () => {
    const r = readReading(JSON.stringify({ ...gift, payments: ["p1", "p2", "p3"] }), refs);
    const c = changeFor([mum], r, groceries, "those were birthday gifts");
    expect(c.oneOff).toBe(false);
    expect(c.add.key).toBe(null); // a category, so not a support key, as before U17
  });

  it("is a one-off on a sentence about one payment when the belief holds more", () => {
    const one = new Map([["p1", groceries[1].id]]);
    const r = readReading(JSON.stringify({ ...gift, payments: ["p1"] }), one);
    expect(changeFor([mum], r, [groceries[1]], "that was a birthday gift").oneOff).toBe(true);
  });

  it("leaves every one-off as it was when a later correction changes the broader belief (AC-17.4)", () => {
    const off: Told = { id: "off", key: `oneoff:${groceries[1].id}`, text: "You sent your mum a birthday gift.", who: "your mum", category: "gift_charity.gift", paymentIds: [groceries[1].id] };
    const kept = { ...mum, paymentIds: [groceries[0].id, groceries[2].id] };
    const r = readReading(JSON.stringify({ forSomeone: true, who: "your mum", payments: ["p1", "p2", "p3"], oneOff: false, belief: "You buy your mum's groceries every week now." }), refs);
    const c = changeFor([kept, off], r, groceries, "I buy mum's groceries every week now");
    expect(c.oneOff).toBe(false);
    expect(c.add).toMatchObject({ id: "mum", text: "You buy your mum's groceries every week now.", paymentIds: [groceries[0].id, groceries[2].id] });
    expect(c.next.find((t) => t.id === "off")).toEqual(off);
  });

  it("says in Here's What Changed that the payment was kept apart and the broader belief didn't change (AC-17.5)", () => {
    const r = readReading(JSON.stringify(gift), refs);
    const c = changeFor([mum], r, groceries, "that one was a birthday gift for my mum");
    const [before, after] = [applyTold(all, [mum]), applyTold(all, c.next)];
    const notes = changeNotes({ belief: c.add.text, who: c.add.who, targets: c.add.paymentIds, before, after, titleBefore: "A", titleAfter: "A", oneOff: { what: r.what!, kept: [mum] } });
    expect(notes).toEqual([
      "1 payment kept apart as a one-off: a birthday gift for your mum.",
      "Support for your mum stays as it was.",
      "Weekly groceries: Groceries → Gift & Charity → Gift.",
    ]);
  });
});

describe("a one-off in the story (T-17.2) and the counts (T-17.3)", () => {
  const off: Told = { id: "off", key: `oneoff:${groceries[1].id}`, text: "You sent your mum a birthday gift on Nov 4.", who: "your mum", category: "gift_charity.gift", paymentIds: [groceries[1].id] };
  const told = [{ ...mum, paymentIds: [groceries[0].id, groceries[2].id] }, off];
  const seen = applyTold(all, told);

  it("is marked as an exception in toldYou, and Spent on You leaves it out", () => {
    const { data } = briefFor(["2026-11-02"], seen, told);
    expect(data.weeks[0].toldYou).toEqual([
      { said: "You buy the weekly groceries for your mum.", paymentRefs: ["p1", "p3"] },
      { said: "You sent your mum a birthday gift on Nov 4.", paymentRefs: ["p2"], oneOff: true },
    ]);
    expect(totals(seen).onYou).toBe(4.5);
  });

  it("is left out of repeats, habits and interests", () => {
    const [r] = repeats(seen);
    expect(r).toMatchObject({ name: "Weekly groceries", days: 2, payments: 2, spent: 92.4 });
    expect(r.paymentIds).not.toContain(groceries[1].id);
    const gifts = ["2026-10-01", "2026-10-05", "2026-10-09"].map((d) => pay(d, "Gift card", 10, "gift_charity.gift"));
    const self: Told = { id: "self", key: `oneoff:${gifts[0].id}`, text: "Just this once.", who: null, category: null, paymentIds: [gifts[0].id] };
    expect(interests(applyTold(gifts, [])).map((i) => i.days)).toEqual([3]);
    expect(interests(applyTold(gifts, [self]))).toEqual([]);
  });
});

// ---- Integration on Staging (T-17.4) ----

function browser() {
  const jar = new Map<string, string>();
  const cookies: CookieMethodsServer = {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (all) => all.forEach((c) => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))),
  };
  return () => sessionClient(cookies);
}
const made: string[] = [];
afterAll(async () => {
  for (const id of made) await secretClient().auth.admin.deleteUser(id);
});

/** A mocked LLM: corrections say what `said` asks for; the story writes one sentence per told belief and one for the rest. */
const llm: AskJson = async (purpose, _, user) => {
  const data = JSON.parse(user.slice(user.indexOf("\n") + 1));
  if (purpose === "correction") {
    const shop = (data.payments as { ref: string; name: string; date: string }[]).filter((p) => /groceries/i.test(p.name));
    if (/birthday/i.test(data.said)) return JSON.stringify({ forSomeone: true, who: "your mum", payments: [shop.at(-1)!.ref], oneOff: true, what: "a birthday gift for your mum", belief: "You sent your mum a birthday gift." });
    if (/every week/i.test(data.said)) return JSON.stringify({ forSomeone: true, who: "your mum", payments: shop.map((p) => p.ref), oneOff: false, belief: "You buy your mum's groceries every week now." });
    return JSON.stringify({ forSomeone: true, who: "your mum", payments: shop.map((p) => p.ref), oneOff: false, belief: "You buy the weekly groceries for your mum." });
  }
  const b = data as ReturnType<typeof briefFor>["data"];
  return JSON.stringify({
    chapters: b.weeks.map((w) => {
      const told = (w.toldYou ?? []).map((t) => ({ text: t.oneOff ? "Apart from the usual, one was a gift." : "The weekly groceries went to your mum.", payments: t.paymentRefs }));
      const rest = w.paymentRefs.filter((r) => !told.some((t) => t.payments.includes(r)));
      const shop = rest.filter((r) => /groceries/i.test(b.payments.find((p) => p.ref === r)!.name));
      return {
        week: w.week,
        title: "A Week",
        claims: [...told, ...(shop.length ? [{ text: "Weekly groceries were your biggest spend.", payments: shop }] : []), { text: "The rest went on small things.", payments: rest.filter((r) => !shop.includes(r)) }].filter((c) => c.payments.length),
      };
    }),
  });
};

describe("one-offs on Staging (T-17.4)", () => {
  it("keeps the one-off apart, and a broader correction changes only the support belief", async () => {
    const db = browser();
    const id = await choosePrepared(db(), null);
    made.push(id);
    const accountId = await preparedAccountId();
    await buildStory(db(), id, accountId, llm);
    const claimFor = async (like: string) => (await db().from("claim").select("id").like("text", like).limit(1).single()).data!.id;
    const beliefs = async () => (await db().from("belief").select("id, kind, key, text, who, payment_ids, active").in("kind", ["support", "told"]).order("created_at")).data!;

    expect((await correct(db(), id, accountId, { claimId: await claimFor("%groceries%"), said: "those groceries are for my mum" }, llm)).status).toBe("done");
    const [support] = await beliefs();
    expect(support.payment_ids).toHaveLength(2);

    expect((await correct(db(), id, accountId, { claimId: await claimFor("%went to your mum%"), said: "that last one was a birthday gift for my mum" }, llm)).status).toBe("done");
    const [s1, off] = await beliefs();
    expect(s1).toMatchObject({ id: support.id, text: "You buy the weekly groceries for your mum.", payment_ids: [support.payment_ids[0]] });
    expect(off).toMatchObject({ kind: "support", key: `oneoff:${support.payment_ids[1]}`, who: "your mum", payment_ids: [support.payment_ids[1]] });
    const story = await readStory(db(), accountId);
    expect(story.change!.notes.slice(0, 2)).toEqual(["1 payment kept apart as a one-off: a birthday gift for your mum.", "Support for your mum stays as it was."]);
    expect(story.memory.find((m) => m.id === off.id)?.oneOff).toBe(true);

    expect((await correct(db(), id, accountId, { claimId: await claimFor("%went to your mum%"), said: "I buy mum's groceries every week now" }, llm)).status).toBe("done");
    const [s2, off2] = await beliefs();
    expect(s2).toMatchObject({ id: support.id, text: "You buy your mum's groceries every week now.", payment_ids: [support.payment_ids[0]] });
    expect(off2).toEqual(off);
  });
});
