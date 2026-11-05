// Delete My Data and the daily job (U11). Unit: the job URL refuses without the cron secret (T-11.4).
// Integration on Staging with PayPal and the import faked: deleting on prepared data and on an own sandbox
// (BFF side of T-11.1, T-11.2), and one run of the job (T-11.3). Test people are deleted afterwards.
import type { CookieMethodsServer } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/route";
import { createPurchase, settleWaiting } from "@/lib/action";
import { checkConnection, startConsent } from "@/lib/connect";
import { dailyJob, deletePerson } from "@/lib/forget";
import type { AskJson } from "@/lib/llm";
import type { Orders, PayPalOrder } from "@/lib/paypal";
import { choosePrepared, currentVisitor, preparedAccountId, secretClient, sessionClient } from "@/lib/supabase";

describe("the job URL (T-11.4)", () => {
  it("returns 401 with no cron secret and with a wrong one", async () => {
    process.env.CRON_SECRET ||= "test-secret";
    const none = await GET(new Request("http://localhost:3000/api/cron"));
    const wrong = await GET(new Request("http://localhost:3000/api/cron", { headers: { authorization: "Bearer not-the-secret" } }));
    expect([none.status, wrong.status]).toEqual([401, 401]);
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

const admin = secretClient();
const made: string[] = [];
const enter = async () => {
  const db = browser();
  const id = await choosePrepared(db(), null);
  made.push(id);
  return { db, id };
};
afterAll(async () => {
  for (const id of made) await deletePerson(admin, id);
});

const must = async <T,>(q: PromiseLike<{ data: T; error: unknown }>) => {
  const { data, error } = await q;
  if (error) throw error;
  return data as NonNullable<T>;
};

// One of each personal row for this person on this account.
async function fill(db: () => SupabaseClient, id: string, accountId: string) {
  const [pay] = await must(admin.from("payment").select("id").eq("account_id", accountId).is("person_id", null).limit(1));
  const ids = [pay.id];
  const belief = await must(db().from("belief").insert({ person_id: id, account_id: accountId, kind: "told", text: "Test belief.", sureness: "sure", source: "test", payment_ids: ids }).select("id").single());
  const chapter = await must(db().from("chapter").insert({ person_id: id, account_id: accountId, title: "Test", starts_on: "2026-11-02", ends_on: "2026-11-08", payment_ids: ids }).select("id").single());
  await must(db().from("claim").insert({ chapter_id: chapter.id, person_id: id, position: 0, text: "Test claim.", payment_ids: ids, belief_id: belief.id }));
  await must(db().from("correction").insert({ person_id: id, account_id: accountId, belief_id: belief.id, said: "test" }));
  await must(db().from("chat_message").insert({ person_id: id, account_id: accountId, role: "user", text: "test" }));
  await must(admin.from("action").insert({ person_id: id, account_id: accountId, kind: "buy", recipient: "Test Store", amount: 18, currency: "USD", status: "cancelled" }));
}

const PERSONAL = ["belief", "chapter", "claim", "correction", "chat_message", "action"] as const;
const left = async (id: string) => {
  const out: Record<string, number> = {};
  for (const t of PERSONAL) out[t] = (await must(admin.from(t).select("id").eq("person_id", id))).length;
  return out;
};
const none = Object.fromEntries(PERSONAL.map((t) => [t, 0]));
const preparedPayments = async () => (await must(admin.from("payment").select("id").eq("account_id", await preparedAccountId()).is("person_id", null))).length;

// An own sandbox connected through a faked consent, holding five seeded payments.
async function connectOwn(id: string) {
  const consent = { link: async () => "https://paypal.test/approve", find: async () => ({ payerId: `PAYER${id.slice(0, 8)}`, canRead: true }) };
  const readOk = async () => ({ rows: [], lastRefreshed: new Date().toISOString() });
  await startConsent(admin, id, "http://localhost:3000", consent);
  const seed = async (accountId: string) => {
    const rows = [1, 2, 3, 5, 8].map((d) => ({ account_id: accountId, paypal_txn_id: `SEED${d}`, occurred_at: `2026-10-0${d}T08:00:00Z`, amount: 4.5, currency: "USD", name: "Morning coffee", event_code: "T0002", category: "coffee" }));
    await must(admin.from("payment").upsert(rows, { onConflict: "account_id,paypal_txn_id", ignoreDuplicates: true }));
  };
  expect(await checkConnection(admin, id, consent, readOk, seed)).toEqual({ state: "ready" });
  return (await must(admin.from("paypal_account").select("id").eq("owner_id", id).single())).id as string;
}

describe("Delete My Data", () => {
  it("on prepared data removes only that person's rows, keeps the shared payments, and the next visit is someone new (T-11.1)", async () => {
    const [p, other] = [await enter(), await enter()];
    const prepared = await preparedAccountId();
    await fill(p.db, p.id, prepared);
    await fill(other.db, other.id, prepared);
    const shared = await preparedPayments();
    await deletePerson(admin, p.id);
    expect(await left(p.id)).toEqual(none);
    expect((await must(admin.from("person").select("id").eq("id", p.id))).length).toBe(0);
    expect(Object.values(await left(other.id)).every((n) => n === 1)).toBe(true);
    expect(await preparedPayments()).toBe(shared);
    expect(await currentVisitor(p.db())).toBeNull();
    const again = await enter();
    expect(again.id).not.toBe(p.id);
    expect(await left(again.id)).toEqual(none);
  });

  it("on an own sandbox also removes that account's payments and the link (T-11.2)", async () => {
    const p = await enter();
    const own = await connectOwn(p.id);
    await fill(p.db, p.id, own);
    expect((await must(admin.from("payment").select("id").eq("account_id", own))).length).toBe(5);
    await deletePerson(admin, p.id);
    expect(await must(admin.from("paypal_account").select("id").eq("id", own))).toEqual([]);
    expect(await must(admin.from("payment").select("id").eq("account_id", own))).toEqual([]);
    expect(await left(p.id)).toEqual(none);
  });
});

// A fake PayPal whose orders are approved as soon as they're made.
const approvedPayPal = (): Orders => {
  const orders = new Map<string, PayPalOrder>();
  return {
    create: async () => {
      const id = `TEST-DAILY-${crypto.randomUUID()}`;
      orders.set(id, { id, status: "APPROVED" });
      return { id, link: `https://www.sandbox.paypal.com/checkoutnow?token=${id}` };
    },
    get: async (id) => orders.get(id) ?? null,
    capture: async (id) => {
      const o: PayPalOrder = { id, status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: `CAP-${id}`, status: "COMPLETED", create_time: new Date().toISOString(), amount: { value: "18.00", currency_code: "USD" }, seller_receivable_breakdown: { paypal_fee: { value: "1.12" } } }] } }] };
      orders.set(id, o);
      return o;
    },
  };
};
const ask: AskJson = async (purpose) => {
  if (purpose !== "new chapter") throw new Error("no LLM in this test");
  return JSON.stringify({ title: "A Stop at the Market", claims: [{ text: "You paid $18.00 on the market." }] });
};

const DAY = 86_400_000;
const lastSeen = async (id: string, daysAgo: number, now: Date) =>
  must(admin.from("person").update({ last_visit_at: new Date(+now - daysAgo * DAY).toISOString() }).eq("id", id));
const exists = async (id: string) => (await must(admin.from("person").select("id").eq("id", id))).length === 1;

describe("the daily job (T-11.3)", () => {
  it("captures the order, imports each account, forgets the 30-day person and keeps the 29-day one", async () => {
    const now = new Date();
    const [buyer, idle30, idle29, connected] = [await enter(), await enter(), await enter(), await enter()];
    const paypal = approvedPayPal();
    const order = await createPurchase(admin, buyer.id, await preparedAccountId(), "http://localhost:3000", paypal);
    const own = await connectOwn(connected.id);
    await lastSeen(idle30.id, 30, now);
    await lastSeen(idle29.id, 29, now);
    await lastSeen(connected.id, 45, now); // connected people keep their data until Delete My Data
    await lastSeen(buyer.id, 30, now); // forgotten after its order is captured

    expect(order.status).toBe("waiting");
    const synced: string[] = [];
    const steps: string[] = [];
    const r = await dailyJob(
      admin,
      { settle: async () => (steps.push("settle"), settleWaiting(admin, paypal, ask, buyer.id)), sync: async (id) => (steps.push("sync"), synced.push(id)) },
      now,
    );

    expect(steps[0]).toBe("settle");
    expect(r.actions).toEqual({ completed: 1 });
    expect(synced).toContain(await preparedAccountId());
    expect(synced).toContain(own);
    expect(r.failed).toBe(0);
    expect(r.forgotten).toBeGreaterThanOrEqual(2);
    expect(await exists(idle30.id)).toBe(false);
    expect(await exists(buyer.id)).toBe(false);
    expect(await exists(idle29.id)).toBe(true);
    expect(await exists(connected.id)).toBe(true);
  });

  it("keeps going when one import fails", async () => {
    const r = await dailyJob(admin, { settle: async () => ({}), sync: async () => Promise.reject(new Error("PayPal down")) });
    expect(r.imported).toBe(0);
    expect(r.failed).toBeGreaterThan(0);
  });
});
