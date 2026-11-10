// The functions Chat can call (U16). The picker chooses them and fills their parameters; code checks the
// parameters, runs them and labels the results. Every function only reads a `Ledger`, which the BFF builds
// from the person's own session, so no parameter can choose whose data is read and none can move money
// (AC-16.6). Every sum and count is made here, never by an LLM (NF-8), and each figure remembers the payments
// behind it, so the list under an answer is built by code (AC-16.7). `sum_fees` from the plan is cut: PayPal's
// fee is kept only for orders made in Soul, where the receiver pays it, so Soul can't say what a person paid.
import type { Balance } from "@/lib/paypal";
import { CATEGORIES, categoryLabel, paymentName, UNKNOWN_PAYMENT } from "@/lib/categories";
import { LEFT_OUT_LABELS, MONEY_IN } from "@/lib/import";
import { clip, money, short } from "@/lib/story";
import { dayOf, repeats, unusual, weekOf, type StoryPayment, type Sureness } from "@/lib/totals";

const DAY = 86_400_000;
const YEAR_DAYS = 365;
const MONTH_DAYS = 30.44;
const DEFAULT_ROWS = 20;
export const MAX_ROWS = 60; // payment rows the LLM reads for one question

export type ChatBelief = { kind: string; text: string; sureness: Sureness; checked: boolean; paymentIds: string[]; categories?: string[] }; // checked: told, corrected or Looks Right; categories: a preference's (U19)
export type ChatChapter = { title: string; startsOn: string; endsOn: string; sentences: string[]; paymentIds: string[] };
export type ChatCorrection = { said: string; became: string | null; at: string; undone: boolean };
export type ChatAction = { kind: string; recipient: string; amount: number; fee: number | null; status: string; at: string; txn: string | null };
export type ChatLeftOut = { occurredAt: string; amount: number; eventCode: string; reason: string };

/** What the functions can read: this person's own data and nothing else. */
export type Ledger = {
  today: string; // YYYY-MM-DD, UTC
  payments: StoryPayment[]; // with what they told Soul applied, oldest first
  stopped: string[];
  beliefs(): Promise<ChatBelief[]>;
  chapters(): Promise<ChatChapter[]>;
  corrections(): Promise<ChatCorrection[]>;
  actions(): Promise<ChatAction[]>;
  leftOut(): Promise<ChatLeftOut[]>;
  lastRead(): Promise<string | null>;
  /** PayPal's balance for the data source in use, asked each time and never saved (U22). Missing: none can be read. */
  balance?(): Promise<Balance & { prepared: boolean }>;
};

/** PayPal didn't answer or refused the balance read: Soul says so, with no figure, and doesn't count the question. */
export class BalanceUnavailable extends Error {}

/** PayPal's time as Chat writes times: "Nov 9 at 14:59 UTC". */
const atTime = (iso: string) => `${short(iso)} at ${new Date(iso).toISOString().slice(11, 16)} UTC`;

/** One figure a function gave: an amount in cents or a count of payments, and the payments behind it. */
export type Figure = { cents?: number; count?: number; ids: string[] };
export type Result = {
  name: string;
  label: string; // what the figures are, like "spent in October"
  data: Record<string, unknown>;
  behind: StoryPayment[]; // every payment behind the figures
  rows: StoryPayment[]; // the payments this function chose to show, first in line for the LLM
  figures: Figure[];
};
type Args = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Out = Pick<Result, "label" | "data" | "behind"> & { rows?: StoryPayment[] };

// ---- Figures ----

const cents = (n: number) => Math.round(n * 100);
const sumCents = (ps: StoryPayment[]) => ps.reduce((t, p) => t + cents(p.amount), 0);
const spending = (ps: StoryPayment[]) => ps.filter((p) => p.amount > 0);

/** Payments grouped by a key, biggest total first. */
function groups(ps: StoryPayment[], key: (p: StoryPayment) => string) {
  const out = new Map<string, StoryPayment[]>();
  for (const p of ps) out.get(key(p))?.push(p) ?? out.set(key(p), [p]);
  return [...out].sort((a, b) => sumCents(b[1]) - sumCents(a[1]));
}

/** Writes figures for the LLM and keeps the payments behind each one. */
class Figures {
  list: Figure[] = [];
  /** An amount worked out from these payments. */
  of(n: number, ps: StoryPayment[]) {
    this.list.push({ cents: Math.abs(cents(n)), ids: ps.map((p) => p.id) });
    return money(Math.abs(n));
  }
  sum(ps: StoryPayment[]) {
    return this.of(sumCents(ps) / 100, ps);
  }
  count(ps: StoryPayment[]) {
    this.list.push({ count: ps.length, ids: ps.map((p) => p.id) });
    return ps.length;
  }
  /** What of these payments was spending on them and what was for others, when anyone else is involved. */
  split(ps: StoryPayment[]) {
    const others = groups(ps.filter((p) => p.for_who), (p) => p.for_who!);
    if (!others.length) return {};
    const own = ps.filter((p) => !p.for_who);
    return {
      onYou: { payments: this.count(own), spent: this.sum(own) },
      forOthers: others.map(([who, list]) => ({ who, payments: this.count(list), spent: this.sum(list) })),
    };
  }
}

const percent = (part: number, whole: number) => `${whole ? Math.round((part / whole) * 100) : 0}%`;
const median = (ns: number[]) => [...ns].sort((a, b) => a - b)[Math.floor((ns.length - 1) / 2)];

// ---- Periods ----

const monthName = (d: string, year: boolean) => new Date(d).toLocaleDateString("en-US", { month: "long", timeZone: "UTC", ...(year ? { year: "numeric" } : {}) });
const lastOfMonth = (d: string) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(+new Date(d) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((+new Date(b) - +new Date(a)) / DAY) + 1; // both counted

/** The period in plain words, like "October", "Nov 5" or "Oct 5 to Oct 11". Null when there's no period. */
export function periodName(from: string | undefined, to: string | undefined, today: string) {
  if (from && to && from === to) return short(from);
  if (from && to && from.endsWith("-01") && to === lastOfMonth(from)) return monthName(from, from.slice(0, 4) !== today.slice(0, 4));
  if (from && to) return `${short(from)} to ${short(to)}`;
  if (from) return `Since ${short(from)}`;
  return to ? `Up to ${short(to)}` : null;
}

/** "in October", "on Nov 5", "from Oct 5 to Oct 11", "since Oct 5", or "across all your payments". */
function during(from: string | undefined, to: string | undefined, today: string) {
  const name = periodName(from, to, today);
  if (!name) return "across all your payments";
  if (!from) return `up to ${short(to!)}`;
  if (!to) return `since ${short(from)}`;
  if (from === to) return `on ${name}`;
  return name.includes(" to ") ? `from ${name}` : `in ${name}`;
}

const inDates = (iso: string, a: Args) => (!a.from || dayOf(iso) >= a.from) && (!a.to || dayOf(iso) <= a.to);

/** The days a question's figures cover, from the first payment Soul can see up to today at most. */
function span(a: Args, l: Ledger) {
  const first = l.payments[0] ? dayOf(l.payments[0].occurred_at) : l.today;
  const from = a.from && a.from > first ? a.from : first;
  const to = a.to && a.to < l.today ? a.to : l.today;
  return { from, days: Math.max(1, daysBetween(from, to)) };
}

// ---- Choosing payments ----

const lower = (words: string[] | undefined) => (words ?? []).map((w) => w.toLowerCase());

function select(l: Ledger, a: Args) {
  const words = lower(a.words);
  const who = a.person?.toLowerCase();
  return l.payments.filter((p) => {
    if (!inDates(p.occurred_at, a)) return false;
    if (a.category && p.category !== a.category && !p.category?.startsWith(`${a.category}.`)) return false;
    if (who === "me" ? p.for_who : who && !p.for_who?.toLowerCase().includes(who)) return false;
    if (!words.length) return true;
    const text = `${paymentName(p)} ${p.payee ?? ""} ${categoryLabel(p.category)} ${p.for_who ?? ""}`.toLowerCase();
    return words.some((w) => text.includes(w));
  });
}

/** What was picked, in words, for labels: "on coffee", "on Groceries", "for your mum". */
function about(a: Args) {
  const who = a.person === "me" ? "on you" : a.person ? `for ${a.person}` : "";
  return [a.words?.length ? `on ${a.words.join(" or ")}` : "", a.category ? `on ${categoryLabel(a.category)}` : "", who].filter(Boolean).join(" ");
}
const labelled = (what: string, a: Args, l: Ledger) => [what, about(a), during(a.from, a.to, l.today)].filter(Boolean).join(" ");
const named = (what: string, a: Args) => [what, about(a)].filter(Boolean).join(" ");

const timeOfDay = (h: number) => (h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "night");
const KEYS: Record<string, (p: StoryPayment) => string> = {
  category: (p) => categoryLabel(p.category),
  day: (p) => short(p.occurred_at),
  week: (p) => `week of ${short(weekOf(p.occurred_at))}`,
  month: (p) => monthName(p.occurred_at, true),
  weekday: (p) => new Date(p.occurred_at).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
  time_of_day: (p) => `${timeOfDay(new Date(p.occurred_at).getUTCHours())} (UTC)`,
  store: (p) => p.payee || "a store I can't name",
  person: (p) => p.for_who ?? "you",
  name: paymentName,
};

/** The pace of these payments, from the first one to today, at least a week so one payment isn't a year's habit. */
function pace(ps: StoryPayment[], l: Ledger) {
  const days = Math.max(7, daysBetween(dayOf(ps[0]?.occurred_at ?? l.today), l.today));
  const perDay = sumCents(ps) / 100 / days;
  return { days, perMonth: perDay * MONTH_DAYS, perYear: perDay * YEAR_DAYS, rough: ps.length < 3 };
}

// ---- The functions ----

const when = (p: StoryPayment) => short(p.occurred_at);
const idsIn = (l: Ledger, ids: string[]) => l.payments.filter((p) => ids.includes(p.id));
const source = (b: ChatBelief) =>
  b.kind === "preference" ? "they told you about themselves" : b.kind === "support" || b.kind === "told" ? "they told you" : b.checked ? "you noticed it and they confirmed it" : "you noticed it in their payments";
/** A belief as the LLM reads it. A preference (U19) has no payments: its related categories say what spending it's about. */
export const beliefView = (b: ChatBelief) => ({ belief: b.text, sureness: b.sureness, from: source(b), ...(b.kind === "preference" ? { relatedCategories: (b.categories ?? []).map(categoryLabel) } : {}) });

const date = { type: "string", description: "YYYY-MM-DD" };
const PERIOD = { from: { ...date, description: "First day, YYYY-MM-DD" }, to: { ...date, description: "Last day, YYYY-MM-DD" } };
const WHAT = {
  category: { type: "string", description: "A category id, or a group like food_drinks" },
  words: { type: "array", items: { type: "string" }, description: "Words to look for in payment names, stores, categories and people. Any one is enough. Use words from the names list that mean what was asked." },
  person: { type: "string", description: `Who it was for: "me", or a name like "mum"` },
};
const FILTER = { ...PERIOD, ...WHAT };
const limit = { type: "integer", minimum: 1, maximum: MAX_ROWS };

type Fn = { description: string; params: Record<string, object>; required?: string[]; step: (a: Args, l: Ledger) => string; run: (a: Args, l: Ledger, f: Figures) => Out | Promise<Out> };

const checking = (a: Args, l: Ledger) => {
  const period = periodName(a.from, a.to, l.today);
  return period ? `Checking Your ${period} Payments` : "Checking Your Payments";
};
const adding = () => "Adding Up the Numbers";
const repeated = () => "Checking Your Repeated Payments";
const memory = () => "Checking What I Know About You";

export const FUNCTIONS: Record<string, Fn> = {
  find_payments: {
    description: "List payments: the biggest, the last one, ones over an amount, or money received and refunds with kind received.",
    params: { ...FILTER, min: { type: "number", minimum: 0 }, max: { type: "number", minimum: 0 }, kind: { enum: ["spending", "received"] }, sort: { enum: ["newest", "oldest", "biggest", "smallest"] }, limit },
    step: checking,
    async run(a, l, f) {
      const bounds = { ...(a.min !== undefined ? { atLeast: f.of(a.min, []) } : {}), ...(a.max !== undefined ? { atMost: f.of(a.max, []) } : {}) };
      const inside = (n: number) => (a.min === undefined || n >= a.min) && (a.max === undefined || n <= a.max);
      if (a.kind === "received") {
        const refunds = select(l, a).filter((p) => p.amount < 0 && inside(-p.amount));
        const came = (await l.leftOut()).filter((r) => r.reason === MONEY_IN && inside(r.amount) && inDates(r.occurredAt, a));
        const total = came.reduce((t, r) => t + cents(r.amount), 0) - sumCents(refunds);
        return {
          label: labelled("money received", a, l),
          data: { ...bounds, payments: refunds.length + came.length, received: f.of(total / 100, refunds), moneyIn: came.map((r) => ({ date: short(r.occurredAt), amount: f.of(r.amount, []) })) },
          behind: refunds,
          rows: refunds,
        };
      }
      const all = spending(select(l, a)).filter((p) => inside(p.amount));
      const order: Record<string, (x: StoryPayment, y: StoryPayment) => number> = {
        newest: (x, y) => +new Date(y.occurred_at) - +new Date(x.occurred_at),
        oldest: (x, y) => +new Date(x.occurred_at) - +new Date(y.occurred_at),
        biggest: (x, y) => y.amount - x.amount,
        smallest: (x, y) => x.amount - y.amount,
      };
      const rows = [...all].sort(order[a.sort ?? "newest"]).slice(0, a.limit ?? DEFAULT_ROWS);
      return { label: labelled("payments", a, l), data: { ...bounds, payments: f.count(all), spent: f.sum(all), ...f.split(all), order: a.sort ?? "newest", shown: rows.length }, behind: all, rows };
    },
  },
  find_new: {
    description: "Payments with a name not seen before the period.",
    params: PERIOD,
    required: ["from"],
    step: checking,
    run(a, l, f) {
      const seen = new Set(l.payments.filter((p) => dayOf(p.occurred_at) < a.from).map((p) => paymentName(p).toLowerCase()));
      const fresh = spending(select(l, a)).filter((p) => !seen.has(paymentName(p).toLowerCase()));
      const found = groups(fresh, paymentName).map(([name, ps]) => ({ name, firstSeen: when(ps[0]), payments: f.count(ps), spent: f.sum(ps) }));
      return { label: labelled("new payments", a, l), data: { found }, behind: fresh, rows: fresh };
    },
  },
  find_unusual: {
    description: "Payments much bigger than the usual amount for that name, or for that person when it was for someone.",
    params: FILTER,
    step: checking,
    run(a, l, f) {
      // The story's rule (AC-18.6): one-offs and payments the person already explained are left out.
      const kept = new Set(select(l, a).map((p) => p.id));
      const found = unusual(l.payments).filter((u) => kept.has(u.payment.id));
      const odd = found.map((u) => u.payment);
      return {
        label: labelled("payments much bigger than usual", a, l),
        data: { found: found.map((u) => ({ name: u.name, ...(u.who ? { for: u.who } : {}), date: when(u.payment), amount: f.of(u.payment.amount, [u.payment]), usual: f.of(u.usual, u.earlier) })) },
        behind: odd,
        rows: odd,
      };
    },
  },
  find_duplicates: {
    description: "Payments that look paid twice: same name, amount and day.",
    params: PERIOD,
    step: checking,
    run(a, l, f) {
      const twice = groups(spending(select(l, a)), (p) => `${paymentName(p)}|${p.amount}|${dayOf(p.occurred_at)}|${p.payee ?? ""}`)
        .map(([, ps]) => ps)
        .filter((ps) => ps.length > 1 && paymentName(ps[0]) !== UNKNOWN_PAYMENT);
      return {
        label: labelled("payments that look paid twice", a, l),
        data: { found: twice.map((ps) => ({ name: paymentName(ps[0]), date: when(ps[0]), times: ps.length, eachAmount: f.of(ps[0].amount, ps), together: f.sum(ps) })) },
        behind: twice.flat(),
        rows: twice.flat(),
      };
    },
  },
  find_price_changes: {
    description: "Names whose amount went up or down between payments.",
    params: FILTER,
    step: checking,
    run(a, l, f) {
      const changed = groups(spending(select(l, a)), paymentName).flatMap(([name, ps]) => {
        if (name === UNKNOWN_PAYMENT) return [];
        const steps = ps.slice(1).map((now, i) => ({ was: ps[i], now })).filter((s) => s.was.amount !== s.now.amount);
        return steps.length ? [{ name, ...steps.at(-1)!, changes: steps.length }] : [];
      });
      const pairs = changed.flatMap((c) => [c.was, c.now]);
      return {
        label: labelled("amounts that changed", a, l),
        data: { found: changed.map((c) => ({ name: c.name, was: f.of(c.was.amount, [c.was]), now: f.of(c.now.amount, [c.now]), went: c.now.amount > c.was.amount ? "up" : "down", on: when(c.now), changes: c.changes })) },
        behind: pairs,
        rows: pairs,
      };
    },
  },
  find_stopped: {
    description: "Repeated payments that have stopped coming.",
    params: {},
    step: repeated,
    run(_, l, f) {
      const gone = repeats(l.payments, l.stopped).flatMap((r) => {
        const ps = idsIn(l, r.paymentIds);
        const days = [...new Set(ps.map((p) => dayOf(p.occurred_at)))].sort();
        const gap = median(days.slice(1).map((d, i) => daysBetween(days[i], d) - 1));
        const quiet = daysBetween(days.at(-1)!, l.today) - 1;
        return days.length >= 3 && quiet >= Math.max(7, gap * 2) ? [{ name: r.name, ps, last: days.at(-1)!, quiet }] : [];
      });
      return {
        label: "repeated payments that stopped coming",
        data: { found: gone.map((g) => ({ name: g.name, lastPaid: short(g.last), daysQuiet: g.quiet, payments: f.count(g.ps), spent: f.sum(g.ps) })) },
        behind: gone.flatMap((g) => g.ps),
      };
    },
  },
  find_peak_period: {
    description: "The most expensive day, week or month.",
    params: { ...FILTER, unit: { enum: ["day", "week", "month"] } },
    required: ["unit"],
    step: checking,
    run(a, l, f) {
      const top = groups(spending(select(l, a)), KEYS[a.unit]).slice(0, 3);
      const peak = top[0]?.[1] ?? [];
      return { label: labelled(`most expensive ${a.unit}s`, a, l), data: { highestFirst: top.map(([period, ps]) => ({ period, payments: f.count(ps), spent: f.sum(ps) })) }, behind: peak, rows: peak };
    },
  },
  sum_spending: {
    description: "Total spent, optionally grouped with percentages. Also says which days had no spending.",
    params: { ...FILTER, group_by: { enum: Object.keys(KEYS) } },
    step: adding,
    run(a, l, f) {
      const all = spending(select(l, a));
      const s = span(a, l);
      const spentOn = new Set(all.map((p) => dayOf(p.occurred_at)));
      const quiet = Array.from({ length: s.days }, (_, i) => addDays(s.from, i)).filter((d) => !spentOn.has(d));
      const grouped = a.group_by ? { groupedBy: a.group_by, groups: groups(all, KEYS[a.group_by]).map(([group, ps]) => ({ group, payments: f.count(ps), spent: f.sum(ps), share: percent(sumCents(ps), sumCents(all)) })) } : {};
      return {
        label: labelled("spent", a, l),
        data: { payments: f.count(all), spent: f.sum(all), ...f.split(all), ...grouped, daysWithSpending: spentOn.size, daysWithoutSpending: quiet.length, noSpendingOn: quiet.slice(-31).map(short) },
        behind: all,
      };
    },
  },
  compare_spending: {
    description: "Compare spending in two periods.",
    params: { first_from: date, first_to: date, second_from: date, second_to: date, ...WHAT },
    required: ["first_from", "first_to", "second_from", "second_to"],
    step: adding,
    run(a, l, f) {
      const part = (from: string, to: string) => spending(select(l, { ...a, from, to }));
      const [one, two] = [part(a.first_from, a.first_to), part(a.second_from, a.second_to)];
      const [x, y] = [sumCents(one), sumCents(two)];
      return {
        label: named("spending compared", a),
        data: {
          first: { period: periodName(a.first_from, a.first_to, l.today), payments: f.count(one), spent: f.sum(one) },
          second: { period: periodName(a.second_from, a.second_to, l.today), payments: f.count(two), spent: f.sum(two) },
          difference: f.of((x - y) / 100, [...one, ...two]),
          higher: x === y ? "same" : x > y ? "first" : "second",
          ...(y ? { firstComparedToSecond: `${x >= y ? "+" : "-"}${percent(Math.abs(x - y), y)}` } : {}),
        },
        behind: [...one, ...two],
      };
    },
  },
  rank_spending: {
    description: "Top categories, names, stores or people by money spent.",
    params: { ...FILTER, by: { enum: ["category", "name", "store", "person"] }, limit },
    required: ["by"],
    step: adding,
    run(a, l, f) {
      const all = spending(select(l, a));
      const top = groups(all, KEYS[a.by]).slice(0, a.limit ?? 5);
      return {
        label: labelled(`top ${a.by === "category" ? "categories" : `${a.by}s`}`, a, l),
        data: { highestFirst: top.map(([group, ps]) => ({ group, payments: f.count(ps), spent: f.sum(ps), share: percent(sumCents(ps), sumCents(all)) })) },
        behind: top.flatMap(([, ps]) => ps),
      };
    },
  },
  average_spending: {
    description: "Average spent per day, week or month.",
    params: { ...FILTER, per: { enum: ["day", "week", "month"] } },
    required: ["per"],
    step: adding,
    run(a, l, f) {
      const all = spending(select(l, a));
      const s = span(a, l);
      const units = Math.max(1, s.days / ({ day: 1, week: 7, month: MONTH_DAYS } as Record<string, number>)[a.per]);
      return { label: labelled(`average per ${a.per}`, a, l), data: { average: f.of(sumCents(all) / 100 / units, all), per: a.per, payments: f.count(all), spent: f.sum(all), daysCovered: s.days }, behind: all };
    },
  },
  spending_trend: {
    description: "Whether spending is going up or down, week by week or month by month.",
    params: { ...FILTER, by: { enum: ["week", "month"] } },
    step: adding,
    run(a, l, f) {
      const all = spending(select(l, a));
      const byMonth = a.by === "month";
      const series = groups(all, (p) => (byMonth ? `${dayOf(p.occurred_at).slice(0, 7)}-01` : weekOf(p.occurred_at))).sort((x, y) => x[0].localeCompare(y[0]));
      const half = Math.floor(series.length / 2);
      const average = (s: typeof series) => s.reduce((t, [, ps]) => t + sumCents(ps), 0) / (s.length || 1);
      const [early, late] = [average(series.slice(0, half)), average(series.slice(series.length - half))];
      return {
        label: labelled(`spending by ${byMonth ? "month" : "week"}`, a, l),
        data: {
          direction: series.length < 2 ? "not_enough_data" : late > early * 1.1 ? "up" : late < early * 0.9 ? "down" : "flat",
          series: series.map(([period, ps]) => ({ period: byMonth ? monthName(period, true) : `week of ${short(period)}`, payments: f.count(ps), spent: f.sum(ps) })),
        },
        behind: all,
      };
    },
  },
  project_month: {
    description: "Where this calendar month ends up at its pace so far.",
    params: WHAT,
    step: adding,
    run(a, l, f) {
      const start = `${l.today.slice(0, 7)}-01`;
      const so = spending(select(l, { ...a, from: start, to: l.today }));
      const [passed, month] = [daysBetween(start, l.today), daysBetween(start, lastOfMonth(start))];
      return {
        label: named("this month's pace", a),
        data: { month: monthName(start, false), spentSoFar: f.sum(so), payments: f.count(so), daysPassed: passed, daysInMonth: month, endOfMonthAtThisPace: f.of(((sumCents(so) / 100) * month) / passed, so) },
        behind: so,
      };
    },
  },
  cost_over_time: {
    description: "What something costs per month or per year at its pace so far.",
    params: WHAT,
    step: adding,
    run(a, l, f) {
      const ps = spending(select(l, a));
      const p = pace(ps, l);
      return { label: named("cost at the pace so far", a), data: { payments: f.count(ps), spent: f.sum(ps), overDays: p.days, perMonth: f.of(p.perMonth, ps), perYear: f.of(p.perYear, ps), rough: p.rough }, behind: ps };
    },
  },
  what_if_stopped: {
    description: "The math of leaving something out of spending. It's math, not advice.",
    params: WHAT,
    step: adding,
    run(a, l, f) {
      const ps = spending(select(l, a));
      const p = pace(ps, l);
      return {
        label: named("what would stay with you without it, as math", a),
        data: { payments: f.count(ps), spent: f.sum(ps), overDays: p.days, perMonth: f.of(p.perMonth, ps), perYear: f.of(p.perYear, ps), shareOfAllSpending: percent(sumCents(ps), sumCents(spending(l.payments))), rough: p.rough },
        behind: ps,
      };
    },
  },
  money_in_out: {
    description: "Money that came in against money that went out.",
    params: PERIOD,
    step: adding,
    async run(a, l, f) {
      const all = select(l, a);
      const out = spending(all);
      const refunds = all.filter((p) => p.amount < 0);
      const came = (await l.leftOut()).filter((r) => r.reason === MONEY_IN && inDates(r.occurredAt, a));
      const inCents = came.reduce((t, r) => t + cents(r.amount), 0) - sumCents(refunds);
      const outCents = sumCents(out);
      return {
        label: labelled("money in and out", a, l),
        data: { cameIn: f.of(inCents / 100, refunds), wentOut: f.sum(out), difference: f.of((inCents - outCents) / 100, [...refunds, ...out]), more: inCents === outCents ? "same" : inCents > outCents ? "came_in" : "went_out" },
        behind: [...refunds, ...out],
      };
    },
  },
  list_repeats: {
    description: "Payments that repeat, like habits and subscriptions, with what they cost.",
    params: { only_subscriptions: { type: "boolean" } },
    step: repeated,
    run(a, l, f) {
      const found = repeats(l.payments, l.stopped)
        .map((r) => ({ r, ps: idsIn(l, r.paymentIds) }))
        .map((x) => ({ ...x, subscription: x.ps.every((p) => p.event_code === "T0002") }))
        .filter((x) => !a.only_subscriptions || x.subscription);
      return {
        label: a.only_subscriptions ? "subscriptions" : "payments that repeat",
        data: { found: found.map(({ r, ps, subscription }) => ({ name: r.name, days: r.days, payments: f.count(ps), spent: f.sum(ps), usualAmount: f.of(median(ps.map((p) => p.amount)), ps), subscription, sureness: r.sureness ?? "not_a_habit" })) },
        behind: found.flatMap((x) => x.ps),
      };
    },
  },
  get_memory: {
    description: "What Soul believes about the person, with what they told Soul about themselves. Option: only what it's unsure about.",
    params: { only_unsure: { type: "boolean" } },
    step: memory,
    async run(a, l) {
      const found = (await l.beliefs()).filter((b) => !a.only_unsure || b.sureness !== "sure");
      return { label: a.only_unsure ? "what I'm unsure about" : "what I know about you", data: { found: found.map(beliefView) }, behind: idsIn(l, found.flatMap((b) => b.paymentIds)) };
    },
  },
  explain_belief: {
    description: "Why Soul believes something, with the payments behind it.",
    params: { words: { ...WHAT.words, description: "Words from the belief, like coffee or mum" } },
    step: memory,
    async run(a, l, f) {
      const all = await l.beliefs();
      const words = lower(a.words);
      const matching = all.filter((b) => words.some((w) => b.text.toLowerCase().includes(w)));
      const found = (matching.length ? matching : all).map((b) => ({ b, ps: idsIn(l, b.paymentIds) }));
      const ps = idsIn(l, found.flatMap((x) => x.b.paymentIds));
      return { label: "why I believe this", data: { found: found.map((x) => ({ ...beliefView(x.b), payments: f.count(x.ps), spent: f.sum(x.ps) })) }, behind: ps, rows: ps };
    },
  },
  get_chapter: {
    description: "The story chapters of a period, or the newest one.",
    params: PERIOD,
    step: () => "Reading Your Story",
    async run(a, l) {
      const all = await l.chapters();
      const found = (a.from || a.to ? all.filter((c) => (!a.from || c.endsOn >= a.from) && (!a.to || c.startsOn <= a.to)) : all).slice(0, 3);
      return {
        label: a.from || a.to ? `chapters ${during(a.from, a.to, l.today)}` : "the newest chapters",
        data: { found: found.map((c) => ({ title: c.title, dates: c.startsOn === c.endsOn ? short(c.startsOn) : `${short(c.startsOn)} to ${short(c.endsOn)}`, sentences: c.sentences })) },
        behind: idsIn(l, found.flatMap((c) => c.paymentIds)),
      };
    },
  },
  list_corrections: {
    description: "What the person has corrected.",
    params: {},
    step: () => "Checking What You've Told Me",
    async run(_, l) {
      const found = await l.corrections();
      return { label: "what you've corrected", data: { found: found.map((c) => ({ youSaid: c.said, becameBelief: c.became, date: short(c.at), undone: c.undone })) }, behind: [] };
    },
  },
  list_actions: {
    description: "What was bought or sent through Soul. Option: only what's still waiting.",
    params: { only_waiting: { type: "boolean" } },
    step: () => "Checking What You Did Through Soul",
    async run(a, l, f) {
      const found = (await l.actions()).filter((x) => !a.only_waiting || x.status === "waiting");
      const paid = (x: ChatAction) => l.payments.filter((p) => p.paypal_txn_id === x.txn);
      return {
        label: a.only_waiting ? "what's still waiting" : "what you did through Soul",
        data: { found: found.map((x) => ({ did: x.kind === "send" ? "sent money" : "bought something", to: x.recipient, amount: f.of(x.amount, paid(x)), status: x.status, date: short(x.at), ...(x.fee !== null ? { feeTakenFromTheReceiver: f.of(x.fee, []) } : {}) })) },
        behind: found.flatMap(paid),
      };
    },
  },
  list_left_out: {
    description: "PayPal rows Soul leaves out of totals, and why. For questions about a missing payment.",
    params: { ...PERIOD, words: { ...WHAT.words, description: "Words to look for in the reason" } },
    step: () => "Checking the Rows I Left Out",
    async run(a, l, f) {
      const words = lower(a.words);
      const found = (await l.leftOut()).filter((r) => inDates(r.occurredAt, a) && (!words.length || words.some((w) => r.reason.toLowerCase().includes(w))));
      return {
        label: labelled("rows left out", a, l),
        data: { rows: found.length, shown: found.slice(-30).map((r) => ({ what: LEFT_OUT_LABELS[r.eventCode] ?? "Other PayPal row", date: short(r.occurredAt), amount: f.of(r.amount, []), why: r.reason })) },
        behind: [],
      };
    },
  },
  data_coverage: {
    description: "How far back Soul can see and when it last read PayPal.",
    params: {},
    step: () => "Checking What I Can See",
    async run(_, l) {
      const [read, left] = await Promise.all([l.lastRead(), l.leftOut()]);
      const days = l.payments.map((p) => dayOf(p.occurred_at));
      return { label: "what I can see", data: { payments: days.length, firstPayment: days[0] ? short(days[0]) : null, lastPayment: days.length ? short(days.at(-1)!) : null, lastReadPayPal: read ? short(read) : null, rowsLeftOut: left.length, readsBack: "up to 6 months" }, behind: [] };
    },
  },
  get_balance: {
    description: "The person's PayPal balance right now, as PayPal states it: total and available. A figure, never advice.",
    params: {},
    step: () => "Asking PayPal for Your Balance",
    async run(_, l, f) {
      let b: Awaited<ReturnType<NonNullable<Ledger["balance"]>>>;
      try {
        if (!l.balance) throw new Error("no balance reader");
        b = await l.balance();
      } catch (e) {
        throw new BalanceUnavailable(String(e));
      }
      const figure = (n: number, c: string) => (c === "USD" ? f.of(n, []) : `${f.of(n, []).slice(1)} ${c}`);
      const whose = b.prepared ? "the prepared sandbox account's PayPal balance, which every visitor on prepared data shares" : "your PayPal balance";
      return {
        label: `${whose}, as of ${atTime(b.asOf)}`,
        data: {
          asOf: atTime(b.asOf),
          balances: b.currencies.map((c) => ({ currency: c.currency, total: figure(c.total, c.currency), available: figure(c.available, c.currency), ...(c.withheld > 0 ? { onHold: figure(c.withheld, c.currency) } : {}) })),
        },
        behind: [],
      };
    },
  },
};

/** The functions as the picker reads them, in a fixed order so the prompt can be cached. */
export const TOOLS = Object.entries(FUNCTIONS).map(([name, fn]) => ({
  type: "function",
  function: { name, description: fn.description, parameters: { type: "object", properties: fn.params, required: fn.required ?? [], additionalProperties: false } },
}));

// ---- Checking parameters ----

const realDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(+new Date(s)) && new Date(s).toISOString().startsWith(s);
const onTheList = (s: string) => CATEGORIES.some((c) => c === s || c.startsWith(`${s}.`));

type Prop = { type?: string; enum?: string[]; minimum?: number; maximum?: number; description?: string };

function badValue(key: string, v: unknown, p: Prop): string | null {
  if (p.enum) return p.enum.includes(v as string) ? null : `${key} must be one of ${p.enum.join(", ")}`;
  if (p.type === "boolean") return typeof v === "boolean" ? null : `${key} must be true or false`;
  if (p.type === "array") return Array.isArray(v) && v.length <= 8 && v.every((w) => typeof w === "string" && w.trim() && w.length <= 60) ? null : `${key} must be up to 8 short strings`;
  if (p.type === "number" || p.type === "integer") {
    const ok = typeof v === "number" && Number.isFinite(v) && (p.type === "number" || Number.isInteger(v)) && v >= (p.minimum ?? -Infinity) && v <= (p.maximum ?? Infinity);
    return ok ? null : `${key} is out of range`;
  }
  if (typeof v !== "string") return `${key} must be a string`;
  if (p.description?.includes("YYYY-MM-DD")) return realDate(v) ? null : `${key} must be a real date, YYYY-MM-DD`;
  if (key === "category") return onTheList(v) ? null : "category isn't on the list";
  return v.length <= 60 ? null : `${key} is too long`;
}

/** The parameters when they're right, or why they aren't. Anything not in the function's list is refused. */
export function checkArgs(name: string, raw: string): { args: Args } | { error: string } {
  const fn = Object.hasOwn(FUNCTIONS, name) ? FUNCTIONS[name] : undefined;
  if (!fn) return { error: `There is no function ${clip(name, 40)}` };
  let a: Args;
  try {
    a = JSON.parse(raw || "{}");
  } catch {
    return { error: "The parameters aren't JSON" };
  }
  if (!a || typeof a !== "object" || Array.isArray(a)) return { error: "The parameters must be an object" };
  for (const key of Object.keys(a)) {
    if (!Object.hasOwn(fn.params, key)) return { error: `${clip(key, 40)} isn't a parameter of ${name}` };
    const bad = badValue(key, a[key], fn.params[key] as Prop);
    if (bad) return { error: bad };
  }
  const missing = (fn.required ?? []).find((k) => a[k] === undefined);
  if (missing) return { error: `${missing} is needed` };
  for (const [x, y] of [["from", "to"], ["first_from", "first_to"], ["second_from", "second_to"]]) if (a[x] && a[y] && a[x] > a[y]) return { error: `${x} comes after ${y}` };
  if (a.min !== undefined && a.max !== undefined && a.min > a.max) return { error: "min is over max" };
  return { args: a };
}

/** What the person sees while this function runs (AC-16.9). */
export const stepOf = (name: string, args: Args, l: Ledger) => FUNCTIONS[name].step(args, l);

/** Runs one function with checked parameters. */
export async function runFunction(name: string, args: Args, l: Ledger): Promise<Result> {
  const f = new Figures();
  const out = await FUNCTIONS[name].run(args, l, f);
  return { name, rows: [], ...out, figures: f.list };
}
