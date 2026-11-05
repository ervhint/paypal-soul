import { deletePerson } from "@/lib/forget";
import { requestDb } from "@/lib/session";
import { secretClient } from "@/lib/supabase";

// Delete My Data: the session cookies go first, then the person with everything Soul keeps for them
// (their own sandbox link and its payments too). The next visit starts as someone new.
export async function DELETE() {
  const db = await requestDb();
  const id = (await db.auth.getClaims()).data?.claims.sub as string | undefined;
  if (id) {
    await db.auth.signOut({ scope: "local" });
    await deletePerson(secretClient(), id);
  }
  return Response.json({ ok: true });
}
