// Live chapters by webhook (U15). PayPal tells Soul when a person approves an order made in Soul
// (CHECKOUT.ORDER.APPROVED) or a capture completes (PAYMENT.CAPTURE.COMPLETED). Soul checks the signature
// with PayPal, then settles that order the same way as when the person comes back: capture once, payment,
// new chapter. So a person who closes the PayPal tab still gets their chapter, and an open story shows it.
// The event only says which order to look at; what happened is always read from PayPal (settle).
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACTION_COLUMNS, settle, type ActionRow } from "@/lib/action";
import type { AskJson } from "@/lib/llm";
import type { Orders } from "@/lib/paypal";
import { must } from "@/lib/story";

/** Checks a notice came from PayPal for our webhook. Gets the raw body, since re-encoding it can break the check. */
export type Verify = (headers: Headers, body: string) => Promise<boolean>;

type Event = { event_type?: string; resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string } } } };

/** The order a notice is about, or null for notices Soul doesn't use. */
export function orderOf(event: Event) {
  if (event.event_type === "CHECKOUT.ORDER.APPROVED") return event.resource?.id ?? null;
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") return event.resource?.supplementary_data?.related_ids?.order_id ?? null;
  return null;
}

/** Settles the waiting action for the notice's order. An order Soul didn't make, or one already settled, changes nothing. */
export async function handleWebhook(admin: SupabaseClient, event: Event, orders: Orders, ask: AskJson) {
  const order = orderOf(event);
  if (!order) return "ignored";
  const found = (await must(admin.from("action").select(ACTION_COLUMNS).eq("paypal_order_id", order).limit(1))) as ActionRow[];
  if (!found.length) return "unknown order";
  return (await settle(admin, found[0], orders, ask)).status;
}

const H = ["auth_algo", "cert_url", "transmission_id", "transmission_sig", "transmission_time"] as const;

/** PayPal's own signature check for the `soul` app's webhook (`PAYPAL_WEBHOOK_ID`). */
export const paypalVerify =
  (webhookId: string, accessToken: () => Promise<string>): Verify =>
  async (headers, body) => {
    const sent = Object.fromEntries(H.map((k) => [k, headers.get(`paypal-${k.replace("_", "-")}`)]));
    if (H.some((k) => !sent[k])) return false;
    // The event goes in as PayPal sent it, byte for byte.
    const payload = `{${H.map((k) => `${JSON.stringify(k)}:${JSON.stringify(sent[k])}`).join(",")},"webhook_id":${JSON.stringify(webhookId)},"webhook_event":${body}}`;
    const r = await fetch("https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature", {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
      body: payload,
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`PayPal signature check returned ${r.status}`);
    return ((await r.json()) as { verification_status?: string }).verification_status === "SUCCESS";
  };
