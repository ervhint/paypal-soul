// Unit: PayPal import with a mocked reader and an in-memory store (U2: T-2.1, T-2.2, T-2.3).
import { describe, expect, it } from "vitest";
import { importAccount, sortRows, windows, type Account, type Sorted, type Store } from "@/lib/import";
import type { PayPalTxn } from "@/lib/paypal";

const DAY = 86_400_000;
const now = new Date("2026-11-04T07:00:00Z");

const txn = (id: string, at: string, code: string, value: string, subject?: string): PayPalTxn => ({
  transaction_info: { transaction_id: id, transaction_event_code: code, transaction_initiation_date: at, transaction_amount: { value, currency_code: "USD" }, transaction_status: "S", transaction_subject: subject },
  payer_info: { payer_name: { alternate_full_name: "Test Store" } },
});

// A daily coffee for 6 months, each with its bank top-up, plus the opening balance.
const history: PayPalTxn[] = [txn("BAL", new Date(+now - 181 * DAY).toISOString(), "T1900", "5000.00", "Initial balance")];
for (let d = 1; d <= 180; d++) {
  const at = new Date(+now - d * DAY).toISOString().replace(".000", "");
  history.push(txn(`C${d}`, at, "T0002", "-4.50", "Morning coffee"), txn(`F${d}`, at, "T0300", "4.50"));
}

function mockPayPal(rows = history, lastRefreshed = now) {
  const calls: [Date, Date][] = [];
  const read = async (_: string, start: Date, end: Date) => {
    calls.push([start, end]);
    return { rows: rows.filter((r) => { const t = +new Date(r.transaction_info.transaction_initiation_date); return t >= +start && t < +end; }), lastRefreshed: lastRefreshed.toISOString() };
  };
  return { read, calls };
}

function memoryStore() {
  const saved = { payments: new Map<string, Sorted["payments"][number]>(), leftOut: new Map<string, Sorted["leftOut"][number]>(), cursor: null as Date | null, writes: 0 };
  const store: Store = {
    save: async (_, { payments, leftOut }) => {
      let added = 0;
      for (const p of payments) if (!saved.payments.has(p.paypal_txn_id)) (saved.payments.set(p.paypal_txn_id, p), added++);
      for (const r of leftOut) if (!saved.leftOut.has(r.paypal_txn_id)) saved.leftOut.set(r.paypal_txn_id, r);
      saved.writes += payments.length;
      return added;
    },
    setCursor: async (_, at) => void (saved.cursor = saved.cursor && saved.cursor > at ? saved.cursor : at),
  };
  return { saved, store };
}

const account = (synced_through: string | null = null): Account => ({ id: "acc", paypal_account_id: "PAYER", synced_through });

describe("windows", () => {
  it("covers the range back to back in windows of 31 days or less", () => {
    const from = new Date(+now - 183 * DAY);
    const w = windows(from, now);
    expect(w[0][0]).toEqual(from);
    expect(w.at(-1)![1]).toEqual(now);
    for (const [i, [s, e]] of w.entries()) {
      expect(+e - +s).toBeLessThanOrEqual(31 * DAY);
      if (i) expect(s).toEqual(w[i - 1][1]);
    }
  });

  it("is empty when the cursor is already now", () => {
    expect(windows(now, now)).toEqual([]);
  });
});

describe("first import (T-2.1)", () => {
  it("reads up to 6 months in windows of 31 days or less and saves each kept row once", async () => {
    const pp = mockPayPal();
    const { saved, store } = memoryStore();
    const r = await importAccount(account(), pp.read, store, now);

    expect(pp.calls.length).toBeGreaterThanOrEqual(6);
    for (const [s, e] of pp.calls) expect(+e - +s).toBeLessThanOrEqual(31 * DAY);
    expect(+now - +pp.calls[0][0]).toBeLessThanOrEqual(183 * DAY);
    expect(+now - +pp.calls[0][0]).toBeGreaterThan(180 * DAY);
    expect(pp.calls.at(-1)![1]).toEqual(now);

    expect(r.added).toBe(180);
    expect(saved.payments.size).toBe(180);
    expect(saved.writes).toBe(180); // no window hands the same row over twice
    expect(saved.payments.get("C1")).toMatchObject({ amount: 4.5, name: "Morning coffee", payee: "Test Store", event_code: "T0002" });
    expect(r.syncedThrough).toBe(now.toISOString());
  });

  it("keeps the cursor at PayPal's last refresh, so late rows are read next time", async () => {
    const refreshed = new Date(+now - 3 * 3_600_000);
    const { saved, store } = memoryStore();
    const r = await importAccount(account(), mockPayPal(history, refreshed).read, store, now);
    expect(r.syncedThrough).toBe(refreshed.toISOString());
    expect(saved.cursor).toEqual(refreshed);
  });
});

describe("rows left out (T-2.2)", () => {
  it("sends T1900 and T0300 to the rows left out with a reason, and no payment counts them", () => {
    const { payments, leftOut } = sortRows([
      txn("BAL", "2026-10-30T17:47:14Z", "T1900", "5000.00", "Initial balance"),
      txn("PAY", "2026-11-02T04:44:44Z", "T0002", "-4.50", "Morning coffee"),
      txn("TOP", "2026-11-02T04:44:44Z", "T0300", "4.50"),
    ]);
    expect(payments.map((p) => p.paypal_txn_id)).toEqual(["PAY"]);
    expect(payments.reduce((t, p) => t + p.amount, 0)).toBe(4.5);
    expect(leftOut).toEqual([
      expect.objectContaining({ paypal_txn_id: "BAL", event_code: "T1900", amount: 5000, reason: expect.stringContaining("opening test balance") }),
      expect.objectContaining({ paypal_txn_id: "TOP", event_code: "T0300", amount: 4.5, reason: expect.stringContaining("Bank funding for Morning coffee") }),
    ]);
  });

  it("saves rows left out apart from payments on import", async () => {
    const { saved, store } = memoryStore();
    await importAccount(account(), mockPayPal().read, store, now);
    expect(saved.leftOut.size).toBe(181);
    expect([...saved.payments.keys()].some((id) => saved.leftOut.has(id))).toBe(false);
  });
});

describe("refresh past the cursor (T-2.3)", () => {
  it("only asks PayPal for rows newer than the cursor", async () => {
    const { saved, store } = memoryStore();
    const first = await importAccount(account(), mockPayPal().read, store, now);

    const later = new Date(+now + 2 * DAY);
    const fresh = [...history, txn("NEW", new Date(+now + DAY).toISOString(), "T0002", "-2.75", "Bus fare")];
    const pp = mockPayPal(fresh, later);
    const r = await importAccount(account(first.syncedThrough), pp.read, store, later);

    expect(pp.calls).toEqual([[now, later]]);
    expect(r.added).toBe(1);
    expect(saved.payments.has("NEW")).toBe(true);
    expect(saved.payments.size).toBe(181);
  });
});
