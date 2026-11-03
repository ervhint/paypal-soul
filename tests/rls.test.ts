// Integration: RLS on Staging (NF-4, T-0.4). Two anonymous test people, A and B, cleaned up afterwards.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, opts);
const visitor = () => createClient(url, process.env.SUPABASE_ANON_KEY!, opts);

type Person = { c: SupabaseClient; id: string };
let a: Person, b: Person;
const ids: Record<string, string> = {};

const must = async <T>(q: PromiseLike<{ data: T; error: unknown }>) => {
  const { data, error } = await q;
  if (error) throw error;
  return data as NonNullable<T>;
};

async function signIn(): Promise<Person> {
  const c = visitor();
  const data = await must(c.auth.signInAnonymously());
  return { c, id: data.user!.id };
}

// Every table with one row of A's in it, and the column that finds it.
const tables = () => [
  ["paypal_account", "id", ids.account],
  ["payment", "id", ids.payment],
  ["left_out_row", "id", ids.leftOut],
  ["person", "id", a.id],
  ["belief", "id", ids.belief],
  ["chapter", "id", ids.chapter],
  ["claim", "id", ids.claim],
  ["correction", "id", ids.correction],
  ["chat_message", "id", ids.chat],
  ["action", "id", ids.action],
] as const;

const rows = async (c: SupabaseClient, table: string, col: string, val: string) => {
  const { data } = await c.from(table).select("*").eq(col, val);
  return data ?? [];
};

beforeAll(async () => {
  [a, b] = [await signIn(), await signIn()];
  const accounts = await must(
    admin
      .from("paypal_account")
      .insert([
        { kind: "own", paypal_account_id: "TEST-A", owner_id: a.id },
        { kind: "own", paypal_account_id: "TEST-B", owner_id: b.id },
      ])
      .select("id, owner_id"),
  );
  ids.account = accounts.find((x) => x.owner_id === a.id)!.id;
  const accountB = accounts.find((x) => x.owner_id === b.id)!.id;
  await must(a.c.from("person").insert({ id: a.id, account_id: ids.account }));
  await must(b.c.from("person").insert({ id: b.id, account_id: accountB }));

  const base = { account_id: ids.account, occurred_at: new Date().toISOString(), currency: "USD" };
  ids.payment = (await must(admin.from("payment").insert({ ...base, paypal_txn_id: "TEST-TXN", amount: 4.2, event_code: "T0002", name: "Morning coffee" }).select("id").single())).id;
  ids.leftOut = (await must(admin.from("left_out_row").insert({ ...base, paypal_txn_id: "TEST-T1900", amount: 5000, event_code: "T1900", reason: "Opening test balance" }).select("id").single())).id;

  const mine = { person_id: a.id, account_id: ids.account };
  const evidence = [ids.payment];
  ids.belief = (await must(a.c.from("belief").insert({ ...mine, kind: "habit", text: "You buy coffee.", sureness: "not_sure", source: "1 Payment", payment_ids: evidence }).select("id").single())).id;
  ids.chapter = (await must(a.c.from("chapter").insert({ ...mine, title: "Test", starts_on: "2026-11-01", ends_on: "2026-11-03" }).select("id").single())).id;
  ids.claim = (await must(a.c.from("claim").insert({ person_id: a.id, chapter_id: ids.chapter, position: 0, text: "Coffee.", payment_ids: evidence, belief_id: ids.belief }).select("id").single())).id;
  ids.correction = (await must(a.c.from("correction").insert({ ...mine, belief_id: ids.belief, claim_id: ids.claim, said: "It's for my mum" }).select("id").single())).id;
  ids.chat = (await must(a.c.from("chat_message").insert({ ...mine, role: "user", text: "Coffee?" }).select("id").single())).id;
  ids.action = (await must(admin.from("action").insert({ ...mine, kind: "send", recipient: "test@example.com", amount: 1, currency: "USD" }).select("id").single())).id;
});

afterAll(async () => {
  // Deleting the auth users cascades to their person, own accounts and every personal row.
  for (const p of [a, b]) if (p) await admin.auth.admin.deleteUser(p.id);
});

describe("RLS on Staging", () => {
  it("is on for every table: A sees each of A's rows", async () => {
    for (const [t, col, val] of tables()) expect(await rows(a.c, t, col, val), t).toHaveLength(1);
  });

  it("gives a visitor without a session nothing", async () => {
    const v = visitor();
    for (const [t, col, val] of tables()) expect(await rows(v, t, col, val), t).toHaveLength(0);
  });

  it("stops B from reading A's rows", async () => {
    for (const [t, col, val] of tables()) expect(await rows(b.c, t, col, val), t).toHaveLength(0);
  });

  it("stops B from changing or deleting A's rows", async () => {
    for (const [t, col, val] of tables()) {
      const { data: updated } = await b.c.from(t).update({ [col]: val }).eq(col, val).select();
      const { data: deleted } = await b.c.from(t).delete().eq(col, val).select();
      expect(updated ?? [], t).toHaveLength(0);
      expect(deleted ?? [], t).toHaveLength(0);
    }
    expect(await rows(a.c, "chat_message", "id", ids.chat)).toHaveLength(1);
  });

  it("stops B from writing rows as A", async () => {
    const { error } = await b.c.from("chat_message").insert({ person_id: a.id, account_id: ids.account, role: "user", text: "x" });
    expect(error).not.toBeNull();
  });

  it("keeps shared tables and actions server-only, even for their owner", async () => {
    const { error: payment } = await a.c.from("payment").insert({ account_id: ids.account, paypal_txn_id: "X", occurred_at: new Date().toISOString(), amount: 1, currency: "USD", event_code: "T0002" });
    const { error: account } = await a.c.from("paypal_account").insert({ kind: "own", paypal_account_id: "X", owner_id: a.id });
    const { data: action } = await a.c.from("action").update({ status: "completed" }).eq("id", ids.action).select();
    expect(payment).not.toBeNull();
    expect(account).not.toBeNull();
    expect(action ?? []).toHaveLength(0);
  });
});
