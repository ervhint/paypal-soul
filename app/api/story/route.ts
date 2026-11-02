import { db, snapshot } from "@/lib/mock";

export async function GET() {
  await new Promise((r) => setTimeout(r, 350));
  return Response.json(snapshot());
}

export function DELETE() {
  db().change = null;
  return Response.json({ ok: true });
}
