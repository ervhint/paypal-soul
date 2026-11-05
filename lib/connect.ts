// Connecting an own sandbox (U10). The person approves Soul on PayPal; Soul keeps the tracking ID until
// PayPal names their account, then only the account ID (NF-5). Check Connection works from what PayPal
// says, never from the return link, which may not come back at all.
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncAccount, type Reader } from "@/lib/import";
import { PayPalError, type Consent } from "@/lib/paypal";
import { accountMinimum, PENDING } from "@/lib/supabase";
import type { Found } from "@/lib/totals";

const DAY = 86_400_000;

export type Check = { state: "start" | "pending" | "denied" | "empty" | "offline" | "ready" } | { state: "little"; found: Found };

async function ownAccount(admin: SupabaseClient, personId: string) {
  const { data, error } = await admin.from("paypal_account").select("id, paypal_account_id, tracking_id").eq("kind", "own").eq("owner_id", personId).maybeSingle();
  if (error) throw error;
  return data;
}

/** A link to PayPal's consent page, with a new tracking ID each time. Null when a sandbox is connected already. */
export async function startConsent(admin: SupabaseClient, personId: string, origin: string, consent: Consent) {
  const own = await ownAccount(admin, personId);
  if (own && own.paypal_account_id !== PENDING) return null;
  const tracking_id = crypto.randomUUID();
  const link = await consent.link(tracking_id, `${origin}/connect`);
  const { error } = own
    ? await admin.from("paypal_account").update({ tracking_id }).eq("id", own.id)
    : await admin.from("paypal_account").insert({ kind: "own", owner_id: personId, paypal_account_id: PENDING, tracking_id });
  if (error) throw error;
  return link;
}

/** Check Connection: finds the account, imports it, and moves the person onto it once it's enough for a story. */
export async function checkConnection(admin: SupabaseClient, personId: string, consent: Consent, read: Reader, sync: (accountId: string) => Promise<unknown> = syncAccount): Promise<Check> {
  const own = await ownAccount(admin, personId);
  if (!own) return { state: "start" };
  try {
    if (own.paypal_account_id === PENDING) {
      const found = await consent.find(own.tracking_id);
      if (!found) return { state: "pending" };
      if (!found.canRead) return { state: "denied" };
      // PayPal can say "you're all set" and still refuse, so the ID is kept only after a read works.
      const now = new Date();
      await read(found.payerId, new Date(+now - DAY), now);
      const { error } = await admin.from("paypal_account").update({ paypal_account_id: found.payerId }).eq("id", own.id);
      if (error) throw error;
    }
    await sync(own.id);
  } catch (e) {
    if (e instanceof PayPalError && e.status === 403) return { state: "denied" };
    console.error("check connection failed", e);
    return { state: "offline" };
  }
  const { ok, ...found } = await accountMinimum(admin, own.id);
  if (!found.payments) return { state: "empty" };
  if (!ok) return { state: "little", found };
  const { error } = await admin.from("person").update({ account_id: own.id }).eq("id", personId);
  if (error) throw error;
  return { state: "ready" };
}

/** Log Out of My Sandbox: the link goes, and with it that account's payments, story, memory and chat. The person must be off it first. */
export async function forgetSandbox(admin: SupabaseClient, personId: string) {
  const { error } = await admin.from("paypal_account").delete().eq("kind", "own").eq("owner_id", personId);
  if (error) throw error;
}
