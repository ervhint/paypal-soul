// Totals, repeats and habits (U4). Code does every sum and count here, never the LLM (NF-8); the story
// only gets these figures to write from. Days are UTC dates, weeks start on Monday (UTC).
import { categoryLabel, categoryView, paymentName, UNKNOWN_PAYMENT } from "@/lib/categories";

export type StoryPayment = {
  id: string;
  paypal_txn_id: string;
  occurred_at: string;
  amount: number; // positive = money spent
  currency: string;
  name: string | null;
  payee?: string | null; // shown on the evidence sheet, never sent to the LLM
  event_code: string;
  category: string | null;
  for_who?: string | null; // someone else the person said it was for (U5), so it isn't spending on them
  one_off?: boolean; // the person said it was a one-time thing (U17), so it's no part of a pattern
  explained?: boolean; // the person answered Soul's question about it being unusual (U18)
};
export type Sureness = "not_sure" | "fairly_sure" | "sure";
export type Repeat = {
  key: string;
  name: string;
  days: number; // different days it was paid on
  payments: number;
  spent: number;
  paymentIds: string[];
  daily: boolean; // a PayPal subscription charged every day
  sureness: Sureness | null; // null: not a habit (yet)
};

const DAY = 86_400_000;
const cents = (n: number) => Math.round(n * 100);
const sum = (ps: StoryPayment[]) => ps.reduce((t, p) => t + cents(p.amount), 0) / 100;

/** What an own sandbox needs for a story (AC-10.3). */
export const MINIMUM = { days: 7, payments: 5, repeats: 1 };
export type Found = { days: number; payments: number; repeats: number };

export const dayOf = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/** The Monday (UTC) of the week a payment falls in, as YYYY-MM-DD. */
export function weekOf(iso: string) {
  const d = new Date(dayOf(iso));
  return dayOf(new Date(+d - ((d.getUTCDay() + 6) % 7) * DAY).toISOString());
}

/** AC-4.3: Not Sure on 3–4 days, Fairly Sure on 5–9, Sure on 10 or more or a daily subscription. Under 3 days isn't a habit. */
export function habitSureness(days: number, daily: boolean): Sureness | null {
  if (days < 3) return null;
  if (daily || days >= 10) return "sure";
  return days >= 5 ? "fairly_sure" : "not_sure";
}

const SUBSCRIPTION = "T0002";

/**
 * Payments with the same name seen on 2 or more days, most days first. A payment Soul can't identify never
 * repeats. `stopped` leaves out repeats whose habit the person told Soul to stop using (U6).
 */
export function repeats(pays: StoryPayment[], stopped: string[] = []): Repeat[] {
  const groups = new Map<string, StoryPayment[]>();
  for (const p of pays) {
    if (p.amount <= 0 || p.one_off || paymentName(p) === UNKNOWN_PAYMENT) continue;
    const key = p.name!.trim().toLowerCase().replace(/\s+/g, " ");
    groups.get(key)?.push(p) ?? groups.set(key, [p]);
  }
  const out: Repeat[] = [];
  for (const [key, ps] of groups) {
    const days = [...new Set(ps.map((p) => dayOf(p.occurred_at)))].sort();
    if (days.length < 2 || stopped.includes(key)) continue;
    const everyDay = days.every((d, i) => i === 0 || +new Date(d) - +new Date(days[i - 1]) === DAY);
    const daily = everyDay && ps.every((p) => p.event_code === SUBSCRIPTION);
    out.push({
      key,
      name: ps[0].name!.trim(),
      days: days.length,
      payments: ps.length,
      spent: sum(ps),
      paymentIds: ps.map((p) => p.id),
      daily,
      sureness: habitSureness(days.length, daily),
    });
  }
  return out.sort((a, b) => b.days - a.days || b.spent - a.spent);
}

/** The start of an interest belief's key, followed by its category (U13). */
export const INTEREST = "interest:";
export type Interest = { key: string; category: string; days: number; payments: number; spent: number; paymentIds: string[]; sureness: Sureness };

// Groups a person chooses to spend on. Bills, loans, transport, groceries and transfers repeat because
// life needs them, so they say nothing about what someone likes.
const CHOSEN = ["education.", "food_drinks.", "gift_charity.", "health_personal_care.", "hobby_entertainment.", "shopping.", "sports.", "traveling."];

/**
 * Categories the person keeps spending on for themselves, most days first, with the same sureness as a habit
 * (AC-13.1). Pass payments with what they told Soul applied: what was for someone else isn't their interest.
 * `stopped` holds the full keys of interests the person told Soul to stop using.
 */
export function interests(pays: StoryPayment[], stopped: string[] = []): Interest[] {
  const groups = new Map<string, StoryPayment[]>();
  for (const p of pays) {
    if (p.amount <= 0 || p.for_who || p.one_off || !p.category || !CHOSEN.some((c) => p.category!.startsWith(c))) continue;
    groups.get(p.category)?.push(p) ?? groups.set(p.category, [p]);
  }
  const out: Interest[] = [];
  for (const [category, ps] of groups) {
    const days = new Set(ps.map((p) => dayOf(p.occurred_at))).size;
    const sureness = habitSureness(days, false);
    if (!sureness || stopped.includes(`${INTEREST}${category}`)) continue;
    out.push({ key: `${INTEREST}${category}`, category: categoryView(category).name, days, payments: ps.length, spent: sum(ps), paymentIds: ps.map((p) => p.id), sureness });
  }
  return out.sort((a, b) => b.days - a.days || b.spent - a.spent);
}

/** A payment much bigger than the usual for its name, or for its person when it was for someone (U18). */
export type Unusual = { payment: StoryPayment; usual: number; earlier: StoryPayment[]; who: string | null; name: string };

/** What a payment is compared with: the person it was for, or else its name. A payment Soul can't identify has none. */
const usualKey = (p: StoryPayment) => (p.for_who ? `who:${p.for_who.toLowerCase()}` : paymentName(p) === UNKNOWN_PAYMENT ? null : `name:${p.name!.trim().toLowerCase().replace(/\s+/g, " ")}`);

/**
 * AC-18.1: a spending payment is unusual when its name, or its person for support, has at least 3 earlier
 * payments and it's at least 1.5 times their usual and at least $5 more. The usual is the earlier payments'
 * median, or the biggest of them the person already answered about, if that's more: they said it was normal,
 * so a payment like it isn't asked about again. An answered payment is never unusual itself, but it still
 * counts as an earlier one. One-offs (U17) are left out of both sides. Oldest first. Chat and the story both use this.
 */
export function unusual(pays: StoryPayment[]): Unusual[] {
  const kept = pays.filter((p) => p.amount > 0 && !p.one_off).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const seen = new Map<string, StoryPayment[]>();
  const out: Unusual[] = [];
  for (const p of kept) {
    const key = usualKey(p);
    if (!key) continue;
    const earlier = seen.get(key) ?? [];
    if (!p.explained && earlier.length >= 3) {
      const usual = Math.max(median(earlier.map((e) => cents(e.amount))), ...earlier.filter((e) => e.explained).map((e) => cents(e.amount)));
      if (cents(p.amount) * 2 >= usual * 3 && cents(p.amount) - usual >= 500) out.push({ payment: p, usual: usual / 100, earlier: [...earlier], who: p.for_who ?? null, name: paymentName(p) });
    }
    seen.set(key, [...earlier, p]);
  }
  return out;
}

/** The middle value, or the mean of the two middle ones, rounded to a whole number. */
const median = (ns: number[]) => {
  const s = [...ns].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/**
 * Counts and sums for a set of payments. Money received (negative amounts) isn't spending, and what the
 * person said was for someone else is counted per person instead of as spending on them.
 */
export function totals(pays: StoryPayment[]) {
  const spending = pays.filter((p) => p.amount > 0);
  const byCategory = new Map<string, StoryPayment[]>();
  const byWho = new Map<string, StoryPayment[]>();
  for (const p of spending) {
    const c = p.category ?? "unknown";
    byCategory.get(c)?.push(p) ?? byCategory.set(c, [p]);
    if (p.for_who) byWho.get(p.for_who)?.push(p) ?? byWho.set(p.for_who, [p]);
  }
  const days = pays.map((p) => dayOf(p.occurred_at)).sort();
  return {
    payments: pays.length,
    spent: sum(spending),
    onYou: sum(spending.filter((p) => !p.for_who)),
    paymentsOnYou: pays.filter((p) => !p.for_who).length,
    forOthers: [...byWho].map(([who, ps]) => ({ who, payments: ps.length, spent: sum(ps) })).sort((a, b) => b.spent - a.spent),
    received: -sum(pays.filter((p) => p.amount < 0)),
    from: days[0] ?? null,
    to: days.at(-1) ?? null,
    byCategory: [...byCategory]
      .map(([category, ps]) => ({ category: categoryLabel(category), payments: ps.length, spent: sum(ps) }))
      .sort((a, b) => b.spent - a.spent),
  };
}

/** What an account has against the minimum: days from its first payment to its last (both counted), payments and repeats. */
export function minimumFound(pays: StoryPayment[]): Found & { ok: boolean } {
  const spent = pays.filter((p) => p.amount > 0);
  const dates = spent.map((p) => +new Date(dayOf(p.occurred_at)));
  const found = { days: spent.length ? (Math.max(...dates) - Math.min(...dates)) / DAY + 1 : 0, payments: spent.length, repeats: repeats(spent).length };
  return { ...found, ok: found.days >= MINIMUM.days && found.payments >= MINIMUM.payments && found.repeats >= MINIMUM.repeats };
}
