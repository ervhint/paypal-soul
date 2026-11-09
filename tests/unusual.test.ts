// Unusual payments (U18). Unit: the rule (T-18.1), the story brief and its checks (T-18.5), the card written by
// code, and Chat's find_unusual using the same rule (T-18.6). Integration on Staging: the card shows, Same as
// Usual saves a check Memory doesn't list, and Tell Soul with a birthday gift keeps the payment apart (U17).
import type { CookieMethodsServer } from "@supabase/ssr";
import { afterAll, describe, expect, it } from "vitest";
import { checkArgs, runFunction, type Ledger } from "@/lib/chat-functions";
import { ANSWERED, correct, sameAsUsual, undoCorrection } from "@/lib/correct";
import type { AskJson } from "@/lib/llm";
import { readMemory } from "@/lib/memory";
import { noticeFor, noticeText } from "@/lib/notice";
import { applyTold, briefFor, buildStory, readChapters, readStory, type Told } from "@/lib/story";
import { choosePrepared, preparedAccountId, secretClient, sessionClient } from "@/lib/supabase";
import { unusual, type StoryPayment } from "@/lib/totals";

let n = 0;
const pay = (day: string, name: string, amount: number, extra: Partial<StoryPayment> = {}): StoryPayment => ({
  id: `id-${++n}`,
  paypal_txn_id: `TXN${n}`,
  occurred_at: `${day}T10:00:00Z`,
  amount,
  currency: "USD",
  name,
  payee: "Test Store",
  event_code: "T0006",
  category: "groceries",
  ...extra,
});
const mum = { for_who: "your mum", category: "family_needs.parents" };
const sends = ["2026-10-05", "2026-10-12", "2026-10-19"].map((d) => pay(d, "Sent to your mum", 25, mum));
const big = pay("2026-11-04", "Sent to your mum", 80, mum);
const ids = (ps: StoryPayment[]) => ps.map((p) => p.id);

describe("the unusual rule (T-18.1)", () => {
  it("marks a payment 1.5 times the median of 3 earlier ones and $5 more", () => {
    const [u] = unusual([...sends, big]);
    expect(u).toMatchObject({ usual: 25, who: "your mum" });
    expect(u.payment.id).toBe(big.id);
    expect(ids(u.earlier)).toEqual(ids(sends));
  });

  it("needs 3 earlier payments", () => {
    expect(unusual([sends[0], sends[1], big])).toEqual([]);
  });

  it("needs both 1.5 times and $5 more", () => {
    const cups = ["2026-10-01", "2026-10-02", "2026-10-03"].map((d) => pay(d, "Morning coffee", 4));
    expect(unusual([...cups, pay("2026-10-04", "Morning coffee", 8)])).toEqual([]); // 2 times, only $4 more
    expect(unusual([...sends, pay("2026-11-04", "Sent to your mum", 37, mum)])).toEqual([]); // $12 more, under 1.5 times
    expect(unusual([...sends, pay("2026-11-04", "Sent to your mum", 37.5, mum)])).toHaveLength(1);
  });

  it("groups support by person across names, and the rest by name", () => {
    const groceries = pay("2026-11-04", "Weekly groceries", 80, mum);
    expect(ids(unusual([...sends, groceries]).map((u) => u.payment))).toEqual([groceries.id]);
    expect(unusual([...sends, pay("2026-11-04", "Weekly groceries", 80)])).toEqual([]); // not for mum: a name of its own
  });

  it("leaves one-offs and explained payments out of both sides", () => {
    expect(unusual([...sends, { ...big, one_off: true }])).toEqual([]);
    expect(unusual([...sends, { ...big, explained: true }])).toEqual([]);
    const gift = { ...pay("2026-10-26", "Sent to your mum", 200, mum), one_off: true };
    expect(unusual([...sends, gift, big]).map((u) => u.usual)).toEqual([25]);
    expect(unusual([{ ...sends[0], explained: true }, sends[1], sends[2], big])).toEqual([]); // only 2 earlier left
  });

  it("never marks a payment Soul can't identify, money received, or the earliest of a run", () => {
    const blank = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((d, i) => pay(d, "", i === 3 ? 90 : 5));
    expect(unusual(blank)).toEqual([]);
    expect(unusual([...sends, pay("2026-11-04", "Sent to your mum", -80, mum)])).toEqual([]);
    expect(unusual([...sends, pay("2026-10-01", "Sent to your mum", 80, mum)])).toEqual([]); // the big one came first, so nothing earlier to compare with
  });
});

describe("the card and the story brief (T-18.5)", () => {
  const all = [...sends, big];
  const [u] = unusual(all);

  it("the card is code's sentence and question, with the payment first and the earlier ones newest first", () => {
    expect(noticeText(u)).toEqual({ sentence: "This $80.00 for your mum on Nov 4 is bigger than your usual $25.00.", question: "Does it have a different purpose?" });
    const name = unusual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((d, i) => pay(d, "weekly groceries", i === 3 ? 90 : 40)));
    expect(noticeText(name[0]).sentence).toBe("This $90.00 for Weekly Groceries on Oct 4 is bigger than your usual $40.00.");
    const chapters = [
      { id: "new", week: null, paymentIds: [big.id], claims: [{ id: "c0", paymentIds: [big.id] }] }, // the send's own New chapter: no week to rewrite
      { id: "nov", week: "2026-11-02", paymentIds: [big.id], claims: [{ id: "c1", paymentIds: ["x"] }, { id: "c2", paymentIds: [big.id] }] },
      { id: "oct", week: "2026-10-19", paymentIds: ids(sends), claims: [{ id: "c3", paymentIds: ids(sends) }] },
    ];
    expect(noticeFor(chapters, [u])).toEqual({ chapterId: "nov", claimId: "c2", paymentId: big.id, ...noticeText(u), paymentIds: [big.id, sends[2].id, sends[1].id, sends[0].id] });
    expect(noticeFor(chapters, [])).toBe(null);
  });

  it("the brief gives the week's unusual payment with the usual amount and the earlier payments by ref", () => {
    const { data } = briefFor(["2026-11-02"], all);
    expect(data.weeks[0].unusual).toEqual([{ paymentRef: "p1", amount: "$80.00", usual: "$25.00", for: "your mum", earlierRefs: ["p2", "p3", "p4"] }]);
    expect(briefFor(["2026-10-12"], all).data.weeks[0].unusual).toBeUndefined();
  });

  it("a sentence may state it with code's figures and cite the earlier payments; a made-up usual amount is dropped", () => {
    const brief = briefFor(["2026-11-02"], all);
    const answer = (text: string) =>
      JSON.stringify({ chapters: [{ week: "2026-11-02", title: "A Bigger Send", claims: [{ text, payments: ["p1", "p2", "p3", "p4"] }, { text: "You sent money to your mum.", payments: ["p1"] }] }] });
    const [ok] = readChapters(answer("Your Nov 4 payment for your mum was $80.00, more than the usual $25.00."), brief, all);
    expect(ok.claims[0].paymentIds).toEqual([big.id, ...ids(sends)]);
    const [bad] = readChapters(answer("Your Nov 4 payment for your mum was $80.00, more than the usual $30.00."), brief, all);
    expect(bad.claims.map((c) => c.text)).toEqual(["You sent money to your mum."]);
  });

  it("an explained payment isn't in the brief or on the card", () => {
    const told: Told[] = [{ id: "off", key: `oneoff:${big.id}`, text: "A birthday gift for your mum.", who: "your mum", category: null, paymentIds: [big.id] }];
    expect(briefFor(["2026-11-02"], applyTold(all, told), told).data.weeks[0].unusual).toBeUndefined();
    expect(unusual([...sends, { ...big, explained: true }])).toEqual([]);
  });
});

describe("Chat's find_unusual uses the same rule (T-18.6)", () => {
  const ledger = (payments: StoryPayment[]): Ledger => ({
    today: "2026-11-09",
    payments,
    stopped: [],
    beliefs: async () => [],
    chapters: async () => [],
    corrections: async () => [],
    actions: async () => [],
    leftOut: async () => [],
    lastRead: async () => null,
  });
  const run = async (payments: StoryPayment[], args: Record<string, unknown> = {}) => {
    const c = checkArgs("find_unusual", JSON.stringify(args));
    if ("error" in c) throw new Error(c.error);
    return runFunction("find_unusual", c.args, ledger(payments));
  };

  it("finds what the story finds, with the person and the usual amount backed by the earlier payments", async () => {
    const r = await run([...sends, big]);
    expect(r.data.found).toEqual([{ name: "Sent to your mum", for: "your mum", date: "Nov 4", amount: "$80.00", usual: "$25.00" }]);
    expect(ids(r.behind)).toEqual([big.id]);
    expect(r.figures.find((f) => f.cents === 2500)!.ids).toEqual(ids(sends));
  });

  it("leaves out one-offs, explained payments, and payments outside the period", async () => {
    expect((await run([...sends, { ...big, one_off: true }])).data.found).toEqual([]);
    expect((await run([...sends, { ...big, explained: true }])).data.found).toEqual([]);
    expect((await run([...sends, big], { from: "2026-10-01", to: "2026-10-31" })).data.found).toEqual([]);
  });
});

// ---- Integration on Staging ----

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
  for (const id of made) await secretClient().auth.admin.deleteUser(id); // cascades to the test payments
});

/** A mocked LLM: the card's correction is a one-off; the story writes one sentence a week from its payments. */
const llm: AskJson = async (purpose, _, user) => {
  const data = JSON.parse(user.slice(user.indexOf("\n") + 1));
  if (purpose === "correction") return JSON.stringify({ forSomeone: false, payments: ["p1"], oneOff: true, what: "a birthday gift", belief: "That one was a birthday gift." });
  const b = data as ReturnType<typeof briefFor>["data"];
  return JSON.stringify({ chapters: b.weeks.map((w) => ({ week: w.week, title: "A Week", claims: [{ text: "You made some payments.", payments: w.paymentRefs }] })) });
};

describe("the I Noticed card on Staging (T-18.2–T-18.4, BFF)", () => {
  it("shows, Same as Usual hides it for good, and Tell Soul with a birthday gift keeps the next one apart", async () => {
    const db = browser();
    const id = await choosePrepared(db(), null);
    made.push(id);
    const accountId = await preparedAccountId();
    // Two payments only this visitor sees, far bigger than the prepared repeat with the most payments.
    const { data: shared } = await secretClient().from("payment").select("name, amount, category").eq("account_id", accountId).is("person_id", null);
    const byName = new Map<string, { name: string; amount: number; category: string | null }[]>();
    for (const p of shared!) if (p.name && Number(p.amount) > 0) byName.set(p.name.toLowerCase(), [...(byName.get(p.name.toLowerCase()) ?? []), p]);
    const run = [...byName.values()].sort((x, y) => y.length - x.length)[0];
    expect(run.length).toBeGreaterThanOrEqual(3);
    const top = Math.max(...run.map((p) => Number(p.amount)));
    const later = (d: number) => new Date(Date.now() + d * 60_000).toISOString();
    const odd = (txn: string, at: string) => ({ account_id: accountId, person_id: id, paypal_txn_id: txn, occurred_at: at, amount: top * 2 + 10, currency: "USD", name: run[0].name, payee: "Test Store", event_code: "T0006", category: run[0].category });
    const { data: rows, error } = await secretClient().from("payment").insert([odd(`U18-A-${id}`, later(-2)), odd(`U18-B-${id}`, later(-1))]).select("id, paypal_txn_id");
    if (error) throw error;
    const [a, b] = [rows!.find((r) => r.paypal_txn_id.startsWith("U18-A"))!.id, rows!.find((r) => r.paypal_txn_id.startsWith("U18-B"))!.id];
    await buildStory(db(), id, accountId, llm);

    // T-18.2: the first unexplained one is asked about, and Belief to Check counts it.
    const s1 = await readStory(db(), accountId);
    expect(s1.notice).toMatchObject({ paymentId: a, chapterId: s1.chapters[0].id, question: "Does it have a different purpose?" });
    expect(s1.notice!.sentence).toMatch(/^This \$[\d.]+ for .+ is bigger than your usual \$[\d.]+\.$/);
    expect(s1.notice!.paymentIds.length).toBeGreaterThanOrEqual(4);
    expect(s1.summary.checks).toBe(s1.memory.filter((m) => m.sure === "Not Sure").length + 1);

    // T-18.4: Same as Usual rewrites nothing, isn't listed on Memory, and the question isn't asked again.
    const chaptersBefore = s1.chapters.map((c) => c.claims.map((k) => k.id));
    expect(await sameAsUsual(db(), id, accountId, a)).toEqual({ status: "done" });
    expect(await sameAsUsual(db(), id, accountId, a)).toEqual({ status: "error", message: ANSWERED });
    const s2 = await readStory(db(), accountId);
    expect(s2.chapters.map((c) => c.claims.map((k) => k.id))).toEqual(chaptersBefore);
    expect(s2.notice?.paymentId).toBe(b); // the second one is still bigger than usual
    expect((await readMemory(db(), accountId)).memory.some((m) => m.kind === "check")).toBe(false);

    // T-18.3: Tell Soul "it was a birthday gift" on the card makes a one-off (U17), rewrites, and the card goes.
    const r = await correct(db(), id, accountId, { claimId: s2.notice!.claimId, said: "it was a birthday gift", paymentId: b }, llm);
    expect(r).toEqual({ status: "done" });
    const s3 = await readStory(db(), accountId);
    expect(s3.notice).toBe(null);
    expect(s3.memory.find((m) => m.oneOff)).toMatchObject({ text: "That one was a birthday gift.", paymentIds: [b] });
    expect(s3.change!.notes[0]).toBe("1 payment kept apart as a one-off: a birthday gift.");
    expect(await correct(db(), id, accountId, { claimId: s3.chapters[0].claims[0].id, said: "again", paymentId: b }, llm)).toEqual({ status: "error", message: ANSWERED });

    // Undo takes back the one-off and the answer, so the card asks again.
    expect(await undoCorrection(db(), id, accountId, s3.change!.id)).toEqual({ status: "done" });
    const s4 = await readStory(db(), accountId);
    expect(s4.notice?.paymentId).toBe(b);
    expect(s4.memory.some((m) => m.oneOff)).toBe(false);
  });
});
