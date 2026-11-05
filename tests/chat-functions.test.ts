// Chat's functions (U16), run on made-up payments with today fixed at Thursday, Nov 5, 2026. Checks the
// parameters (T-16.6) and that periods drive the totals, the list and the biggest payment (T-16.2). The picker
// isn't involved here: tests/chat.test.ts covers it with a mock, and tests/real/ with the real model.
import { describe, expect, it } from "vitest";
import { checkArgs, FUNCTIONS, periodName, runFunction, stepOf, TOOLS, type Ledger } from "@/lib/chat-functions";
import { MONEY_IN } from "@/lib/import";
import type { StoryPayment } from "@/lib/totals";

let n = 0;
const pay = (day: string, name: string, amount: number, category: string, extra: Partial<StoryPayment> = {}): StoryPayment => ({
  id: `id-${++n}`,
  paypal_txn_id: `TXN${n}`,
  occurred_at: `${day}T10:00:00Z`,
  amount,
  currency: "USD",
  name,
  payee: "Test Store",
  event_code: "T0006",
  category,
  ...extra,
});
const coffee = "food_drinks.snacks_drinks";
const sub = { event_code: "T0002" };
const gym = ["2026-08-03", "2026-08-10", "2026-08-17"].map((d) => pay(d, "Gym class", 30, "sports.sport_activities"));
const shop = ["2026-10-05", "2026-10-12", "2026-10-19"].map((d) => pay(d, "Weekly groceries", 40, "groceries", { for_who: "your mum", payee: "Market" }));
const snickers = pay("2026-10-09", "Snickers Bar", 1.5, coffee);
const cups = [pay("2026-10-20", "Morning coffee", 4.5, coffee, sub), pay("2026-10-26", "Morning coffee", 12, coffee, sub), pay("2026-11-02", "Morning coffee", 4.5, coffee, sub), pay("2026-11-03", "Morning coffee", 5.5, coffee, sub)];
const fares = [pay("2026-11-02", "Bus fare", 2.4, "transportation.daily_transportation"), pay("2026-11-02", "Bus fare", 2.4, "transportation.daily_transportation")];
const payments = [...gym, ...shop, snickers, ...cups, ...fares].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

const ledger: Ledger = {
  today: "2026-11-05",
  payments,
  stopped: [],
  beliefs: async () => [
    { kind: "support", text: "You buy the weekly groceries for your mum.", sureness: "sure", checked: true, paymentIds: shop.map((p) => p.id) },
    { kind: "habit", text: "You pay for Morning coffee on 4 different days.", sureness: "not_sure", checked: false, paymentIds: cups.map((p) => p.id) },
  ],
  chapters: async () => [
    { title: "Coffee Week", startsOn: "2026-11-02", endsOn: "2026-11-08", sentences: ["Coffee came back."], paymentIds: [cups[2].id] },
    { title: "Late October", startsOn: "2026-10-26", endsOn: "2026-11-01", sentences: ["A big coffee."], paymentIds: [cups[1].id] },
  ],
  corrections: async () => [{ said: "those are for my mum", became: "You buy the weekly groceries for your mum.", at: "2026-11-04T09:00:00Z", undone: false }],
  actions: async () => [
    { kind: "send", recipient: "your mum", amount: 25, fee: 1.36, status: "completed", at: "2026-11-04T09:00:00Z", txn: "TXN1" },
    { kind: "buy", recipient: "Test Store", amount: 18, fee: null, status: "waiting", at: "2026-11-05T09:00:00Z", txn: null },
  ],
  leftOut: async () => [
    { occurredAt: "2026-10-01T00:00:00Z", amount: 5000, eventCode: "T1900", reason: "PayPal's opening test balance, not something you bought." },
    { occurredAt: "2026-10-15T00:00:00Z", amount: 100, eventCode: "T0011", reason: MONEY_IN },
  ],
  lastRead: async () => "2026-11-05T01:00:00Z",
};
const run = (name: string, args: Record<string, unknown> = {}) => {
  const checked = checkArgs(name, JSON.stringify(args));
  if ("error" in checked) throw new Error(checked.error);
  return runFunction(name, checked.args, ledger);
};
const ids = (ps: StoryPayment[]) => ps.map((p) => p.id).sort();
const OCT = { from: "2026-10-01", to: "2026-10-31" };

describe("the functions", () => {
  it("are 24, each described for the picker, with sum_fees cut", () => {
    expect(TOOLS).toHaveLength(24);
    expect(Object.keys(FUNCTIONS)).not.toContain("sum_fees");
    for (const t of TOOLS) expect(t.function.parameters.additionalProperties).toBe(false);
  });

  it("find_payments: dates, words, sort, limit, and the figures of all it matched", async () => {
    const r = await run("find_payments", { ...OCT, sort: "biggest", limit: 1 });
    expect(r.rows.map((p) => p.amount)).toEqual([40]);
    expect(r.data).toMatchObject({ payments: 6, spent: "$138.00", shown: 1, onYou: { payments: 3, spent: "$18.00" }, forOthers: [{ who: "your mum", payments: 3, spent: "$120.00" }] });
    expect(r.behind).toHaveLength(6);
    expect((await run("find_payments", { words: ["snickers"] })).rows).toEqual([snickers]);
    expect((await run("find_payments", { words: ["market"] })).behind).toHaveLength(3); // the store counts
    expect((await run("find_payments", { min: 10, max: 20 })).rows).toEqual([cups[1]]);
    expect((await run("find_payments", { category: "food_drinks" })).behind).toHaveLength(5);
    expect((await run("find_payments", { person: "me", words: ["groceries"] })).behind).toEqual([]);
    expect((await run("find_payments", { person: "mum" })).behind).toHaveLength(3);
  });

  it("find_payments received: money in, not the opening balance", async () => {
    expect((await run("find_payments", { kind: "received" })).data).toMatchObject({ payments: 1, received: "$100.00", moneyIn: [{ date: "Oct 15", amount: "$100.00" }] });
  });

  it("find_new: names not seen before the period", async () => {
    const r = await run("find_new", { from: "2026-11-01", to: "2026-11-30" });
    expect(r.data.found).toEqual([{ name: "Bus fare", firstSeen: "Nov 2", payments: 2, spent: "$4.80" }]);
  });

  it("find_unusual: much bigger than the usual for that name", async () => {
    expect((await run("find_unusual")).data.found).toEqual([{ name: "Morning coffee", date: "Oct 26", amount: "$12.00", usual: "$4.50" }]);
  });

  it("find_duplicates: same name, amount and day", async () => {
    const r = await run("find_duplicates");
    expect(r.data.found).toEqual([{ name: "Bus fare", date: "Nov 2", times: 2, eachAmount: "$2.40", together: "$4.80" }]);
    expect(ids(r.behind)).toEqual(ids(fares));
  });

  it("find_price_changes: the last change for each name", async () => {
    expect((await run("find_price_changes")).data.found).toEqual([{ name: "Morning coffee", was: "$4.50", now: "$5.50", went: "up", on: "Nov 3", changes: 3 }]);
  });

  it("find_stopped: repeats that went quiet, not the ones still coming", async () => {
    const r = await run("find_stopped");
    expect((r.data.found as { name: string }[]).map((f) => f.name).sort()).toEqual(["Gym class", "Weekly groceries"]);
  });

  it("find_peak_period: the most expensive day, and its payments are the list", async () => {
    const r = await run("find_peak_period", { unit: "month" });
    expect(r.data.highestFirst).toMatchObject([{ period: "October 2026", payments: 6, spent: "$138.00" }, { period: "August 2026", spent: "$90.00" }, { period: "November 2026", spent: "$14.80" }]);
    expect(r.behind).toHaveLength(6);
  });

  it("sum_spending: groups with shares, and days with and without spending", async () => {
    const r = await run("sum_spending", { ...OCT, group_by: "category" });
    expect(r.data).toMatchObject({ payments: 6, spent: "$138.00", daysWithSpending: 6, daysWithoutSpending: 25 });
    expect((r.data.groups as object[])[0]).toEqual({ group: "Groceries", payments: 3, spent: "$120.00", share: "87%" });
    expect((await run("sum_spending", { group_by: "weekday", from: "2026-11-02", to: "2026-11-02" })).data.groups).toEqual([{ group: "Monday", payments: 3, spent: "$9.30", share: "100%" }]);
    expect((await run("sum_spending", { group_by: "store", ...OCT })).data.groups).toMatchObject([{ group: "Market" }, { group: "Test Store" }]);
  });

  it("compare_spending: two periods and the difference", async () => {
    const r = await run("compare_spending", { first_from: "2026-11-01", first_to: "2026-11-30", second_from: "2026-10-01", second_to: "2026-10-31" });
    expect(r.data).toMatchObject({ first: { period: "November", spent: "$14.80" }, second: { period: "October", spent: "$138.00" }, difference: "$123.20", higher: "second", firstComparedToSecond: "-89%" });
  });

  it("rank_spending: the top ones only", async () => {
    const r = await run("rank_spending", { by: "name", limit: 2 });
    expect(r.data.highestFirst).toMatchObject([{ group: "Weekly groceries", spent: "$120.00" }, { group: "Gym class", spent: "$90.00" }]);
    expect(r.behind).toHaveLength(6);
    expect((await run("rank_spending", { by: "person" })).data.highestFirst).toMatchObject([{ group: "you" }, { group: "your mum" }]);
  });

  it("average_spending: over the days covered, up to today, even for a month not over yet", async () => {
    const r = await run("average_spending", { per: "day", from: "2026-11-01", to: "2026-11-30" });
    expect(r.data).toMatchObject({ average: "$2.96", daysCovered: 5, spent: "$14.80" });
  });

  it("spending_trend: says the direction, or that there isn't enough", async () => {
    expect((await run("spending_trend", { words: ["coffee"], by: "month" })).data).toMatchObject({ direction: "down", series: [{ period: "October 2026", spent: "$16.50" }, { period: "November 2026", spent: "$10.00" }] });
    expect((await run("spending_trend", { words: ["snickers"] })).data.direction).toBe("not_enough_data");
  });

  it("project_month: this month's pace", async () => {
    expect((await run("project_month")).data).toEqual({ month: "November", spentSoFar: "$14.80", payments: 4, daysPassed: 5, daysInMonth: 30, endOfMonthAtThisPace: "$88.80" });
  });

  it("cost_over_time and what_if_stopped: math from the pace so far, rough on few payments", async () => {
    expect((await run("cost_over_time", { words: ["coffee"] })).data).toMatchObject({ payments: 4, spent: "$26.50", overDays: 17, perYear: "$568.97", rough: false });
    expect((await run("what_if_stopped", { words: ["snickers"] })).data).toMatchObject({ payments: 1, rough: true, shareOfAllSpending: "1%" });
  });

  it("money_in_out: money in against spending, and the opening balance isn't money in", async () => {
    expect((await run("money_in_out", OCT)).data).toEqual({ cameIn: "$100.00", wentOut: "$138.00", difference: "$38.00", more: "went_out" });
  });

  it("list_repeats: costs, and only subscriptions when asked", async () => {
    const r = await run("list_repeats", { only_subscriptions: true });
    expect(r.data.found).toEqual([{ name: "Morning coffee", days: 4, payments: 4, spent: "$26.50", usualAmount: "$4.50", subscription: true, sureness: "not_sure" }]);
    expect(((await run("list_repeats")).data.found as object[]).length).toBe(3);
  });

  it("get_memory and explain_belief: what Soul believes and why", async () => {
    expect((await run("get_memory", { only_unsure: true })).data.found).toEqual([{ belief: "You pay for Morning coffee on 4 different days.", sureness: "not_sure", from: "you noticed it in their payments" }]);
    const r = await run("explain_belief", { words: ["mum"] });
    expect(r.data.found).toEqual([{ belief: "You buy the weekly groceries for your mum.", sureness: "sure", from: "they told you", payments: 3, spent: "$120.00" }]);
    expect(ids(r.behind)).toEqual(ids(shop));
  });

  it("get_chapter: by period, or the newest", async () => {
    expect((await run("get_chapter", { from: "2026-10-26", to: "2026-11-01" })).data.found).toEqual([{ title: "Late October", dates: "Oct 26 to Nov 1", sentences: ["A big coffee."] }]);
    expect(((await run("get_chapter")).data.found as object[]).length).toBe(2);
  });

  it("list_corrections, list_actions, list_left_out, data_coverage: read what's there", async () => {
    expect((await run("list_corrections")).data.found).toEqual([{ youSaid: "those are for my mum", becameBelief: "You buy the weekly groceries for your mum.", date: "Nov 4", undone: false }]);
    const acts = await run("list_actions", { only_waiting: true });
    expect(acts.data.found).toEqual([{ did: "bought something", to: "Test Store", amount: "$18.00", status: "waiting", date: "Nov 5" }]);
    expect(((await run("list_actions")).data.found as object[])[0]).toMatchObject({ did: "sent money", feeTakenFromTheReceiver: "$1.36" });
    expect((await run("list_left_out", { words: ["opening"] })).data).toMatchObject({ rows: 1, shown: [{ what: "General account correction", amount: "$5000.00" }] });
    expect((await run("data_coverage")).data).toEqual({ payments: 13, firstPayment: "Aug 3", lastPayment: "Nov 3", lastReadPayPal: "Nov 5", rowsLeftOut: 2, readsBack: "up to 6 months" });
  });
});

describe("time words (T-16.2)", () => {
  // What the picker fills in for each word, with today Thursday, Nov 5, 2026.
  const words: [string, { from: string; to: string }, string, number, string][] = [
    ["this month", { from: "2026-11-01", to: "2026-11-30" }, "November", 4, "$14.80"],
    ["last week", { from: "2026-10-26", to: "2026-11-01" }, "Oct 26 to Nov 1", 1, "$12.00"],
    ["in October", OCT, "October", 6, "$138.00"],
    ["yesterday", { from: "2026-11-04", to: "2026-11-04" }, "Nov 4", 0, "$0.00"],
  ];
  it.each(words)("%s: totals, list and biggest payment follow the period", async (_, period, name, count, spent) => {
    const sum = await run("sum_spending", period);
    expect(sum.data).toMatchObject({ payments: count, spent });
    expect(sum.behind).toHaveLength(count);
    expect(sum.behind.every((p) => p.occurred_at.slice(0, 10) >= period.from && p.occurred_at.slice(0, 10) <= period.to)).toBe(true);
    const top = await run("find_payments", { ...period, sort: "biggest", limit: 1 });
    expect(top.rows[0]?.amount).toBe([...sum.behind].sort((a, b) => b.amount - a.amount)[0]?.amount);
    expect(periodName(period.from, period.to, ledger.today)).toBe(name);
  });

  it("labels say the period, and the steps say it in plain words", async () => {
    expect((await run("sum_spending", OCT)).label).toBe("spent in October");
    expect((await run("sum_spending", { from: "2026-11-04", to: "2026-11-04" })).label).toBe("spent on Nov 4");
    expect((await run("sum_spending", { from: "2026-10-26", to: "2026-11-01", words: ["coffee"] })).label).toBe("spent on coffee from Oct 26 to Nov 1");
    expect((await run("sum_spending")).label).toBe("spent across all your payments");
    expect(stepOf("find_payments", OCT, ledger)).toBe("Checking Your October Payments");
    expect(stepOf("find_payments", {}, ledger)).toBe("Checking Your Payments");
    expect(stepOf("sum_spending", OCT, ledger)).toBe("Adding Up the Numbers");
  });

  it("names a month of another year with its year", () => {
    expect(periodName("2025-10-01", "2025-10-31", ledger.today)).toBe("October 2025");
  });
});

describe("checking parameters (T-16.6)", () => {
  const refuses = (name: string, args: unknown) => expect(checkArgs(name, JSON.stringify(args))).toHaveProperty("error");

  it("refuses what isn't a parameter, whoever it names", () => {
    refuses("find_payments", { account_id: "someone-else" });
    refuses("find_payments", { person_id: "someone-else", from: "2026-10-01" });
    refuses("sum_spending", { __proto__x: 1 });
  });

  it("refuses functions that don't exist, even inherited names", () => {
    refuses("send_money", {});
    refuses("constructor", {});
    refuses("toString", {});
  });

  it("refuses bad values", () => {
    refuses("find_payments", { from: "yesterday" });
    refuses("find_payments", { from: "2026-02-31" });
    refuses("find_payments", { from: "2026-11-05", to: "2026-11-01" });
    refuses("find_payments", { limit: 0 });
    refuses("find_payments", { limit: 61 });
    refuses("find_payments", { limit: 1.5 });
    refuses("find_payments", { min: -1 });
    refuses("find_payments", { min: 9, max: 1 });
    refuses("find_payments", { sort: "random" });
    refuses("find_payments", { words: "coffee" });
    refuses("find_payments", { words: [""] });
    refuses("find_payments", { words: Array(9).fill("a") });
    refuses("find_payments", { category: "not_a_category" });
    refuses("find_peak_period", {});
    refuses("compare_spending", { first_from: "2026-10-01" });
    expect(checkArgs("find_payments", "not json")).toHaveProperty("error");
    expect(checkArgs("find_payments", "[]")).toHaveProperty("error");
  });

  it("takes right values, with a category or its group", () => {
    expect(checkArgs("find_payments", JSON.stringify({ from: "2026-02-28", category: "food_drinks", limit: 60, words: ["coffee"] }))).toHaveProperty("args");
    expect(checkArgs("data_coverage", "")).toEqual({ args: {} });
  });
});
