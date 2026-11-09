// Live chapters by webhook (U15). Unit: which order a notice is about, and PayPal's signature check sent
// the event byte for byte (fetch mocked). Integration on Staging with a fake PayPal (T-15.1): a notice for an
// approved Soul order captures it once and writes the new chapter the open story then reads.
import type { CookieMethodsServer } from "@supabase/ssr";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createPurchase } from "@/lib/action";
import type { AskJson } from "@/lib/llm";
import type { Orders, PayPalOrder } from "@/lib/paypal";
import { readStory } from "@/lib/story";
import { choosePrepared, preparedAccountId, secretClient, sessionClient } from "@/lib/supabase";
import { handleWebhook, orderOf, paypalVerify } from "@/lib/webhook";

const approved = (id: string) => ({ event_type: "CHECKOUT.ORDER.APPROVED", resource: { id } });
const captured = (order: string) => ({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAP", supplementary_data: { related_ids: { order_id: order } } } });

describe("which order a notice is about", () => {
  it("reads approvals and completed captures, and ignores the rest", () => {
    expect(orderOf(approved("O1"))).toBe("O1");
    expect(orderOf(captured("O2"))).toBe("O2");
    expect(orderOf({ event_type: "PAYMENT.CAPTURE.REFUNDED", resource: { id: "X" } })).toBeNull();
    expect(orderOf({})).toBeNull();
  });
});

const signed = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT",
  "paypal-transmission-id": "T1",
  "paypal-transmission-sig": "SIG",
  "paypal-transmission-time": "2026-11-09T10:00:00Z",
};

describe("the signature check", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks PayPal with the event exactly as sent, and trusts only SUCCESS", async () => {
    const sent: string[] = [];
    let answer = "SUCCESS";
    vi.stubGlobal("fetch", async (_: string, init: RequestInit) => (sent.push(init.body as string), Response.json({ verification_status: answer })));
    const verify = paypalVerify("WH-1", async () => "token");
    const body = '{"event_type":"CHECKOUT.ORDER.APPROVED",  "resource":{"id":"O1","amount":"18.00"}}'; // odd spacing kept
    expect(await verify(new Headers(signed), body)).toBe(true);
    expect(sent[0]).toContain(`"webhook_event":${body}}`);
    expect(JSON.parse(sent[0])).toMatchObject({ auth_algo: "SHA256withRSA", transmission_id: "T1", transmission_sig: "SIG", webhook_id: "WH-1" });
    answer = "FAILURE";
    expect(await verify(new Headers(signed), body)).toBe(false);
  });

  it("refuses a notice with no signature headers without asking PayPal", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    expect(await paypalVerify("WH-1", async () => "token")(new Headers({ "paypal-transmission-id": "T1" }), "{}")).toBe(false);
    expect(fetched).not.toHaveBeenCalled();
  });
});

describe("the webhook route", () => {
  afterEach(() => (vi.unstubAllGlobals(), vi.unstubAllEnvs()));

  it("is off without PAYPAL_WEBHOOK_ID, and a signature PayPal doesn't confirm changes nothing", async () => {
    const { POST } = await import("@/app/api/paypal-webhook/route");
    const req = () => new Request("http://localhost/api/paypal-webhook", { method: "POST", headers: signed, body: JSON.stringify(approved("NOT-SOUL")) });
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "");
    expect((await POST(req())).status).toBe(404);
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-1");
    vi.stubGlobal("fetch", async (url: string) =>
      url.endsWith("/oauth2/token") ? Response.json({ access_token: "t", expires_in: 3600 }) : Response.json({ verification_status: "FAILURE" }),
    );
    expect((await POST(req())).status).toBe(400);
  });
});

// A fake PayPal: the test approves orders, and each capture call is counted.
function fakePayPal() {
  const orders = new Map<string, PayPalOrder>();
  const calls = { capture: 0 };
  let i = 0;
  const api: Orders = {
    create: async () => {
      const id = `TEST-WEBHOOK-${Date.now()}-${++i}`;
      orders.set(id, { id, status: "CREATED" });
      return { id, link: "" };
    },
    get: async (id) => orders.get(id) ?? null,
    capture: async (id) => {
      calls.capture++;
      orders.set(id, {
        id,
        status: "COMPLETED",
        purchase_units: [{ payments: { captures: [{ id: `CAP-${id}`, status: "COMPLETED", create_time: new Date().toISOString(), amount: { value: "18.00", currency_code: "USD" } }] } }],
      });
      return orders.get(id)!;
    },
  };
  return { api, calls, approve: (id: string) => orders.set(id, { id, status: "APPROVED" }) };
}

function browser() {
  const jar = new Map<string, string>();
  const cookies: CookieMethodsServer = {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (all) => all.forEach((c) => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))),
  };
  return () => sessionClient(cookies);
}

const made: string[] = [];
afterAll(async () => {
  for (const id of made) await secretClient().auth.admin.deleteUser(id); // their actions, purchases and chapters go with them
});

const ask: AskJson = async (purpose) => {
  if (purpose !== "new chapter") throw new Error("no LLM in this test");
  return JSON.stringify({ title: "Straight From PayPal", claims: [{ text: "You paid $18.00 for Weekend market groceries." }] });
};

describe("a notice for an order made in Soul (T-15.1)", () => {
  it("captures it once and the story then has the new chapter, without the person coming back", async () => {
    const admin = secretClient();
    const paypal = fakePayPal();
    const db = browser();
    const id = await choosePrepared(db(), null);
    made.push(id);
    const account = await preparedAccountId();
    const a = await createPurchase(admin, id, account, "http://localhost:3000", paypal.api);

    expect(await handleWebhook(admin, approved(a.paypal_order_id!), paypal.api, ask)).toBe("waiting"); // not approved at PayPal: the notice alone changes nothing
    paypal.approve(a.paypal_order_id!);
    expect(await handleWebhook(admin, approved(a.paypal_order_id!), paypal.api, ask)).toBe("completed");
    // PayPal then says the capture completed, and may send a notice twice: nothing more happens.
    expect(await handleWebhook(admin, captured(a.paypal_order_id!), paypal.api, ask)).toBe("completed");
    expect(await handleWebhook(admin, approved(a.paypal_order_id!), paypal.api, ask)).toBe("completed");
    expect(paypal.calls.capture).toBe(1);

    const story = await readStory(db(), account); // what GET /api/story reads for the open page
    expect(story.chapters[0]).toMatchObject({ title: "Straight From PayPal", fresh: true });
    const { data: chapters } = await db().from("chapter").select("id").is("week", null);
    expect(chapters).toHaveLength(1);
  });

  it("leaves an order Soul didn't make, and other notices, alone", async () => {
    const paypal = fakePayPal();
    expect(await handleWebhook(secretClient(), approved("NOT-A-SOUL-ORDER"), paypal.api, ask)).toBe("unknown order");
    expect(await handleWebhook(secretClient(), { event_type: "BILLING.SUBSCRIPTION.CREATED", resource: { id: "I-1" } }, paypal.api, ask)).toBe("ignored");
    expect(paypal.calls.capture).toBe(0);
  });
});
