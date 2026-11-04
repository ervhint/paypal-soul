import { settleWaiting } from "@/lib/action";
import { askJson } from "@/lib/llm";
import { paypalOrders } from "@/lib/paypal";
import { secretClient } from "@/lib/supabase";

// The daily job. Vercel Cron calls it with `Authorization: Bearer CRON_SECRET`; on localhost it's called by
// hand. U8: captures approved orders nobody came back for. U11 adds the import, 30-day cleanup and keep-awake.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false }, { status: 401 });
  const actions = await settleWaiting(secretClient(), paypalOrders, askJson);
  return Response.json({ ok: true, actions });
}
