// Unit: the long payment list in Chat's evidence panel.
import { describe, expect, it } from "vitest";
import { categoryTotals } from "@/lib/pay-list";
import type { Payment } from "@/lib/types";

const pay = (category: string, amount: number) => ({ category, amount }) as Payment;

describe("categoryTotals", () => {
  it("adds each category, biggest first", () => {
    expect(categoryTotals([pay("Bus", 2.75), pay("Groceries", 46.2), pay("Bus", 2.75)])).toEqual([
      { category: "Groceries", spent: 46.2 },
      { category: "Bus", spent: 5.5 },
    ]);
  });

  it("keeps sums to the cent", () => {
    expect(categoryTotals([pay("A", 0.1), pay("A", 0.2)])).toEqual([{ category: "A", spent: 0.3 }]);
  });

  it("leaves out money received, as the totals do", () => {
    expect(categoryTotals([pay("A", 5), pay("A", -2)])).toEqual([{ category: "A", spent: 5 }]);
  });

  it("folds everything past the top 5 into Other Categories", () => {
    const list = categoryTotals(["A", "B", "C", "D", "E", "F", "G"].map((c, i) => pay(c, 70 - i * 10)));
    expect(list.map((c) => c.category)).toEqual(["A", "B", "C", "D", "E", "Other Categories"]);
    expect(list.at(-1)!.spent).toBe(30);
  });
});
