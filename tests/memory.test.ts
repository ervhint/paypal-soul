// The Memory page (U6). Unit: what an edit means for who and the key, and a stopped habit leaving what the
// LLM gets. Integration on Staging (T-6.3, and the BFF side of T-6.1 and T-6.2): a test person on the
// prepared payments edits a belief, stops it, rebuilds, asks chat, and uses it again.
import type { CookieMethodsServer } from "@supabase/ssr";
import { afterAll, describe, expect, it } from "vitest";
import { answer, briefFor as chatBrief, chatStore, findPayments } from "@/lib/chat";
import { correct, type Reading } from "@/lib/correct";
import type { AskJson } from "@/lib/llm";
import { editBelief, keyAfter, readMemory, setUsing, whoAfter } from "@/lib/memory";
import { briefFor, buildStory, readStory } from "@/lib/story";
import { choosePrepared, preparedAccountId, secretClient, sessionClient } from "@/lib/supabase";
import type { StoryPayment } from "@/lib/totals";

const pay = (i: number, day: string, name: string): StoryPayment => ({
  id: `id-${i}`,
  paypal_txn_id: `TXN${i}`,
  occurred_at: `${day}T10:00:00Z`,
  amount: 4.5,
  currency: "USD",
  name,
  payee: "Test Store",
  event_code: "T0006",
  category: "food_drinks.snacks_drinks",
});
const coffee = ["2026-11-02", "2026-11-03", "2026-11-04"].map((d, i) => pay(i, d, "Morning coffee"));
const reading = (r: Partial<Reading>): Reading => ({ who: null, forSelf: false, needsWho: false, category: null, paymentIds: [], belief: null, ...r });

describe("what an edit means", () => {
  it("keeps who the payments are for unless the edit names someone or says they were the person's own", () => {
    expect(whoAfter(reading({}), "your mum")).toBe("your mum");
    expect(whoAfter(reading({ who: "your sister" }), "your mum")).toBe("your sister");
    expect(whoAfter(reading({ forSelf: true }), "your mum")).toBeNull();
  });

  it("gives a belief the key for its person, and a habit keeps its own so a rebuild finds it", () => {
    expect(keyAfter({ key: "support:your mum", who: "your mum" }, "your mum", null)).toBe("support:your mum");
    expect(keyAfter({ key: "support:your mum", who: "your mum" }, "your sister", null)).toBe("support:your sister");
    expect(keyAfter({ key: "support:your mum", who: "your mum" }, null, null)).toBeNull();
    expect(keyAfter({ key: "habit:morning coffee", who: null }, "your mum", null)).toBe("habit:morning coffee");
  });
});

describe("a stopped habit", () => {
  it("leaves the repeats the story LLM gets, and its payments stay", () => {
    const { data } = briefFor(["2026-11-02"], coffee, [], ["morning coffee"]);
    expect(data.weeks[0].repeats).toEqual([]);
    expect(data.weeks[0].paymentRefs).toHaveLength(3);
    expect(briefFor(["2026-11-02"], coffee).data.weeks[0].repeats).toHaveLength(1);
  });

  it("leaves the repeats chat gets and finds", () => {
    const found = findPayments("coffee", coffee)!;
    expect(chatBrief("coffee", found, [], [], ["morning coffee"]).data.found.repeats).toEqual([]);
    expect(findPayments("any habits?", coffee)?.how).toBe("repeats");
    expect(findPayments("any habits?", coffee, [], ["morning coffee"])?.how).toBe("all");
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
  for (const id of made) await secretClient().auth.admin.deleteUser(id);
});
const enter = async () => {
  const db = browser();
  const id = await choosePrepared(db(), null);
  made.push(id);
  return { db, id, accountId: await preparedAccountId() };
};

type Brief = ReturnType<typeof briefFor>["data"];
/** A mocked LLM: the story repeats what it was told about the groceries; the reading says who the words name. */
function llm(fail = false) {
  const briefs: Brief[] = [];
  const asked: string[] = [];
  const ask: AskJson = async (purpose, _, user) => {
    const data = JSON.parse(user.slice(user.indexOf("\n") + 1));
    asked.push(purpose);
    if (purpose === "correction") {
      const who = /sister/i.test(data.said) ? "your sister" : /mum/i.test(data.said) || data.answer === "Mum" ? "your mum" : null;
      const refs = (data.payments as { ref: string; name: string }[]).map((p) => p.ref);
      return JSON.stringify({ forSomeone: !!who || /aren't for me/.test(data.said), forSelf: /mine/.test(data.said), who, payments: refs, belief: "You buy the weekly groceries for your mum." });
    }
    if (purpose === "chat") return JSON.stringify({ answer: "Here they are.", payments: data.found.payments.map((p: { ref: string }) => p.ref) });
    if (fail) throw new Error("OpenRouter returned 500");
    const b = data as Brief;
    briefs.push(b);
    const ref = new Map(b.payments.map((p) => [p.ref, p]));
    return JSON.stringify({
      chapters: b.weeks.map((w) => {
        const shop = w.paymentRefs.filter((r) => /groceries/i.test(ref.get(r)!.name));
        const rest = w.paymentRefs.filter((r) => !shop.includes(r));
        const said = w.toldYou?.find((t) => t.paymentRefs.some((r) => shop.includes(r)))?.said;
        return {
          week: w.week,
          title: said ? "What You Told Me" : "A Week of Payments",
          claims: [
            ...(shop.length ? [{ text: said ? `Told: ${said}` : "Weekly groceries were your biggest spend.", payments: shop }] : []),
            ...(rest.length ? [{ text: "The rest went on small things.", payments: rest }] : []),
          ],
        };
      }),
    });
  };
  return { ask, briefs, asked };
}

const claims = async (p: Awaited<ReturnType<typeof enter>>) => (await readStory(p.db(), p.accountId)).chapters.flatMap((c) => c.claims.map((k) => k.text));
/** A person who told Soul the groceries are for their mum. */
const corrected = async () => {
  const p = await enter();
  await buildStory(p.db(), p.id, p.accountId, llm().ask);
  const { data: claim } = await p.db().from("claim").select("id").like("text", "%groceries%").limit(1).single();
  expect(await correct(p.db(), p.id, p.accountId, { claimId: claim!.id, said: "those groceries are for my mum" }, llm().ask)).toEqual({ status: "done" });
  const { memory, payments } = await readMemory(p.db(), p.accountId);
  return { p, belief: memory.find((m) => m.kind === "support")!, payments };
};

describe("Memory on Staging", () => {
  it("lists each belief with how sure, its source and its payments (T-6.1)", async () => {
    const { belief, payments } = await corrected();
    expect(belief).toMatchObject({ text: "You buy the weekly groceries for your mum.", sure: "Sure", active: true });
    expect(belief.source).toMatch(/^You Told Me, /);
    expect(payments.filter((x) => belief.paymentIds.includes(x.id)).length).toBeGreaterThan(0);
  });

  it("saves an edit as a correction, keeps the person's words, and the story uses them after a rebuild (T-6.2)", async () => {
    const { p, belief } = await corrected();
    const said = "The groceries are for my sister now";
    expect(await editBelief(p.db(), p.id, p.accountId, { id: belief.id, text: said }, llm().ask)).toEqual({ status: "done" });

    const { data: b } = await p.db().from("belief").select("text, who, kind, key, sureness").eq("id", belief.id).single();
    expect(b).toEqual({ text: said, who: "your sister", kind: "support", key: "support:your sister", sureness: "sure" });
    const { data: rows } = await p.db().from("correction").select("said, belief_before, belief_after").eq("belief_id", belief.id).order("created_at", { ascending: false }).limit(1);
    expect(rows![0]).toEqual({ said, belief_before: belief.text, belief_after: said });
    expect(await claims(p)).toContain(`Told: ${said}`);
    const story = await readStory(p.db(), p.accountId);
    expect(story.change?.after).toBe(`Told: ${said}`);

    await p.db().from("chapter").delete().eq("account_id", p.accountId);
    await buildStory(p.db(), p.id, p.accountId, llm().ask);
    expect(await claims(p)).toContain(`Told: ${said}`);
  });

  it("stops counting support when an edit says the payments were the person's own", async () => {
    const { p, belief } = await corrected();
    const before = (await readStory(p.db(), p.accountId)).summary.spent;
    expect(await editBelief(p.db(), p.id, p.accountId, { id: belief.id, text: "The groceries are mine after all" }, llm().ask)).toEqual({ status: "done" });
    expect((await p.db().from("belief").select("kind, who, key").eq("id", belief.id).single()).data).toEqual({ kind: "told", who: null, key: null });
    expect((await readStory(p.db(), p.accountId)).summary.spent).toBeGreaterThan(before);
  });

  it("asks who when an edit needs a person, and changes nothing when the rewrite fails", async () => {
    const { p, belief } = await corrected();
    const said = "These aren't for me";
    expect((await editBelief(p.db(), p.id, p.accountId, { id: belief.id, text: said }, llm().ask)).status).toBe("ask");
    expect((await editBelief(p.db(), p.id, p.accountId, { id: belief.id, text: "For my sister", answer: undefined }, llm(true).ask)).status).toBe("error");
    expect((await p.db().from("belief").select("text").eq("id", belief.id).single()).data).toEqual({ text: belief.text });
    expect((await setUsing(p.db(), p.id, p.accountId, belief.id, false, llm(true).ask)).status).toBe("error");
    expect((await p.db().from("belief").select("active").eq("id", belief.id).single()).data).toEqual({ active: true });
  });

  it("stops using a told belief in the story and chat, and it stays stopped after a rebuild (T-6.3)", async () => {
    const { p, belief } = await corrected();
    const lower = (await readStory(p.db(), p.accountId)).summary.spent;
    expect(await setUsing(p.db(), p.id, p.accountId, belief.id, false, llm().ask)).toEqual({ status: "done" });

    const story = await readStory(p.db(), p.accountId);
    expect(story.summary.spent).toBeGreaterThan(lower);
    expect(story.change).toBeNull();
    expect(story.memory.map((m) => m.id)).not.toContain(belief.id);
    expect(story.chapters.flatMap((c) => c.claims).some((k) => k.belief === belief.id)).toBe(false);
    expect(await claims(p)).toContain("Weekly groceries were your biggest spend.");
    expect((await readMemory(p.db(), p.accountId)).memory.find((m) => m.id === belief.id)?.active).toBe(false);

    await p.db().from("chapter").delete().eq("account_id", p.accountId);
    const again = llm();
    await buildStory(p.db(), p.id, p.accountId, again.ask);
    expect(again.briefs.flatMap((b) => b.weeks.flatMap((w) => w.toldYou ?? []))).toEqual([]);

    const seen: string[] = [];
    const chatAsk: AskJson = async (_, __, user) => (seen.push(user), JSON.stringify({ answer: "They were groceries.", payments: ["p1"] }));
    expect((await answer(chatStore(p.db(), p.id, p.accountId), "Who are the groceries for?", chatAsk)).status).toBe("answered");
    expect(seen[0]).not.toContain(belief.text);
    expect(seen[0]).not.toContain("your mum");
  });

  it("stops a habit: rebuilds and chat no longer get it as a repeat, and Use Again brings it back", async () => {
    const p = await enter();
    await buildStory(p.db(), p.id, p.accountId, llm().ask);
    const { data: h } = await p.db().from("belief").select("id, key").eq("kind", "habit").limit(1).single(); // the prepared charges repeat daily
    const repeat = h!.key.slice("habit:".length);

    expect(await setUsing(p.db(), p.id, p.accountId, h!.id, false, llm().ask)).toEqual({ status: "done" });
    const stopped = await chatStore(p.db(), p.id, p.accountId).stopped();
    expect(stopped).toEqual([repeat]);

    const mid = llm();
    await p.db().from("chapter").delete().eq("account_id", p.accountId);
    await buildStory(p.db(), p.id, p.accountId, mid.ask);
    expect(mid.briefs.flatMap((b) => b.weeks.flatMap((w) => w.repeats)).map((r) => r.name.toLowerCase())).not.toContain(repeat);
    expect((await p.db().from("belief").select("active").eq("id", h!.id).single()).data).toEqual({ active: false }); // the rebuild left it stopped

    expect(await setUsing(p.db(), p.id, p.accountId, h!.id, true, llm().ask)).toEqual({ status: "done" });
    expect(await chatStore(p.db(), p.id, p.accountId).stopped()).toEqual([]);
  });

  it("brings stopped support back with Use Again, and a new correction for that person reuses it", async () => {
    const { p, belief } = await corrected();
    const lower = (await readStory(p.db(), p.accountId)).summary.spent;
    await setUsing(p.db(), p.id, p.accountId, belief.id, false, llm().ask);
    expect(await setUsing(p.db(), p.id, p.accountId, belief.id, true, llm().ask)).toEqual({ status: "done" });
    expect((await readStory(p.db(), p.accountId)).summary.spent).toBe(lower);

    await setUsing(p.db(), p.id, p.accountId, belief.id, false, llm().ask);
    const { data: claim } = await p.db().from("claim").select("id").like("text", "%groceries%").limit(1).single();
    expect(await correct(p.db(), p.id, p.accountId, { claimId: claim!.id, said: "those groceries are for my mum" }, llm().ask)).toEqual({ status: "done" });
    const { data: rows } = await p.db().from("belief").select("id, active").eq("kind", "support");
    expect(rows).toEqual([{ id: belief.id, active: true }]);
  });

  it("can't touch another person's belief", async () => {
    const { belief } = await corrected();
    const other = await enter();
    expect((await setUsing(other.db(), other.id, other.accountId, belief.id, false, llm().ask)).status).toBe("error");
    expect((await editBelief(other.db(), other.id, other.accountId, { id: belief.id, text: "Mine now" }, llm().ask)).status).toBe("error");
  });
});
