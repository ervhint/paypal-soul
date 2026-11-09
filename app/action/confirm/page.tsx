"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { post, useApi } from "@/lib/use-api";
import { Empty, Receipt, Skeleton } from "@/components/ui";
import { titleCase } from "@/lib/title-case";

type Offer = { belief: string; who: string; amount: number; min: number; max: number; reason: string; testEmail: string | null };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The amount typed, in dollars, when it's a plain amount with at most 2 decimals inside the range; else null. */
const picked = (s: string, o: Offer) => {
  const t = s.trim().replace(/^\$/, "");
  const n = /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : NaN;
  return n >= o.min && n <= o.max ? n : null;
};

function Confirm() {
  const router = useRouter();
  const belief = useSearchParams().get("belief") ?? "";
  const { data, loaded } = useApi<Offer | null>(`/api/action?belief=${encodeURIComponent(belief)}`);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<"test" | "other" | null>(null);
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [sum, setSum] = useState<string | null>(null); // what the person typed; the offer's amount until then
  const [badSum, setBadSum] = useState(false);
  const sumField = useRef<HTMLInputElement>(null);
  // A wrong amount is said by the field, above the button, so the page goes back to it.
  const wrongSum = () => {
    setBadSum(true);
    sumField.current?.focus();
    sumField.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (!loaded)
    return (
      <div className="wrap narrow">
        <Skeleton lines={4} tall />
      </div>
    );
  if (!data)
    return (
      <div className="wrap narrow">
        <Empty icon="paper-plane" title="Nothing to Send Right Now">
          <p>I suggest sending money once you&rsquo;ve told me some payments are for someone else. Nothing moved.</p>
          <div className="row"><Link className="btn" href="/story">Back to My Story</Link></div>
        </Empty>
      </div>
    );

  const who = titleCase(data.who);
  const chosen = pick ?? (data.testEmail ? "test" : "other");
  const typed = sum ?? data.amount.toFixed(2);
  const amount = picked(typed, data);
  const send = async () => {
    const to = chosen === "test" ? "test" : email.trim();
    if (amount === null) return wrongSum();
    if (chosen === "other" && !EMAIL.test(to)) return setInvalid(true);
    setBusy(true);
    const r = await post("/api/action", { kind: "send", belief: data.belief, to, amount: amount.toFixed(2) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) return router.push(`/action/status?id=${j.id}`);
    if (r?.status === 400) return setBusy(false), j.field === "amount" ? wrongSum() : setInvalid(true);
    router.push(`/action/failed?kind=send&belief=${data.belief}&amount=${amount.toFixed(2)}${r?.status === 422 ? "&why=refused" : ""}`);
  };

  return (
    <div className="wrap narrow">
      <Receipt stages={["Check", "Waiting", "Sent"]} now={0} amount={amount ?? 0} title={`Send to ${who}?`}>
        <p className="lead">I suggested this because {data.reason.replace(/^You told me/, "you told me")} Nothing moves until you approve it on PayPal.</p>

        <label className="field-label" htmlFor="amount">How Much?</label>
        <input
          className="field"
          id="amount"
          ref={sumField}
          inputMode="decimal"
          value={typed}
          onChange={(e) => { setSum(e.target.value); setBadSum(false); }}
          aria-invalid={badSum}
          aria-describedby="amount-help"
        />
        <p className={badSum ? "field-error" : "note"} id="amount-help" role={badSum ? "alert" : undefined}>
          {badSum ? `Choose an amount from $${data.min}.00 to $${data.max}.00.` : `From $${data.min}.00 to $${data.max}.00, from your own sandbox account.`}
        </p>

        <span className="field-label" id="to-label">Which Sandbox Account Stands In for {who}?</span>
        <div className="pick" role="radiogroup" aria-labelledby="to-label">
          {data.testEmail && (
            <label>
              <input type="radio" name="to" checked={chosen === "test"} onChange={() => { setPick("test"); setInvalid(false); }} />
              <span>Soul&rsquo;s Test Account<small>{data.testEmail}</small></span>
            </label>
          )}
          <label>
            <input type="radio" name="to" checked={chosen === "other"} onChange={() => setPick("other")} />
            <span>Another Sandbox Email</span>
          </label>
        </div>
        {chosen === "other" && (
          <>
            <input className="field" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setInvalid(false); }} placeholder="name@personal.example.com" aria-label="Recipient's sandbox email" aria-invalid={invalid} aria-describedby={invalid ? "email-error" : undefined} autoFocus={!!data.testEmail} />
            {invalid && <p className="field-error" id="email-error" role="alert">Enter a sandbox email.</p>}
          </>
        )}

        <ul className="deal">
          <li><span>To</span><b>{who}</b></li>
          <li><span>From</span><b>The Sandbox Account You Approve With</b></li>
          <li><span>PayPal Fee</span><b className="plus">Taken from what they receive. I&rsquo;ll show the exact fee once it&rsquo;s paid.</b></li>
        </ul>
        <div className="row" style={{ marginTop: 24 }}>
          <button className="btn" disabled={busy} onClick={send}>{busy ? "Making the Link…" : "Get the PayPal Link"}</button>
          <Link className="btn dark" href="/story">Not Now</Link>
        </div>
      </Receipt>
      <p className="note">Sandbox only. This moves test money between test accounts. A real launch needs PayPal&rsquo;s approval first.</p>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <Confirm />
    </Suspense>
  );
}
