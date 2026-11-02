import { purchase } from "@/lib/mock";

export async function POST() {
  await new Promise((r) => setTimeout(r, 400));
  purchase();
  return Response.json({ ok: true });
}
