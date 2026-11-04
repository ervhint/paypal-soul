// Supabase for the BFF. The browser never talks to Supabase: each visitor is an anonymous Supabase
// user whose session lives in cookies set here. Session calls use the anon key, so RLS applies per
// person. The secret key is for shared tables (accounts, payments, rows left out) only (PLAN §3).
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Source = "prepared" | "own";
export type Visitor = { id: string; source: Source | null; connected: boolean };

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

/** The one prepared account, made on first use. U2 fills in its PayPal account ID on the first import. */
export async function preparedAccountId() {
  const admin = secretClient();
  const find = () => must(admin.from("paypal_account").select("id").eq("kind", "prepared").maybeSingle());
  const found = await find();
  if (found) return found.id as string;
  const { error } = await admin.from("paypal_account").insert({ kind: "prepared", paypal_account_id: "pending" });
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

/** My Sandbox: only once the visitor has connected one (U10). Returns false when they haven't. */
export async function chooseOwn(db: SupabaseClient) {
  const id = await userId(db);
  if (!id) return false;
  const own = await must(db.from("paypal_account").select("id").eq("kind", "own").limit(1));
  if (!own.length) return false;
  await must(db.from("person").update({ account_id: own[0].id }).eq("id", id));
  return true;
}

/** The visitor behind the cookie and the data they use, or null before their first choice. Marks the visit for the 30-day cleanup. */
export async function currentVisitor(db: SupabaseClient): Promise<Visitor | null> {
  const id = await userId(db);
  if (!id) return null;
  const person = await must(
    db.from("person").update({ last_visit_at: new Date().toISOString() }).eq("id", id).select("paypal_account(kind)").maybeSingle(),
  );
  if (!person) return null;
  const own = await must(db.from("paypal_account").select("id").eq("kind", "own").limit(1));
  const account = person.paypal_account as unknown as { kind: Source } | null;
  return { id, source: account?.kind ?? null, connected: own.length > 0 };
}
