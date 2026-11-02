"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useApi } from "@/lib/use-api";
import type { Payment } from "@/lib/mock";

function Done() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { data } = useApi<{ payments: Payment[]; who: string }>("/api/story");
  const sent = data?.payments.some((p) => p.id === "P-1048");
  useEffect(() => {
    if (data && !sent) router.replace("/story");
  }, [data, sent, router]);
  if (!sent) return null;
  return (
    <div className="wrap narrow">
      <span className="badge"><i className="fa-solid fa-check" aria-hidden="true" /></span>
      <h1 className="display" style={{ marginTop: 20, fontSize: "clamp(32px, 4.6vw, 54px)" }}>Sent</h1>
      <p className="lead">$25.00 went to {data?.who} (sandbox personal account). I&rsquo;ve added it to your story and I&rsquo;ll remember it.</p>
      <ul className="deal">
        <li><span>Amount</span><b>$25.00</b></li>
        <li><span>Sandbox payout</span><b>{id ?? "SBX-PO-48213"}</b></li>
      </ul>
      <div className="row" style={{ marginTop: 28 }}>
        <Link className="btn" href="/story">See it in your story</Link>
        <Link className="btn dark" href="/memory">What I remember</Link>
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
