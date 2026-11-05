// Delete My Data and the daily job (U11). Deleting the anonymous Supabase user cascades to their person row,
// their own sandbox account with its payments, and every personal row (PLAN §3), so both are one call each.
// The prepared account and its shared payments never go. Only people Soul made (rows in `person`) are touched.
import type { SupabaseClient } from "@supabase/supabase-js";
import { PENDING } from "@/lib/supabase";

const DAY = 86_400_000;
/** Prepared-data people go once their last visit is this many days or more before the run. */
export const IDLE_DAYS = 30;

/** Delete My Data: the person and everything Soul keeps for them. */
export async function deletePerson(admin: SupabaseClient, personId: string) {
  const { error } = await admin.auth.admin.deleteUser(personId);
  if (error && error.status !== 404) throw error;
}

/** People last seen 30 days or more before `now` (UTC) with no connected own sandbox. A connected person keeps their data until Delete My Data. */
export async function forgetIdle(admin: SupabaseClient, now = new Date()) {
  const before = new Date(+now - IDLE_DAYS * DAY).toISOString();
  const { data: idle, error } = await admin.from("person").select("id").lte("last_visit_at", before).limit(500);
  if (error) throw error;
  if (!idle.length) return 0;
  const ids = idle.map((p) => p.id as string);
  const { data: own, error: ownError } = await admin.from("paypal_account").select("owner_id").eq("kind", "own").neq("paypal_account_id", PENDING).in("owner_id", ids);
  if (ownError) throw ownError;
  const keep = new Set(own.map((a) => a.owner_id as string));
  let gone = 0;
  for (const id of ids) {
    if (keep.has(id)) continue;
    await deletePerson(admin, id);
    gone++;
  }
  return gone;
}

/** Every account Soul can read: the prepared one and each connected own sandbox. */
async function readableAccounts(admin: SupabaseClient) {
  const { data, error } = await admin.from("paypal_account").select("id, kind, paypal_account_id");
  if (error) throw error;
  return data.filter((a) => a.kind === "prepared" || a.paypal_account_id !== PENDING).map((a) => a.id as string);
}

/** `settle` captures approved orders (settleWaiting), `sync` imports one account (syncAccount). */
export type DailyDeps = { settle: () => Promise<unknown>; sync: (accountId: string) => Promise<unknown> };

/** The daily job: captures approved orders first, so the import leaves them out, then imports every account, then forgets idle people. One failure doesn't stop the rest. Any query also keeps Supabase awake. */
export async function dailyJob(admin: SupabaseClient, { settle, sync }: DailyDeps, now = new Date()) {
  const actions = await settle().catch((e) => (console.error("daily captures failed", e), null));
  let imported = 0;
  let failed = 0;
  for (const id of await readableAccounts(admin)) {
    await sync(id).then(
      () => imported++,
      (e) => (console.error("daily import failed", id, e), failed++),
    );
  }
  const forgotten = await forgetIdle(admin, now);
  return { actions, imported, failed, forgotten };
}
