// PayPal sandbox REST for the BFF. Reading goes through the Platform app on behalf of an account that
// gave consent (the prepared buyer too), named in PayPal-Auth-Assertion. Orders and captures (U8) use `soul`.
// A purchase made in Soul shows in the buyer's report rows later with the capture ID as `paypal_reference_id`.
const base = "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** One Transaction Search row, only the fields Soul reads. */
export type PayPalTxn = {
  transaction_info: {
    transaction_id: string;
    transaction_event_code: string;
    transaction_initiation_date: string;
    transaction_amount: { value: string; currency_code: string };
    transaction_status?: string;
    transaction_subject?: string;
    transaction_note?: string;
    paypal_reference_id?: string;
    paypal_reference_id_type?: string;
  };
  payer_info?: { payer_name?: { alternate_full_name?: string } };
  cart_info?: { item_details?: { item_name?: string }[] };
};

export type Page = { rows: PayPalTxn[]; lastRefreshed: string };

// Tokens last hours; one per app is kept until a minute before it expires.
const tokens = new Map<string, { value: string; until: number }>();

async function token(id: string, secret: string) {
  const kept = tokens.get(id);
  if (kept && kept.until > Date.now()) return kept.value;
  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!r.ok) throw new PayPalError(r.status, "PayPal sign-in failed");
  const j = (await r.json()) as { access_token: string; expires_in: number };
  tokens.set(id, { value: j.access_token, until: Date.now() + (j.expires_in - 60) * 1000 });
  return j.access_token;
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const iso = (d: Date) => `${d.toISOString().slice(0, 19)}Z`;

/** Reads one window (31 days or less) of an account's rows, all pages. */
export async function readTransactions(payerId: string, start: Date, end: Date): Promise<Page> {
  const id = process.env.PAYPAL_PLATFORM_CLIENT_ID!;
  const headers = {
    Authorization: `Bearer ${await token(id, process.env.PAYPAL_PLATFORM_CLIENT_SECRET!)}`,
    "PayPal-Auth-Assertion": `${b64({ alg: "none" })}.${b64({ iss: id, payer_id: payerId })}.`,
  };
  const rows: PayPalTxn[] = [];
  let lastRefreshed = iso(end);
  for (let page = 1, pages = 1; page <= pages; page++) {
    const q = new URLSearchParams({ start_date: iso(start), end_date: iso(end), fields: "all", page_size: "500", page: String(page) });
    const r = await fetch(`${base}/v1/reporting/transactions?${q}`, { headers, cache: "no-store" });
    if (!r.ok) throw new PayPalError(r.status, `PayPal transaction search returned ${r.status}`);
    const j = (await r.json()) as { transaction_details?: PayPalTxn[]; total_pages?: number; last_refreshed_datetime?: string };
    rows.push(...(j.transaction_details ?? []));
    pages = j.total_pages ?? 1;
    if (j.last_refreshed_datetime) lastRefreshed = j.last_refreshed_datetime;
  }
  return { rows, lastRefreshed };
}

/** An order as Soul reads it: its status and, once paid, the capture. */
export type PayPalOrder = {
  id: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  purchase_units?: {
    payments?: {
      captures?: { id: string; status: string; create_time: string; amount: { value: string; currency_code: string }; seller_receivable_breakdown?: { paypal_fee?: { value: string } } }[];
    };
  }[];
};
export type NewOrder = { requestId: string; amount: string; currency: string; name: string; customId: string; returnUrl: string; cancelUrl: string };
export type Orders = {
  create: (o: NewOrder) => Promise<{ id: string; link: string }>;
  /** null when PayPal no longer knows the order, so its link has run out. */
  get: (id: string) => Promise<PayPalOrder | null>;
  /** Captures an approved order. PayPal-Request-Id makes a repeat return the same capture. */
  capture: (id: string, requestId: string) => Promise<PayPalOrder>;
};

/** The approval page for an order, the same link PayPal returns when the order is made. */
export const approveLink = (orderId: string) => `https://www.sandbox.paypal.com/checkoutnow?token=${encodeURIComponent(orderId)}`;

const soulHeaders = async (extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${await token(process.env.PAYPAL_CLIENT_ID!, process.env.PAYPAL_CLIENT_SECRET!)}`,
  "Content-Type": "application/json",
  ...extra,
});

/** Orders through the `soul` app, paid to its sandbox business account (Test Store). */
export const paypalOrders: Orders = {
  create: async (o) => {
    const r = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: await soulHeaders({ "PayPal-Request-Id": o.requestId }),
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: o.customId,
            description: o.name,
            amount: { currency_code: o.currency, value: o.amount, breakdown: { item_total: { currency_code: o.currency, value: o.amount } } },
            items: [{ name: o.name, quantity: "1", unit_amount: { currency_code: o.currency, value: o.amount } }],
          },
        ],
        payment_source: {
          paypal: { experience_context: { brand_name: "Soul", user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", return_url: o.returnUrl, cancel_url: o.cancelUrl } },
        },
      }),
      cache: "no-store",
    });
    if (!r.ok) throw new PayPalError(r.status, `PayPal order returned ${r.status}`);
    const j = (await r.json()) as { id: string; links?: { rel: string; href: string }[] };
    return { id: j.id, link: j.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href ?? approveLink(j.id) };
  },
  get: async (id) => {
    const r = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(id)}`, { headers: await soulHeaders(), cache: "no-store" });
    if (r.status === 404) return null;
    if (!r.ok) throw new PayPalError(r.status, `PayPal order lookup returned ${r.status}`);
    return (await r.json()) as PayPalOrder;
  },
  capture: async (id, requestId) => {
    const r = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {
      method: "POST",
      headers: await soulHeaders({ "PayPal-Request-Id": requestId, Prefer: "return=representation" }),
      cache: "no-store",
    });
    if (r.ok) return (await r.json()) as PayPalOrder;
    // Captured already, by another tab or the daily job: read the capture from the order.
    const j = (await r.json().catch(() => ({}))) as { details?: { issue?: string }[] };
    if (r.status === 422 && j.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED")) {
      const o = await paypalOrders.get(id);
      if (o) return o;
    }
    throw new PayPalError(r.status, `PayPal capture returned ${r.status}${j.details?.[0]?.issue ? ` ${j.details[0].issue}` : ""}`);
  },
};
