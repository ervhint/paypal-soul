// Chat reads your balance (U22), with a mocked picker, writer and PayPal: the answer (T-22.1), the account from
// the session only (T-22.2), PayPal failing or refusing (T-22.3), a made-up balance (T-22.4) and advice staying a
// sorry (T-22.5). On Staging: the prepared account's PayPal ID comes from the session, never from the LLM.
import type { CookieMethodsServer } from "@supabase/ssr";
import { afterAll, describe, expect, it } from "vitest";
import { answer, chatStore, NO_BALANCE, PICKER_SYSTEM, type ChatStore, type Llm, type Turn } from "@/lib/chat";
import { checkArgs, runFunction, stepOf, type Ledger } from "@/lib/chat-functions";
import type { AskJson, AskTools, ToolCall } from "@/lib/llm";
import { PayPalError, type Balance } from "@/lib/paypal";
import { choosePrepared, preparedAccountId, secretClient, sessionClient } from "@/lib/supabase";
import type { StoryPayment } from "@/lib/totals";

const coffee: StoryPayment = { id: "id-1", paypal_txn_id: "TXN1", occurred_at: "2026-11-02T10:00:00Z", amount: 4.5, currency: "USD", name: "Morning coffee", payee: "Test Store", event_code: "T0006", category: "food_drinks.snacks_drinks" };
const NOW = new Date("2026-11-10T09:00:00Z");
const none = async () => [];
const PAYPAL: Balance = { asOf: "2026-11-09T14:59:00Z", currencies: [{ currency: "USD", total: 5000, available: 4990, withheld: 10 }] };

function memoryStore(balance: ChatStore["balance"], payments: StoryPayment[] = [coffee]) {
  const turns: (Turn & { at: string })[] = [];
  let reads = 0;
  const store: ChatStore = {
    history: async () => turns,
    askedSince: async (iso) => turns.filter((t) => t.role === "user" && t.at >= iso).length,
    payments: async () => payments,
    beliefs: none,
    stopped: none,
    chapters: none,
    corrections: none,
    actions: none,
    leftOut: none,
    lastRead: async () => null,
    balance: balance && (async () => (reads++, balance())),
    save: async (q, a, at) => {
      turns.push({ role: "user", text: q, paymentIds: [], at: at.toISOString() }, { role: "soul", ...a, at: at.toISOString() });
      return "m1";
    },
  };
  return { store, turns, reads: () => reads };
}

let c = 0;
const call = (name: string, args: object = {}): ToolCall => ({ id: `c${++c}`, name, args: JSON.stringify(args) });
const picking = (...calls: ToolCall[]): AskTools => async () => ({ text: calls.length ? "final" : "no_data", calls, message: {} });
const writing = (reply: (d: { results?: { about: string; asOf?: string; balances?: object[] }[]; nothing?: boolean; payments: object[] }) => object) => {
  const seen: string[] = [];
  const ask: AskJson = async (_, __, user) => (seen.push(user), JSON.stringify(reply(JSON.parse(user.slice(user.indexOf("\n") + 1)))));
  return { ask, seen };
};
const llm = (o: Partial<Llm>): Llm => ({ ask: writing(() => ({ answer: "x" })).ask, pick: picking(), credit: async () => 10, ...o });
const ledger = (balance?: Ledger["balance"]): Ledger => ({ today: "2026-11-10", payments: [coffee], stopped: [], beliefs: none, chapters: none, corrections: none, actions: none, leftOut: none, lastRead: async () => null, balance });
const own = async () => ({ ...PAYPAL, prepared: false });

describe("get_balance answers from PayPal (T-22.1)", () => {
  it("gives total, available, on hold and PayPal's time, with no payment list", async () => {
    const steps: string[] = [];
    const { store, turns } = memoryStore(own);
    const { ask, seen } = writing((d) => {
      const b = d.results![0];
      expect(b.about).toBe("your PayPal balance, as of Nov 9 at 14:59 UTC");
      expect(b.balances).toEqual([{ currency: "USD", total: "$5000.00", available: "$4990.00", onHold: "$10.00" }]);
      expect(d.payments).toEqual([]);
      return { answer: `Your PayPal balance is $5000.00, with $4990.00 available, as of ${b.asOf}.`, payments: [], none: false };
    });
    const r = await answer(store, "What's my balance?", llm({ ask, pick: picking(call("get_balance")) }), NOW, (s) => steps.push(s));
    expect(seen).toHaveLength(1);
    expect(steps).toContain("Asking PayPal for Your Balance");
    expect(r).toMatchObject({ status: "answered", text: "Your PayPal balance is $5000.00, with $4990.00 available, as of Nov 9 at 14:59 UTC.", sources: [] });
    expect(turns[1].paymentIds).toEqual([]);
  });

  it("answers on a sandbox with no payments (T-10.6)", async () => {
    const { store } = memoryStore(own, []);
    const { ask } = writing((d) => ({ answer: `Your PayPal balance is $5000.00, with $4990.00 available, as of ${d.results![0].asOf}.`, payments: [], none: false }));
    expect(await answer(store, "What's my balance?", llm({ ask, pick: picking(call("get_balance")) }), NOW)).toMatchObject({ status: "answered", sources: [] });
  });

  it("leaves on hold out at $0.00, names other currencies, and says when it's the shared prepared account", async () => {
    const shared = async () => ({ asOf: PAYPAL.asOf, prepared: true, currencies: [{ currency: "USD", total: 5000, available: 5000, withheld: 0 }, { currency: "EUR", total: 12.5, available: 12.5, withheld: 0 }] });
    const r = await runFunction("get_balance", {}, ledger(shared));
    expect(r.label).toBe("the prepared sandbox account's PayPal balance, which every visitor on prepared data shares, as of Nov 9 at 14:59 UTC");
    expect(r.data.balances).toEqual([
      { currency: "USD", total: "$5000.00", available: "$5000.00" },
      { currency: "EUR", total: "12.50 EUR", available: "12.50 EUR" },
    ]);
    expect(r.behind).toEqual([]);
    expect(stepOf("get_balance", {}, ledger(shared))).toBe("Asking PayPal for Your Balance");
  });

  it("is a choice in the picker's prompt, and the balance is no longer no_data", () => {
    expect(PICKER_SYSTEM).toContain("call get_balance");
    expect(PICKER_SYSTEM).not.toMatch(/no_data.*their balance/);
  });
});

describe("the account comes from the session (T-22.2)", () => {
  it("refuses any parameter", () => {
    expect(checkArgs("get_balance", "{}")).toEqual({ args: {} });
    expect(checkArgs("get_balance", JSON.stringify({ account: "SOMEONE-ELSE" }))).toEqual({ error: "account isn't a parameter of get_balance" });
    expect(checkArgs("get_balance", JSON.stringify({ payer_id: "X" }))).toHaveProperty("error");
  });

  it("asks PayPal again on every question and saves no figure", async () => {
    const { store, turns, reads } = memoryStore(own);
    const { ask } = writing(() => ({ answer: "Your PayPal balance is $5000.00.", payments: [] }));
    await answer(store, "What's my balance?", llm({ ask, pick: picking(call("get_balance")) }), NOW);
    await answer(store, "And my balance now?", llm({ ask, pick: picking(call("get_balance")) }), NOW);
    expect(reads()).toBe(2);
    expect(turns.every((t) => !t.paymentIds.length)).toBe(true);
  });
});

describe("PayPal failing or refusing (T-22.3)", () => {
  for (const [what, err] of [["fails", new Error("network")], ["refuses (403)", new PayPalError(403, "PayPal balance read returned 403")]] as const) {
    it(`says sorry with no figure and doesn't count the question when PayPal ${what}`, async () => {
      const { store, turns } = memoryStore(async () => {
        throw err;
      });
      const { ask, seen } = writing(() => ({ answer: "never" }));
      const r = await answer(store, "What's my balance?", llm({ ask, pick: picking(call("get_balance")) }), NOW);
      expect(r).toEqual({ status: "error", message: NO_BALANCE });
      expect(NO_BALANCE).not.toMatch(/\$|\d/);
      expect(seen).toHaveLength(0);
      expect(turns).toHaveLength(0);
      expect(await store.askedSince("2026-11-10T00:00:00.000Z")).toBe(0);
    });
  }

  it("treats a store with no balance reader as PayPal not answering", async () => {
    const { store, turns } = memoryStore(undefined);
    expect(await answer(store, "What's my balance?", llm({ pick: picking(call("get_balance")) }), NOW)).toEqual({ status: "error", message: NO_BALANCE });
    expect(turns).toHaveLength(0);
  });
});

describe("a balance PayPal didn't give (T-22.4)", () => {
  it("is thrown out", async () => {
    const { store } = memoryStore(own);
    const { ask } = writing(() => ({ answer: "Your PayPal balance is $5200.00.", payments: [] }));
    const r = await answer(store, "What's my balance?", llm({ ask, pick: picking(call("get_balance")) }), NOW);
    expect(r).toMatchObject({ status: "answered", none: true });
    expect(r.status === "answered" && r.text).not.toContain("5200");
  });
});

describe("advice stays a sorry (T-22.5)", () => {
  for (const q of ["What should my budget be?", "How much tax do I owe?", "Should I invest my balance?", "Can I afford a $300 phone?"]) {
    it(`"${q}" gets a natural sorry with no balance figure`, async () => {
      const { store, reads } = memoryStore(own);
      const { ask } = writing((d) => {
        expect(d.nothing).toBe(true);
        return { answer: "Sorry, I can't help with that. I can only read your payments.", payments: [], none: true };
      });
      const r = await answer(store, q, llm({ ask, pick: picking() }), NOW);
      expect(r).toMatchObject({ status: "answered", none: true, sources: [] });
      expect(r.status === "answered" && r.text).not.toMatch(/\$/);
      expect(reads()).toBe(0);
    });
  }
});

// ---- Integration on Staging ----

function browser() {
  const jar = new Map<string, string>();
  const cookies: CookieMethodsServer = {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (all) => all.forEach((x) => (x.value ? jar.set(x.name, x.value) : jar.delete(x.name))),
  };
  return () => sessionClient(cookies);
}
const made: string[] = [];
afterAll(async () => {
  for (const id of made) await secretClient().auth.admin.deleteUser(id);
});

describe("the balance on Staging (T-22.2)", () => {
  it("reads the prepared account's PayPal ID through the session, and marks it shared", async () => {
    const db = browser();
    const id = await choosePrepared(db(), null);
    made.push(id);
    const asked: string[] = [];
    const store = chatStore(db(), id, await preparedAccountId(), async (payerId) => (asked.push(payerId), PAYPAL));
    expect(await store.balance!()).toEqual({ ...PAYPAL, prepared: true });
    expect(asked).toEqual([process.env.PAYPAL_PREPARED_ACCOUNT_ID]);
  });

  it("can't read an account the session can't see", async () => {
    const db = browser();
    const id = await choosePrepared(db(), null);
    made.push(id);
    const store = chatStore(db(), id, "00000000-0000-0000-0000-000000000000", async () => PAYPAL);
    await expect(store.balance!()).rejects.toThrow();
  });
});
