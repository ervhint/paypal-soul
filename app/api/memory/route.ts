import { db } from "@/lib/mock";

export const GET = () => Response.json(db().memory);

export async function PATCH(req: Request) {
  const { id, text, active } = await req.json();
  const m = db().memory.find((m) => m.id === id);
  if (!m) return Response.json({ error: "not found" }, { status: 404 });
  if (typeof text === "string" && text.trim()) Object.assign(m, { text: text.trim(), sure: "Sure", source: "You told me, Nov 2" });
  if (typeof active === "boolean") m.active = active;
  return Response.json(db().memory);
}
