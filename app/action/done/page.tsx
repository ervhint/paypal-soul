"use client";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { money } from "@/components/ui";
import type { Action } from "@/lib/mock";

function Done() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { data, loaded } = useApi<Action | null>(`/api/action?id=${id}`);
  const paid = data?.status === "completed" ? data : null;
  useEffect(() => {
    if (loaded && !paid) router.replace("/story");
  }, [loaded, paid, router]);
  if (!paid) return null;
  const fee = paid.fee ?? 0;
  return (
    <div className="wrap narrow">
      <span className="badge"><i className="fa-solid fa-check" aria-hidden="true" /></span>
      <h1 className="display" style={{ marginTop: 20, fontSize: "clamp(32px, 4.6vw, 54px)" }}>Sent</h1>
      <p className="lead">{paid.title} is paid. I&rsquo;ve added it to your story and I&rsquo;ll remember it.</p>
      <ul className="deal">
        <li><span>To</span><b>{paid.to}</b></li>
        <li><span>You Paid</span><b>{money(paid.amount)}</b></li>
        <li><span>PayPal Fee</span><b>{money(fee)}</b></li>
        <li><span>They Received</span><b className="big">{money(paid.amount - fee)}</b></li>
        <li><span>PayPal Transaction ID</span><b>{paid.txn}</b></li>
      </ul>
      <div className="row" style={{ marginTop: 28 }}>
        <Link className="btn" href="/story">See It in Your Story</Link>
        <Link className="btn dark" href="/memory">What I Remember</Link>
      </div>
    </div>
  );
}

export default function DonePage() {
  return (
    <Suspense>
      <Done />
    </Suspense>
  );
}
