// Supabase for the BFF. The browser never talks to Supabase: each visitor is an anonymous Supabase
// user whose session lives in cookies set here. Session calls use the anon key, so RLS applies per
// person. The secret key is for shared tables (accounts, payments, rows left out) only (PLAN §3).
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { minimumFound, type StoryPayment } from "@/lib/totals";

export type Source = "prepared" | "own";
/** `linking`: they started consent, finished or not. `connected`: PayPal gave Soul their account ID. */
export type Visitor = { id: string; accountId: string | null; source: Source | null; connected: boolean; linking: boolean };

/** An own account's PayPal ID until consent finishes. */
export const PENDING = "pending";

const url = () => process.env.SUPABASE_URL!;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const secretClient = (headers: Record<string, string> = {}) =>
  createClient(url(), process.env.SUPABASE_SECRET_KEY!, { ...noSession, global: { headers } });

// Only the BFF reads the session, so page scripts can't see it.
export const sessionClient = (cookies: CookieMethodsServer) =>
  createServerClient(url(), process.env.SUPABASE_ANON_KEY!, {
    cookies,
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
  });

const must = async <T>(q: PromiseLike<{ data: T; error: unknown }>) => {
  const { data, error } = await q;
  if (error) throw error;
  return data as NonNullable<T>;
};

async function userId(db: SupabaseClient) {
  const { data } = await db.auth.getClaims();
  return (data?.claims.sub as string | undefined) ?? null;
}

// Anonymous sign-ins are limited per IP. Called from the server, every visitor would share Vercel's IP,
// so the visitor's IP goes in sb-forwarded-for. Supabase honours it only with the secret key, and only
// once IP forwarding is on under Auth → Rate Limits. The session itself then moves into the cookies.
async function signIn(db: SupabaseClient, ip: string | null) {
  const { session } = await must(secretClient(ip ? { "sb-forwarded-for": ip } : {}).auth.signInAnonymously());
  await must(db.auth.setSession(session!));
  return session!.user.id;
}

/** The one prepared account, made on first use. Its PayPal account ID is our sandbox buyer's. */
export async function preparedAccountId() {
  const admin = secretClient();
  const find = () => must(admin.from("paypal_account").select("id").eq("kind", "prepared").maybeSingle());
  const found = await find();
  if (found) return found.id as string;
  const { error } = await admin.from("paypal_account").insert({ kind: "prepared", paypal_account_id: process.env.PAYPAL_PREPARED_ACCOUNT_ID ?? "pending" });
  if (error && error.code !== "23505") throw error; // another visitor made it first
  return (await find()).id as string;
}

/** Try It With Our Prepared Data: signs in a new visitor, or keeps the one in the cookie, and points them at the prepared account. */
export async function choosePrepared(db: SupabaseClient, ip: string | null) {
  const id = (await userId(db)) ?? (await signIn(db, ip));
  const account_id = await preparedAccountId();
  await must(db.from("person").upsert({ id, account_id, last_visit_at: new Date().toISOString() }));
  return id;
}

/** An account's saved payments against the minimum for a story. */
export async function accountMinimum(db: SupabaseClient, accountId: string) {
  const pays = await must(db.from("payment").select("id, paypal_txn_id, occurred_at, amount, currency, name, event_code, category").eq("account_id", accountId));
  return minimumFound(pays as StoryPayment[]);
}

/** My Sandbox: once one is connected, whatever it holds (U10). Returns false otherwise. */
export async function chooseOwn(db: SupabaseClient) {
  const id = await userId(db);
  if (!id) return false;
  const own = await must(db.from("paypal_account").select("id").eq("kind", "own").neq("paypal_account_id", PENDING).limit(1));
  if (!own.length) return false;
  await must(db.from("person").update({ account_id: own[0].id }).eq("id", id));
  return true;
}

/** The visitor behind the cookie and the data they use, or null before their first choice. Marks the visit for the 30-day cleanup. */
export async function currentVisitor(db: SupabaseClient): Promise<Visitor | null> {
  const id = await userId(db);
  if (!id) return null;
  const person = await must(
    db.from("person").update({ last_visit_at: new Date().toISOString() }).eq("id", id).select("account_id, paypal_account(kind)").maybeSingle(),
  );
  if (!person) return null;
  const own = await must(db.from("paypal_account").select("paypal_account_id").eq("kind", "own").limit(1));
  const account = person.paypal_account as unknown as { kind: Source } | null;
  return { id, accountId: person.account_id as string | null, source: account?.kind ?? null, connected: own.some((a) => a.paypal_account_id !== PENDING), linking: own.length > 0 };
}
