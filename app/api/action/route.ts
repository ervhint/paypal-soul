import { sendMoney } from "@/lib/mock";

export async function POST(req: Request) {
  const { fail } = await req.json();
  await new Promise((r) => setTimeout(r, 900));
  if (fail) return Response.json({ ok: false, reason: "PayPal's sandbox didn't answer in time." }, { status: 502 });
  return Response.json({ ok: true, id: sendMoney() });
}
