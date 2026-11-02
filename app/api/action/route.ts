import { createAction, db, settleAction } from "@/lib/mock";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return Response.json(db().actions.find((a) => a.id === id) ?? null);
}

export async function POST(req: Request) {
  const { kind, to, fail } = await req.json();
  await new Promise((r) => setTimeout(r, 700));
  if (fail) return Response.json({ ok: false, reason: "PayPal's sandbox didn't answer in time." }, { status: 502 });
  return Response.json({ ok: true, id: createAction(kind, to).id });
}

export async function PATCH(req: Request) {
  const { id, outcome } = await req.json();
  return Response.json(settleAction(id, outcome) ?? null);
}
