import { askJson } from "@/lib/llm";
import { paypalOrders, soulToken } from "@/lib/paypal";
import { secretClient } from "@/lib/supabase";
import { handleWebhook, paypalVerify } from "@/lib/webhook";

// PayPal's notices for the `soul` app (U15). Off until PAYPAL_WEBHOOK_ID is set (the webhook is made on the
// app for the deployed URL in P7, since PayPal can't reach localhost). A notice whose signature PayPal
// doesn't confirm changes nothing. A failure answers 500, so PayPal sends it again later.
export async function POST(req: Request) {
  const id = process.env.PAYPAL_WEBHOOK_ID;
  if (!id) return Response.json({ ok: false }, { status: 404 });
  const body = await req.text();
  try {
    if (!(await paypalVerify(id, soulToken)(req.headers, body))) return Response.json({ ok: false }, { status: 400 });
    const result = await handleWebhook(secretClient(), JSON.parse(body), paypalOrders, askJson);
    return Response.json({ ok: true, result });
  } catch (e) {
    console.error("webhook failed", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
