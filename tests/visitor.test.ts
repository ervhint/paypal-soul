// Integration: entry and private copies on Staging (U1: T-1.2, plus the BFF side of T-1.1 and T-1.3).
// Each visitor is a cookie jar like the browser's. Test people are deleted afterwards; the prepared account stays.
import type { CookieMethodsServer } from "@supabase/ssr";
import { afterAll, describe, expect, it } from "vitest";
import { choosePrepared, chooseOwn, currentVisitor, preparedAccountId, secretClient, sessionClient } from "@/lib/supabase";

function browser() {
  const jar = new Map<string, string>();
  const cookies: CookieMethodsServer = {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (all) => all.forEach((c) => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))),
  };
  return { jar, db: () => sessionClient(cookies) }; // a new client per request, as in a route handler
}

const made: string[] = [];
const enter = async (b = browser()) => {
  const id = await choosePrepared(b.db(), null);
  made.push(id);
  return { ...b, id };
};

afterAll(async () => {
  for (const id of new Set(made)) await secretClient().auth.admin.deleteUser(id);
});

describe("entry and private copy", () => {
  it("has no visitor before the first choice", async () => {
    expect(await currentVisitor(browser().db())).toBeNull();
  });

  it("makes an anonymous person on the prepared data, with the session in cookies (T-1.1)", async () => {
    const a = await enter();
    expect(a.jar.size).toBeGreaterThan(0);
    const { data: user } = await secretClient().auth.admin.getUserById(a.id);
    expect(user.user?.is_anonymous).toBe(true);
    const { data: person } = await a.db().from("person").select("account_id").single();
    expect(person?.account_id).toBe(await preparedAccountId());
    expect(await currentVisitor(a.db())).toEqual({ id: a.id, accountId: await preparedAccountId(), source: "prepared", connected: false });
  });

  it("brings the same person back from the same cookies (T-1.3)", async () => {
    const a = await enter();
    expect(await choosePrepared(a.db(), null)).toBe(a.id);
    expect((await currentVisitor(a.db()))?.id).toBe(a.id);
  });

  it("keeps one visitor's change out of another's copy (T-1.2)", async () => {
    const [a, b] = [await enter(), await enter()];
    const account_id = await preparedAccountId();
    const belief = (p: typeof a) => ({ person_id: p.id, account_id, kind: "habit", text: "You buy coffee most mornings.", sureness: "fairly_sure", source: "2 Payments", payment_ids: [crypto.randomUUID()] });
    const { data: mine } = await a.db().from("belief").insert(belief(a)).select("id").single();
    await b.db().from("belief").insert(belief(b));

    await a.db().from("belief").update({ text: "You buy coffee for your mum.", sureness: "sure" }).eq("id", mine!.id);

    const { data: theirs } = await b.db().from("belief").select("text, sureness");
    expect(theirs).toEqual([{ text: "You buy coffee most mornings.", sureness: "fairly_sure" }]);
    const { data: own } = await a.db().from("belief").select("text");
    expect(own).toEqual([{ text: "You buy coffee for your mum." }]);
  });

  it("offers My Sandbox only once one is connected", async () => {
    const a = await enter();
    expect(await chooseOwn(a.db())).toBe(false);
    expect((await currentVisitor(a.db()))?.source).toBe("prepared");
  });
});
