// PayPal sandbox REST for the BFF. Reading goes through the Platform app on behalf of an account that
// gave consent (the prepared buyer too), named in PayPal-Auth-Assertion. Orders and captures (U8) use `soul`.
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
