import type { Action } from "@/lib/action";
import { titleCase } from "@/lib/title-case";

export type { Action };

// Prototype data. P6 replaces each function with the real PayPal sandbox + memory store behind the same API routes.
export type Payment = { id: string; txn: string; item: string; payee: string; category: string; icon: string; amount: number; date: string; forWho: "you" | "support" };
export type LeftOut = { txn: string; code: string; label: string; amount: number; date: string; why: string };
export type Claim = { id: string; text: string; paymentIds: string[]; belief?: string; rewritten?: boolean };
export type Chapter = {
  id: string;
  title: string;
  when: string;
  fresh?: boolean;
  claims: Claim[];
  suggest?: { text: string; label: string; href: string };
};
export type Memory = {
  id: string;
  kind: "habit" | "check" | "interest" | "support" | "told";
  text: string;
  sure: "Sure" | "Fairly Sure" | "Not Sure";
  source: string;
  paymentIds: string[];
  active: boolean;
};
export type Change = { claimId: string; before: string; after: string; notes: string[] };


const seed = () => ({
  source: "prepared" as "prepared" | "own",
  connected: false,
  who: "your mum",
  actions: [] as Action[],
  corrected: false,
  change: null as Change | null,
  payments: [
    { id: "P-1041", txn: "8XK21934LM0563214", payee: "Test Store", category: "Coffee", item: "Morning coffee", icon: "mug-hot", amount: 4.2, date: "Oct 31", forWho: "you" },
    { id: "P-1042", txn: "5TR90771QA2281640", payee: "Test Store", category: "Groceries", item: "Weekly groceries", icon: "basket-shopping", amount: 26.4, date: "Oct 31", forWho: "you" },
    { id: "P-1043", txn: "3HN44028VE7719025", payee: "Test Store", category: "Coffee", item: "Morning coffee", icon: "mug-hot", amount: 4.2, date: "Nov 1", forWho: "you" },
    { id: "P-1044", txn: "9CD63315BY0042871", payee: "Test Store", category: "Public transport", item: "Bus fare", icon: "bus", amount: 2.4, date: "Nov 1", forWho: "you" },
    { id: "P-1045", txn: "1JW78802PK6650393", payee: "Test Store", category: "Mobile plan", item: "Mobile data", icon: "signal", amount: 12.8, date: "Nov 1", forWho: "you" },
    { id: "P-1046", txn: "6MF15590GS3307148", payee: "Test Store", category: "Groceries", item: "Weekly groceries", icon: "basket-shopping", amount: 24.4, date: "Nov 2", forWho: "you" },
  ] as Payment[],
  leftOut: [
    { txn: "0AB37716RT5502981", code: "T1900", label: "General account correction", amount: 5000, date: "Oct 30", why: "PayPal's opening test balance, not something you bought." },
    { txn: "2QL80463ZD1198570", code: "T0300", label: "Bank deposit to PayPal account", amount: 4.2, date: "Oct 31", why: "Funding for your coffee. Counting it would double that payment." },
    { txn: "7VE52219NC8834106", code: "T0300", label: "Bank deposit to PayPal account", amount: 26.4, date: "Oct 31", why: "Funding for your groceries. Counting it would double that payment." },
    { txn: "4GY96640KH2075331", code: "T0300", label: "Bank deposit to PayPal account", amount: 24.4, date: "Nov 2", why: "Funding for your groceries. Counting it would double that payment." },
  ] as LeftOut[],
  chapters: [
    {
      id: "ch1",
      title: "Groceries Keep Showing Up",
      when: "Oct 30 – Nov 2",
      claims: [
        { id: "c3", text: "Two grocery payments in three days, and I think they're for you.", paymentIds: ["P-1042", "P-1046"], belief: "m4" },
        { id: "c1", text: "Your mornings start with coffee.", paymentIds: ["P-1041", "P-1043"], belief: "m1" },
        { id: "c2", text: "The bus fare is small and steady.", paymentIds: ["P-1044"], belief: "m2" },
        { id: "c4", text: "Your mobile data renews every day on its own.", paymentIds: ["P-1045"], belief: "m3" },
      ],
    },
  ] as Chapter[],
  memory: [
    { id: "m1", kind: "habit", text: "You buy coffee most mornings.", sure: "Fairly Sure", source: "2 Payments", paymentIds: ["P-1041", "P-1043"], active: true },
    { id: "m2", kind: "habit", text: "You ride the bus on weekdays.", sure: "Not Sure", source: "1 Payment", paymentIds: ["P-1044"], active: true },
    { id: "m3", kind: "habit", text: "Your mobile data renews daily.", sure: "Sure", source: "A Daily Plan", paymentIds: ["P-1045"], active: true },
    { id: "m4", kind: "check", text: "The groceries are for you.", sure: "Not Sure", source: "2 Payments", paymentIds: ["P-1042", "P-1046"], active: true },
  ] as Memory[],
});

type State = ReturnType<typeof seed>;
const g = globalThis as { __soul?: State };
export const db = () => (g.__soul ??= seed());
export const reset = () => (g.__soul = seed());

export function summary(s = db()) {
  const spent = s.payments.filter((p) => p.forWho === "you").reduce((t, p) => t + p.amount, 0);
  const active = s.memory.filter((m) => m.active);
  return {
    payments: s.payments.length,
    spent: Math.round(spent * 100) / 100,
    habits: active.filter((m) => m.kind === "habit").length,
    checks: active.filter((m) => m.kind === "check").length,
  };
}

export const snapshot = () => {
  const s = db();
  return { ...s, summary: summary(s) };
};

const sendMoney = (txn: string) => {
  const s = db();
  s.payments.push({ id: "P-1048", txn, payee: s.who, category: "Family support", item: `Sent to ${s.who}`, icon: "paper-plane", amount: 25, date: "Nov 2", forWho: "support" });
  s.chapters.unshift({
    id: "ch-sent",
    title: `You Sent ${titleCase(s.who)} $25.00`,
    when: "Just Now",
    fresh: true,
    claims: [{ id: "c6", text: `You sent $25.00 towards ${s.who}'s groceries. This is the first time I helped move money, and I'll remember it.`, paymentIds: ["P-1048"] }],
  });
  s.chapters.forEach((c) => {
    if (c.id !== "ch-sent") {
      c.fresh = false;
      delete c.suggest;
    }
  });
};

// Send money only: purchases are real since U8 (lib/action.ts).
export function createAction(kind: "send", to?: string) {
  const s = db();
  const open = s.actions.find((a) => a.kind === kind && a.status === "waiting");
  if (open) return open;
  const done = s.actions.find((a) => a.kind === kind && a.status === "completed");
  if (done) return done;
  const id = `A-${s.actions.length + 1}`;
  const action: Action = { id, kind, status: "waiting", title: `$25.00 to ${s.who}`, to: to ?? "", amount: 25 };
  s.actions.push(action);
  return action;
}

// Only a completed payment joins the story. P6 completes approved orders on return, on open and in the daily job.
export function settleAction(id: string, outcome: "completed" | "cancelled" | "expired") {
  const s = db();
  const a = s.actions.find((x) => x.id === id);
  if (!a || a.status !== "waiting") return a;
  a.status = outcome;
  if (outcome !== "completed") return a;
  a.txn = "4UP17093XW6628450";
  // Prototype figure in the shape of the Nov 2 test ($1.00 paid, $0.52 fee). P6 shows the fee PayPal returns.
  a.fee = Math.round((a.amount * 0.0349 + 0.49) * 100) / 100;
  sendMoney(a.txn);
  return a;
}
