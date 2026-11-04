"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { post, useApi } from "@/lib/use-api";
import { Empty, Receipt, Skeleton } from "@/components/ui";
import { titleCase } from "@/lib/title-case";

type Offer = { belief: string; who: string; amount: number; reason: string; testEmail: string | null };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Confirm() {
  const router = useRouter();
  const belief = useSearchParams().get("belief") ?? "";
  const { data, loaded } = useApi<Offer | null>(`/api/action?belief=${encodeURIComponent(belief)}`);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<"test" | "other" | null>(null);
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);

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
  const send = async () => {
    const to = chosen === "test" ? "test" : email.trim();
    if (chosen === "other" && !EMAIL.test(to)) return setInvalid(true);
    setBusy(true);
    const r = await post("/api/action", { kind: "send", belief: data.belief, to }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) return router.push(`/action/status?id=${j.id}`);
    if (r?.status === 400) return setBusy(false), setInvalid(true);
    router.push(`/action/failed?kind=send&belief=${data.belief}${r?.status === 422 ? "&why=refused" : ""}`);
  };

  return (
    <div className="wrap narrow">
      <Receipt stages={["Check", "Waiting", "Sent"]} now={0} amount={data.amount} title={`Send to ${who}?`}>
        <p className="lead">I suggested this because {data.reason.replace(/^You told me/, "you told me")} Nothing moves until you approve it on PayPal.</p>

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
