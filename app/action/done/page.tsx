"use client";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { Receipt, money } from "@/components/ui";
import { titleCase } from "@/lib/title-case";
import type { Action } from "@/lib/action";

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
      <Receipt stages={["Check", "Waiting", "Sent"]} now={2} amount={paid.amount} title={titleCase(`sent ${paid.title.replace(/^\S+ /, "")}`)}>
        <p className="lead">It&rsquo;s paid. I&rsquo;ve added it to your story and I&rsquo;ll remember it.</p>
        <ul className="deal">
          <li><span>To</span><b>{paid.to}</b></li>
          <li><span>PayPal Fee</span><b>{money(fee)}</b></li>
          <li><span>They Received</span><b>{money(paid.amount - fee)}</b></li>
          <li><span>PayPal Transaction ID</span><b>{paid.txn}</b></li>
        </ul>
        <div className="row" style={{ marginTop: 24 }}>
          <Link className="btn" href="/story">See It in Your Story</Link>
          <Link className="btn dark" href="/memory">What I Remember</Link>
        </div>
      </Receipt>
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
