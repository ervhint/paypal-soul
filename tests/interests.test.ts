// Interests (U13). Unit (T-13.1): code finds them from repeated categories, and a sentence naming one links
// to it. Integration on Staging (the BFF side of T-13.2): a test person on the prepared payments gets an
// interest with payments, and corrects it like any other belief.
import type { CookieMethodsServer } from "@supabase/ssr";
import { afterAll, describe, expect, it } from "vitest";
import type { AskJson } from "@/lib/llm";
import { editBelief, keyAfter, readMemory, setUsing } from "@/lib/memory";
import { briefFor, buildStory, readChapters } from "@/lib/story";
import { choosePrepared, preparedAccountId, secretClient, sessionClient } from "@/lib/supabase";
import { interests, type StoryPayment } from "@/lib/totals";

let n = 0;
const pay = (day: string, name: string, category: string, extra: Partial<StoryPayment> = {}): StoryPayment => ({
  id: `id-${++n}`,
  paypal_txn_id: `TXN${n}`,
  occurred_at: `${day}T10:00:00Z`,
  amount: 10,
  currency: "USD",
  name,
  event_code: "T0006",
  category,
  ...extra,
});
const days = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];
const books = (count: number, extra: Partial<StoryPayment> = {}) => days.slice(0, count).map((d, i) => pay(d, `Book ${i}`, "hobby_entertainment.books", extra));

describe("interests from repeated categories (T-13.1)", () => {
  it("states an interest for a category on 3 or more days, with its payments, even across different names", () => {
    const ps = books(3);
    expect(interests(ps)).toEqual([{ key: "interest:hobby_entertainment.books", category: "Books", days: 3, payments: 3, spent: 30, paymentIds: ps.map((p) => p.id), sureness: "not_sure" }]);
  });

  it("grows surer the way a habit does, and needs 3 days", () => {
    expect(interests(books(2))).toEqual([]);
    expect(interests(books(5))[0].sureness).toBe("fairly_sure");
  });

  it("leaves out necessities, unknown payments, money received and what was for someone else", () => {
    const three = (category: string, extra: Partial<StoryPayment> = {}) => days.slice(0, 3).map((d) => pay(d, "Thing", category, extra));
    expect(interests([...three("bills.mobile_data"), ...three("transportation.daily_transportation"), ...three("groceries"), ...three("unknown")])).toEqual([]);
    expect(interests(books(3, { amount: -10 }))).toEqual([]);
    expect(interests(books(3, { for_who: "your mum" }))).toEqual([]);
  });

  it("leaves out a stopped interest", () => {
    expect(interests(books(3), ["interest:hobby_entertainment.books"])).toEqual([]);
  });

  it("gives the LLM the interest for its week, and a sentence naming it keeps the link", () => {
    const ps = books(3);
    const brief = briefFor(["2026-11-02"], ps);
    const [i] = brief.data.weeks[0].interests!;
    expect(i).toMatchObject({ ref: "i1", category: "Books", days: 3, spent: "$30.00", sureness: "not_sure" });
    const answer = { chapters: [{ week: "2026-11-02", title: "Books", claims: [{ text: "I think you enjoy books, $30.00 so far.", payments: i.paymentRefs, interest: "i1" }, { text: "A made-up link.", payments: i.paymentRefs, interest: "i9" }] }] };
    const [ch] = readChapters(JSON.stringify(answer), brief, ps);
    expect(ch.claims[0].interest).toBe("interest:hobby_entertainment.books");
    expect(ch.claims[1].interest).toBeUndefined();
  });

  it("keeps an interest's key through an edit, so a rebuild leaves the person's words", () => {
    expect(keyAfter({ key: "interest:groceries", who: null }, "your mum", null)).toBe("interest:groceries");
  });
});

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

type Brief = ReturnType<typeof briefFor>["data"];
/** A mocked LLM: one sentence a week, and an edit that names nobody. Records the briefs it was given. */
function llm() {
  const briefs: Brief[] = [];
  const ask: AskJson = async (purpose, _, user) => {
    const data = JSON.parse(user.slice(user.indexOf("\n") + 1));
    if (purpose === "correction") return JSON.stringify({ forSomeone: false, forSelf: false, who: null, payments: data.payments.map((p: { ref: string }) => p.ref), belief: null });
    briefs.push(data);
    return JSON.stringify({ chapters: (data as Brief).weeks.map((w) => ({ week: w.week, title: "A Week", claims: [{ text: "The week went on small things.", payments: w.paymentRefs }] })) });
  };
  return { ask, briefs };
}

describe("an interest on Staging (T-13.2)", () => {
  it("shows with its payments, keeps an edit through a rebuild, and can be stopped", async () => {
    const db = browser();
    const id = await choosePrepared(db(), null);
    made.push(id);
    const accountId = await preparedAccountId();
    await buildStory(db(), id, accountId, llm().ask);

    const { memory } = await readMemory(db(), accountId);
    const interest = memory.find((m) => m.kind === "interest" && m.text.includes("Snacks & Drinks"))!;
    expect(interest.paymentIds.length).toBeGreaterThan(0);
    expect(interest.source).toMatch(/\d+ Days/);

    const said = "Coffee is just how I start work, not a hobby.";
    const edit = llm();
    expect((await editBelief(db(), id, accountId, { id: interest.id, text: said }, edit.ask)).status).toBe("done");
    const named = (m: ReturnType<typeof llm>) => m.briefs.flatMap((b) => b.weeks.flatMap((w) => w.interests ?? [])).filter((i) => i.category === "Snacks & Drinks");
    expect(edit.briefs.length).toBeGreaterThan(0);
    expect(named(edit)).toEqual([]); // the rewrite says their words, not the interest they replaced
    await db().from("chapter").delete().eq("account_id", accountId); // every week stale, so the rebuild runs in full
    const rebuild = llm();
    await buildStory(db(), id, accountId, rebuild.ask);
    expect(named(rebuild)).toEqual([]);
    const edited = (await readMemory(db(), accountId)).memory.filter((m) => m.id === interest.id || m.text.includes("keep coming back to Snacks"));
    expect(edited).toHaveLength(1);
    expect(edited[0]).toMatchObject({ kind: "told", text: said, sure: "Sure" });

    const stop = llm();
    expect((await setUsing(db(), id, accountId, interest.id, false, stop.ask)).status).toBe("done");
    expect(stop.briefs.flatMap((b) => b.weeks.flatMap((w) => w.interests ?? []))).toEqual([]);
    await buildStory(db(), id, accountId, llm().ask);
    expect((await readMemory(db(), accountId)).memory.find((m) => m.id === interest.id)!.active).toBe(false);
  }, 60_000);

  it("drops an interest once a correction leaves too few days for it", async () => {
    const db = browser();
    const id = await choosePrepared(db(), null);
    made.push(id);
    const accountId = await preparedAccountId();
    await buildStory(db(), id, accountId, llm().ask);
    const { memory, payments } = await readMemory(db(), accountId);
    const interest = memory.find((m) => m.kind === "interest" && m.text.includes("Snacks & Drinks"))!;
    expect(payments.length).toBeGreaterThan(0);

    const { error } = await db().from("belief").insert({ person_id: id, account_id: accountId, kind: "support", key: "support:sam", text: "The coffees are for Sam.", who: "Sam", sureness: "sure", source: "You Told Me", payment_ids: interest.paymentIds });
    expect(error).toBeNull();
    await buildStory(db(), id, accountId, llm().ask);
    expect((await readMemory(db(), accountId)).memory.some((m) => m.id === interest.id)).toBe(false);
  }, 60_000);
});
