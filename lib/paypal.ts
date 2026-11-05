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

const platformToken = () => token(process.env.PAYPAL_PLATFORM_CLIENT_ID!, process.env.PAYPAL_PLATFORM_CLIENT_SECRET!);

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const iso = (d: Date) => `${d.toISOString().slice(0, 19)}Z`;

/** Reads one window (31 days or less) of an account's rows, all pages. */
export async function readTransactions(payerId: string, start: Date, end: Date): Promise<Page> {
  const id = process.env.PAYPAL_PLATFORM_CLIENT_ID!;
  const headers = {
    Authorization: `Bearer ${await platformToken()}`,
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

/** Consent through the Platform app (U10): a link to PayPal's page, and what PayPal says came of it. */
export type Consent = {
  link: (trackingId: string, returnUrl: string) => Promise<string>;
  /** null until the person has approved on PayPal. `canRead` says the approval covers reading payments. */
  find: (trackingId: string) => Promise<{ payerId: string; canRead: boolean } | null>;
};

const SEARCH_SCOPE = "https://uri.paypal.com/services/reporting/search/read";
let partner: string | undefined;

/** The Platform app's own PayPal account ID, which its report states, so it needs no setting of its own. */
async function partnerId(headers: Record<string, string>) {
  if (partner) return partner;
  const now = new Date();
  const q = new URLSearchParams({ start_date: iso(new Date(+now - 86_400_000)), end_date: iso(now), page_size: "1" });
  const r = await fetch(`${base}/v1/reporting/transactions?${q}`, { headers, cache: "no-store" });
  if (!r.ok) throw new PayPalError(r.status, `PayPal partner lookup returned ${r.status}`);
  partner = ((await r.json()) as { account_number: string }).account_number;
  return partner;
}

export const paypalConsent: Consent = {
  link: async (trackingId, returnUrl) => {
    const r = await fetch(`${base}/v2/customer/partner-referrals`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await platformToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tracking_id: trackingId,
        partner_config_override: { return_url: returnUrl, return_url_description: "Return to Soul" },
        operations: [
          {
            operation: "API_INTEGRATION",
            api_integration_preference: {
              rest_api_integration: { integration_method: "PAYPAL", integration_type: "THIRD_PARTY", third_party_details: { features: ["ADVANCED_TRANSACTIONS_SEARCH", "ACCESS_MERCHANT_INFORMATION"] } },
            },
          },
        ],
        legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
      }),
      cache: "no-store",
    });
    if (!r.ok) throw new PayPalError(r.status, `PayPal referral returned ${r.status}`);
    const link = ((await r.json()) as { links?: { rel: string; href: string }[] }).links?.find((l) => l.rel === "action_url")?.href;
    if (!link) throw new PayPalError(502, "PayPal referral came back without a link");
    return link;
  },
  find: async (trackingId) => {
    const headers = { Authorization: `Bearer ${await platformToken()}` };
    const path = `${base}/v1/customer/partners/${await partnerId(headers)}/merchant-integrations`;
    const r = await fetch(`${path}?tracking_id=${encodeURIComponent(trackingId)}`, { headers, cache: "no-store" });
    if (r.status === 404) return null;
    if (!r.ok) throw new PayPalError(r.status, `PayPal consent lookup returned ${r.status}`);
    const payerId = ((await r.json()) as { merchant_id?: string }).merchant_id;
    if (!payerId) return null;
    const d = await fetch(`${path}/${encodeURIComponent(payerId)}`, { headers, cache: "no-store" });
    if (!d.ok) throw new PayPalError(d.status, `PayPal consent details returned ${d.status}`);
    const { oauth_integrations } = (await d.json()) as { oauth_integrations?: { oauth_third_party?: { partner_client_id?: string; scopes?: string[] }[] }[] };
    const grants = (oauth_integrations ?? []).flatMap((o) => o.oauth_third_party ?? []);
    return { payerId, canRead: grants.some((g) => g.partner_client_id === process.env.PAYPAL_PLATFORM_CLIENT_ID && g.scopes?.includes(SEARCH_SCOPE)) };
  },
};

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
/** `payeeEmail` pays that sandbox account (send money, U9); without it the order pays `soul`'s business account. */
export type NewOrder = { requestId: string; amount: string; currency: string; name: string; customId: string; returnUrl: string; cancelUrl: string; payeeEmail?: string };
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

/** Orders through the `soul` app, paid to its sandbox business account (Test Store) or to a payee's email. */
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
            ...(o.payeeEmail ? { payee: { email_address: o.payeeEmail } } : {}),
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
