// Unit: totals, repeats and habit sureness come from code (U4: T-4.3, and the code side of T-4.1, NF-8).
import { describe, expect, it } from "vitest";
import { habitSureness, repeats, totals, weekOf, type StoryPayment } from "@/lib/totals";

let n = 0;
const pay = (day: string, name: string | null, amount = 4.5, extra: Partial<StoryPayment> = {}): StoryPayment => ({
  id: `id-${++n}`,
  paypal_txn_id: `TXN${n}`,
  occurred_at: `${day}T10:00:00Z`,
  amount,
  currency: "USD",
  name,
  event_code: "T0006",
  category: "food_drinks.snacks_drinks",
  ...extra,
});

/** One payment called `name` on `days` different days from Oct 1, `step` days apart. */
const onDays = (name: string, days: number, extra: Partial<StoryPayment> = {}, step = 2) =>
  Array.from({ length: days }, (_, i) => pay(new Date(Date.UTC(2026, 9, 1 + i * step)).toISOString().slice(0, 10), name, 4.5, extra));

describe("habits from repeats (T-4.3)", () => {
  it("names a repeat a habit only from 3 days, with sureness by days", () => {
    const found = repeats([...onDays("Two", 2), ...onDays("Three", 3), ...onDays("Five", 5), ...onDays("Ten", 10)]);
    const sure = Object.fromEntries(found.map((r) => [r.name, r.sureness]));
    expect(sure).toEqual({ Two: null, Three: "not_sure", Five: "fairly_sure", Ten: "sure" });
  });

  it("is sure of a daily subscription from 3 days", () => {
    const [sub] = repeats(onDays("Mobile data", 3, { event_code: "T0002" }, 1));
    expect(sub).toMatchObject({ daily: true, days: 3, sureness: "sure" });
  });

  it("doesn't call a subscription daily when a day is missing, or a daily one-off payment a subscription", () => {
    expect(repeats(onDays("Weekly groceries", 3, { event_code: "T0002" }, 7))[0]).toMatchObject({ daily: false, sureness: "not_sure" });
    expect(repeats(onDays("Coffee", 3, {}, 1))[0]).toMatchObject({ daily: false, sureness: "not_sure" });
  });

  it("counts days, not payments, and never repeats a payment it can't identify", () => {
    const twiceADay = [pay("2026-11-02", "Morning coffee"), pay("2026-11-02", "morning  coffee"), pay("2026-11-03", "Morning coffee")];
    const unknown = onDays("Payment", 4, { category: "unknown" });
    const found = repeats([...twiceADay, ...unknown]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ days: 2, payments: 3, spent: 13.5, sureness: null });
    expect(habitSureness(4, false)).toBe("not_sure");
    expect(habitSureness(2, true)).toBeNull();
  });
});

describe("totals (T-4.1, NF-8)", () => {
  it("sums spending in cents, keeps money received apart and groups by category", () => {
    const t = totals([
      pay("2026-11-02", "Morning coffee", 4.5),
      pay("2026-11-03", "Morning coffee", 4.5),
      pay("2026-11-03", "Bus fare", 2.75, { category: "transportation.daily_transportation" }),
      pay("2026-11-04", "Refund", -0.1),
      pay("2026-11-04", "Tiny", 0.1),
      pay("2026-11-04", "Tiny", 0.2),
    ]);
    expect(t).toMatchObject({ payments: 6, spent: 12.05, received: 0.1, from: "2026-11-02", to: "2026-11-04" });
    expect(t.byCategory[0]).toEqual({ category: "Food & Drinks → Snacks & Drinks", payments: 4, spent: 9.3 });
  });

  it("starts weeks on Monday in UTC", () => {
    expect(weekOf("2026-11-02T04:44:44Z")).toBe("2026-11-02");
    expect(weekOf("2026-11-08T23:59:00Z")).toBe("2026-11-02");
    expect(weekOf("2026-11-01T12:00:00Z")).toBe("2026-10-26");
  });
});
