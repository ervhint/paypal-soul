// Import from PayPal into the shared tables (U2). Reads in windows of 31 days or less (NF-10), up to
// 6 months back on the first import and only past the cursor after that. Rows that aren't purchases go
// to the rows left out with a reason, so no total counts them. Saving is per window, so a failed read
// resumes where it stopped.
import type { SupabaseClient } from "@supabase/supabase-js";
import { categoriseAccount, supabaseCategoryStore } from "@/lib/categories";
import { askJson } from "@/lib/llm";
import { readTransactions, type Page, type PayPalTxn } from "@/lib/paypal";
import { secretClient } from "@/lib/supabase";

const DAY = 86_400_000;
export const WINDOW_DAYS = 31;
export const FIRST_IMPORT_DAYS = 183;

export const LEFT_OUT_LABELS: Record<string, string> = {
  T1900: "General account correction",
  T0300: "Bank deposit to PayPal account",
  T0006: "PayPal checkout payment",
};

export type Account = { id: string; paypal_account_id: string; synced_through: string | null };
export type PaymentRow = { paypal_txn_id: string; occurred_at: string; amount: number; currency: string; name: string | null; payee: string | null; event_code: string };
export type LeftOutRow = { paypal_txn_id: string; occurred_at: string; amount: number; currency: string; event_code: string; reason: string };
export type Sorted = { payments: PaymentRow[]; leftOut: LeftOutRow[] };
export type Reader = (payerId: string, start: Date, end: Date) => Promise<Page>;
export type Store = {
  /** Saves rows not saved before and returns how many payments were new. */
  save: (accountId: string, rows: Sorted) => Promise<number>;
  /** Moves the cursor forward, never back. */
  setCursor: (accountId: string, at: Date) => Promise<void>;
  /** Which of these capture IDs belong to purchases made in Soul (U8). */
  madeInSoul?: (captureIds: string[]) => Promise<Set<string>>;
};

/** Back-to-back windows from `from` to `to`, none longer than 31 days. */
export function windows(from: Date, to: Date): [Date, Date][] {
  const out: [Date, Date][] = [];
  for (let s = from; s < to; ) {
    const e = new Date(Math.min(+s + WINDOW_DAYS * DAY, +to));
    out.push([s, e]);
    s = e;
  }
  return out;
}

const cents = (v: string) => Math.round(Number(v) * 100) / 100;

/** Splits PayPal rows into payments (spending positive) and rows left out with a reason. */
export function sortRows(rows: PayPalTxn[]): Sorted {
  const payments: PaymentRow[] = [];
  const leftOut: LeftOutRow[] = [];
  const funded: PayPalTxn[] = [];
  for (const t of rows) {
    const i = t.transaction_info;
    const base = { paypal_txn_id: i.transaction_id, occurred_at: i.transaction_initiation_date, currency: i.transaction_amount.currency_code, event_code: i.transaction_event_code };
    const amount = cents(i.transaction_amount.value);
    if (i.transaction_event_code === "T1900") leftOut.push({ ...base, amount, reason: "PayPal's opening test balance, not something you bought." });
    else if (i.transaction_event_code === "T0300") funded.push(t);
    else if (i.transaction_status === "D" || i.transaction_status === "V") leftOut.push({ ...base, amount: -amount, reason: "PayPal didn't complete this payment." });
    else {
      const name = i.transaction_subject || t.cart_info?.item_details?.[0]?.item_name || i.transaction_note || null;
      payments.push({ ...base, amount: -amount, name, payee: t.payer_info?.payer_name?.alternate_full_name || null });
    }
  }
  // A bank top-up is made at the same moment as the payment it funds, for the same amount.
  for (const t of funded) {
    const i = t.transaction_info;
    const amount = cents(i.transaction_amount.value);
    const paid = payments.find((p) => p.occurred_at === i.transaction_initiation_date && p.amount === amount);
    const what = paid?.name ? `Bank funding for ${paid.name}.` : "Bank funding for a payment.";
    leftOut.push({ paypal_txn_id: i.transaction_id, occurred_at: i.transaction_initiation_date, amount, currency: i.transaction_amount.currency_code, event_code: "T0300", reason: `${what} Counting it would count that payment twice.` });
  }
  return { payments, leftOut };
}

export const MADE_IN_SOUL = "A purchase made in Soul. It joined the story of the person who made it from PayPal's checkout result, so it isn't counted again.";

/** The capture ID a buyer's row points to, when it's the buyer's side of a checkout payment. */
const captureRef = (t: PayPalTxn) => (t.transaction_info.paypal_reference_id_type === "TXN" ? t.transaction_info.paypal_reference_id : undefined);

/** Moves the report rows of purchases made in Soul to the rows left out, so each is counted once (AC-8.5). */
export function leaveOutMadeInSoul({ payments, leftOut }: Sorted, rows: PayPalTxn[], captured: Set<string>): Sorted {
  const ref = new Map(rows.map((t) => [t.transaction_info.transaction_id, captureRef(t)]));
  const soul = payments.filter((p) => captured.has(ref.get(p.paypal_txn_id) ?? ""));
  return {
    payments: payments.filter((p) => !soul.includes(p)),
    leftOut: [...leftOut, ...soul.map(({ paypal_txn_id, occurred_at, amount, currency, event_code }) => ({ paypal_txn_id, occurred_at, amount, currency, event_code, reason: MADE_IN_SOUL }))],
  };
}

/** Reads everything past the cursor (or 6 months back the first time) and saves it. */
export async function importAccount(account: Account, read: Reader, store: Store, now = new Date()) {
  let cursor = account.synced_through ? new Date(account.synced_through) : new Date(+now - FIRST_IMPORT_DAYS * DAY);
  let added = 0;
  for (const [start, end] of windows(cursor, now)) {
    const page = await read(account.paypal_account_id, start, end);
    const refs = page.rows.map(captureRef).filter((r): r is string => !!r);
    const captured = refs.length && store.madeInSoul ? await store.madeInSoul(refs) : new Set<string>();
    added += await store.save(account.id, leaveOutMadeInSoul(sortRows(page.rows), page.rows, captured));
    // PayPal's report lags; rows after its last refresh may still arrive, so the cursor stops there.
    const done = new Date(Math.min(+end, +new Date(page.lastRefreshed)));
    if (done > cursor) {
      cursor = done;
      await store.setCursor(account.id, done);
    }
  }
  return { added, syncedThrough: cursor.toISOString() };
}

/** The Supabase store. Needs the secret client: shared tables have no write policies. */
export function supabaseStore(admin: SupabaseClient): Store {
  const insert = async (table: string, accountId: string, rows: object[]) => {
    if (!rows.length) return 0;
    const { data, error } = await admin
      .from(table)
      .upsert(rows.map((r) => ({ ...r, account_id: accountId })), { onConflict: "account_id,paypal_txn_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    return data.length;
  };
  return {
    save: async (accountId, { payments, leftOut }) => {
      await insert("left_out_row", accountId, leftOut);
      return insert("payment", accountId, payments);
    },
    setCursor: async (accountId, at) => {
      const iso = at.toISOString();
      const { error } = await admin.from("paypal_account").update({ synced_through: iso }).eq("id", accountId).or(`synced_through.is.null,synced_through.lt.${iso}`);
      if (error) throw error;
    },
    madeInSoul: async (captureIds) => {
      const { data, error } = await admin.from("action").select("paypal_txn_id").in("paypal_txn_id", captureIds);
      if (error) throw error;
      return new Set(data.map((a) => a.paypal_txn_id as string));
    },
  };
}

/** Refresh From PayPal for one account. The prepared account gets its PayPal ID on its first import. */
export async function syncAccount(accountId: string) {
  const admin = secretClient();
  const { data: account, error } = await admin.from("paypal_account").select("id, kind, paypal_account_id, synced_through").eq("id", accountId).single();
  if (error) throw error;
  if (account.kind === "prepared" && account.paypal_account_id === "pending") {
    account.paypal_account_id = process.env.PAYPAL_PREPARED_ACCOUNT_ID!;
    const { error } = await admin.from("paypal_account").update({ paypal_account_id: account.paypal_account_id }).eq("id", accountId);
    if (error) throw error;
  }
  const result = await importAccount(account, readTransactions, supabaseStore(admin));
  // A failed LLM call doesn't fail the sync: those payments keep no category and are tried next time.
  const categorised = await categoriseAccount(accountId, supabaseCategoryStore(admin), askJson).catch((e) => (console.error("categories failed", e), 0));
  return { ...result, categorised };
}
