// Own sandbox (U10): the minimum (T-10.3), and consent, switching and logging out on Staging with PayPal
// faked (BFF side of T-10.1, T-10.2, T-10.4, T-10.5). Test people are deleted afterwards.
import type { CookieMethodsServer } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { checkConnection, forgetSandbox, startConsent } from "@/lib/connect";
import { sortRows } from "@/lib/import";
import { PayPalError, type Consent, type PayPalTxn } from "@/lib/paypal";
import { choosePrepared, chooseOwn, currentVisitor, PENDING, preparedAccountId, secretClient, sessionClient } from "@/lib/supabase";
import { minimumFound, type StoryPayment } from "@/lib/totals";

const pay = (day: number, name: string | null = "Morning coffee", amount = 4.5) =>
  ({ id: `p${day}${name}`, paypal_txn_id: `T${day}${name}`, occurred_at: `2026-11-${String(day).padStart(2, "0")}T08:00:00Z`, amount, currency: "USD", name, event_code: "T0002", category: "coffee" }) as StoryPayment;

describe("the minimum for a story (T-10.3)", () => {
  it("passes 5 payments across 7 days with a name on 2 days", () => {
    expect(minimumFound([1, 2, 3, 5, 7].map((d) => pay(d)))).toMatchObject({ days: 7, payments: 5, ok: true });
  });
  it("says when the payments span under 7 days", () => {
    expect(minimumFound([1, 2, 3, 4, 6].map((d) => pay(d)))).toMatchObject({ days: 6, payments: 5, repeats: 1, ok: false });
  });
  it("says when there are under 5 payments", () => {
    expect(minimumFound([1, 2, 9, 12].map((d) => pay(d)))).toMatchObject({ days: 12, payments: 4, repeats: 1, ok: false });
  });
  it("says when no name is seen on 2 days, even with two payments on one day", () => {
    const pays = [pay(1, "Bus fare"), pay(1, "Bus fare", 2), pay(3, "Lunch"), pay(5, "Books"), pay(8, "Socks")];
    expect(minimumFound(pays)).toMatchObject({ days: 8, payments: 5, repeats: 0, ok: false });
  });
  it("counts nothing for an account with no spending", () => {
    expect(minimumFound([])).toEqual({ days: 0, payments: 0, repeats: 0, ok: false });
  });
});

describe("rows an own account can hold", () => {
  const row = (id: string, code: string, value: string): PayPalTxn => ({
    transaction_info: { transaction_id: id, transaction_event_code: code, transaction_initiation_date: "2026-11-03T08:00:00Z", transaction_amount: { value, currency_code: "USD" }, transaction_status: "S", transaction_subject: "Something" },
  });
  it("leaves out money coming in, bank withdrawals and conversions, so spending stays positive", () => {
    const { payments, leftOut } = sortRows([row("IN", "T0006", "20.00"), row("REFUND", "T1107", "5.00"), row("BANK", "T0400", "-50.00"), row("FX", "T0200", "-9.00"), row("OUT", "T0006", "-7.00")]);
    expect(payments.map((p) => [p.paypal_txn_id, p.amount])).toEqual([["OUT", 7]]);
    expect(leftOut.map((r) => r.paypal_txn_id)).toEqual(["IN", "REFUND", "BANK", "FX"]);
    expect(leftOut.every((r) => r.amount > 0 && r.reason)).toBe(true);
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
const admin = secretClient();
const enter = async () => {
  const db = browser();
  const id = await choosePrepared(db(), null);
  made.push(id);
  return { db, id };
};
afterAll(async () => {
  for (const id of made) await admin.auth.admin.deleteUser(id);
});

const fakeConsent = (found: Awaited<ReturnType<Consent["find"]>>) => {
  const links: string[] = [];
  const consent: Consent = {
    link: async (tracking, back) => (links.push(back), `https://paypal.test/approve/${tracking}`),
    find: async () => found,
  };
  return { consent, links };
};
const readOk = async () => ({ rows: [], lastRefreshed: new Date().toISOString() });
const ownRow = async (id: string) => (await admin.from("paypal_account").select("id, paypal_account_id, tracking_id").eq("owner_id", id).single()).data!;
const seed = (days: number[]) => async (accountId: string) => {
  const rows = days.map((d) => ({ account_id: accountId, paypal_txn_id: `SEED${d}`, occurred_at: `2026-10-${String(d).padStart(2, "0")}T08:00:00Z`, amount: 4.5, currency: "USD", name: "Morning coffee", event_code: "T0002", category: "coffee" }));
  const { error } = await admin.from("payment").upsert(rows, { onConflict: "account_id,paypal_txn_id", ignoreDuplicates: true });
  if (error) throw error;
};
const connect = async (p: { id: string }, sync: (a: string) => Promise<unknown>, payerId = `PAYER${p.id.slice(0, 8)}`) => {
  const { consent } = fakeConsent({ payerId, canRead: true });
  await startConsent(admin, p.id, "http://localhost:3000", consent);
  return checkConnection(admin, p.id, consent, readOk, sync);
};

describe("consent and Check Connection", () => {
  it("has nothing to check before consent starts", async () => {
    const p = await enter();
    expect(await checkConnection(admin, p.id, fakeConsent(null).consent, readOk)).toEqual({ state: "start" });
  });

  it("stays pending until PayPal names the account, and isn't connected yet (T-10.2)", async () => {
    const p = await enter();
    const { consent, links } = fakeConsent(null);
    expect(await startConsent(admin, p.id, "http://localhost:3000", consent)).toContain("paypal.test");
    expect(links).toEqual(["http://localhost:3000/connect"]);
    expect(await checkConnection(admin, p.id, consent, readOk)).toEqual({ state: "pending" });
    expect(await currentVisitor(p.db())).toMatchObject({ source: "prepared", connected: false, linking: true });
    expect(await chooseOwn(p.db())).toBe(false);
  });

  it("makes a new tracking ID for each link, on the same row", async () => {
    const p = await enter();
    const { consent } = fakeConsent(null);
    await startConsent(admin, p.id, "http://localhost:3000", consent);
    const first = await ownRow(p.id);
    await startConsent(admin, p.id, "http://localhost:3000", consent);
    const second = await ownRow(p.id);
    expect(second.id).toBe(first.id);
    expect(second.tracking_id).not.toBe(first.tracking_id);
  });

  it("is denied when the grant has no reading scope, and when PayPal refuses the read (T-10.2)", async () => {
    const p = await enter();
    const noScope = fakeConsent({ payerId: "PAYERX", canRead: false }).consent;
    await startConsent(admin, p.id, "http://localhost:3000", noScope);
    expect(await checkConnection(admin, p.id, noScope, readOk)).toEqual({ state: "denied" });
    const refused = fakeConsent({ payerId: "PAYERX", canRead: true }).consent;
    const read403 = async () => { throw new PayPalError(403, "no"); };
    expect(await checkConnection(admin, p.id, refused, read403)).toEqual({ state: "denied" });
    expect((await ownRow(p.id)).paypal_account_id).toBe(PENDING);
  });

  it("says offline when PayPal fails, and keeps the approval for the next check", async () => {
    const p = await enter();
    const { consent } = fakeConsent({ payerId: "PAYERY", canRead: true });
    await startConsent(admin, p.id, "http://localhost:3000", consent);
    const read500 = async () => { throw new PayPalError(500, "down"); };
    expect(await checkConnection(admin, p.id, consent, read500)).toEqual({ state: "offline" });
    expect(await checkConnection(admin, p.id, consent, readOk, async () => {})).toEqual({ state: "empty" });
  });

  it("finds the account, imports it and says what's missing, keeping the prepared data (T-10.1, T-10.3)", async () => {
    const p = await enter();
    const r = await connect(p, seed([1, 2, 3]));
    expect(r).toEqual({ state: "little", found: { days: 3, payments: 3, repeats: 1 } });
    expect(await currentVisitor(p.db())).toMatchObject({ source: "prepared", connected: true });
    expect(await chooseOwn(p.db())).toBe(false);
    expect(await startConsent(admin, p.id, "http://localhost:3000", fakeConsent(null).consent)).toBeNull();
  });

  it("moves the person onto their sandbox once it's enough (T-10.1)", async () => {
    const p = await enter();
    expect(await connect(p, seed([1, 2, 3, 5, 8]))).toEqual({ state: "ready" });
    expect(await currentVisitor(p.db())).toMatchObject({ source: "own", connected: true });
  });
});

const remember = async (db: () => SupabaseClient, id: string, accountId: string, text: string) => {
  const { error } = await db().from("chat_message").insert({ person_id: id, account_id: accountId, role: "user", text });
  if (error) throw error;
};
const chat = async (db: () => SupabaseClient, accountId: string) => (await db().from("chat_message").select("text").eq("account_id", accountId)).data!.map((m) => m.text);

describe("switching and logging out", () => {
  it("keeps each side's chat and needs no new login (T-10.4)", async () => {
    const p = await enter();
    await connect(p, seed([1, 2, 3, 5, 8]));
    const own = (await ownRow(p.id)).id;
    const prepared = await preparedAccountId();
    await remember(p.db, p.id, own, "from my sandbox");
    await choosePrepared(p.db(), null);
    expect((await currentVisitor(p.db()))?.accountId).toBe(prepared);
    await remember(p.db, p.id, prepared, "from prepared");
    expect(await chooseOwn(p.db())).toBe(true);
    expect((await currentVisitor(p.db()))?.accountId).toBe(own);
    expect(await chat(p.db, own)).toEqual(["from my sandbox"]);
    expect(await chat(p.db, prepared)).toEqual(["from prepared"]);
  });

  it("keeps one person's sandbox out of another's reach", async () => {
    const [a, b] = [await enter(), await enter()];
    await connect(a, seed([1, 2, 3, 5, 8]));
    const own = (await ownRow(a.id)).id;
    const { data } = await b.db().from("payment").select("id").eq("account_id", own);
    expect(data).toEqual([]);
    expect(await chooseOwn(b.db())).toBe(false);
  });

  it("forgets the link with the sandbox's payments and chat, leaves the prepared side (T-10.5)", async () => {
    const p = await enter();
    await connect(p, seed([1, 2, 3, 5, 8]));
    const own = (await ownRow(p.id)).id;
    const prepared = await preparedAccountId();
    await remember(p.db, p.id, own, "sandbox words");
    await remember(p.db, p.id, prepared, "prepared words");
    await choosePrepared(p.db(), null);
    await forgetSandbox(admin, p.id);
    expect(await currentVisitor(p.db())).toMatchObject({ source: "prepared", connected: false, linking: false });
    expect((await admin.from("payment").select("id").eq("account_id", own)).data).toEqual([]);
    expect(await chat(p.db, own)).toEqual([]);
    expect(await chat(p.db, prepared)).toEqual(["prepared words"]);
  });
});
