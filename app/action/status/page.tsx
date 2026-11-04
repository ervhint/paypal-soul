"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { Empty, Receipt, Skeleton, Toast, useToast } from "@/components/ui";
import { titleCase } from "@/lib/title-case";
import type { Action } from "@/lib/action";

const small = { fontSize: 13.5 };

function Status() {
  const params = useSearchParams();
  const id = params.get("id");
  const router = useRouter();
  const toast = useToast();
  // PayPal sends the person back here: paid (Soul captures it now) or from its cancel link.
  const url = `/api/action?id=${id}${params.get("cancelled") === "1" ? "&cancelled=1" : ""}`;
  const { data, setData, loaded } = useApi<Action | null>(url);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (data?.status === "completed") router.replace(data.kind === "send" ? `/action/done?id=${data.id}` : "/story");
    if (data?.status === "failed") router.replace(`/action/failed?kind=${data.kind}`);
  }, [data, router]);

  // The prototype's send money until U9.
  const settle = async (outcome: "completed" | "cancelled" | "expired") => {
    const r = await fetch("/api/action", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, outcome }) });
    setData(await r.json());
  };
  const check = async () => {
    setChecking(true);
    const a: Action | null = await fetch(`/api/action?id=${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => data);
    setChecking(false);
    setData(a);
    if (a?.status === "waiting") toast.show("Not Paid Yet");
  };

  // Back from paying (PayPal adds PayerID): capturing and writing the chapter takes a few seconds.
  const adding = (!loaded && params.has("PayerID")) || data?.status === "completed";
  if (!loaded || data?.status === "completed")
    return (
      <div className="wrap narrow">
        {adding && <p className="eyebrow syncing" role="status">Adding It to Your Story Now…</p>}
        <Skeleton lines={4} tall />
      </div>
    );
  if (!data)
    return (
      <div className="wrap narrow">
        <Empty icon="receipt" title="I Can&rsquo;t Find That Payment">
          <p>The link may be old. Nothing moved because of it.</p>
          <div className="row"><Link className="btn" href="/story">Back to My Story</Link></div>
        </Empty>
      </div>
    );

  const stages = (middle: string) => ["Check", middle, data.kind === "send" ? "Sent" : "Added"];
  const what = data.title.replace(/^\S+ /, "");

  if (data.status === "cancelled" || data.status === "expired")
    return (
      <div className="wrap narrow">
        <Receipt stages={stages(data.status === "cancelled" ? "Cancelled" : "Link Ran Out")} now={1} bad amount={data.amount} title={data.status === "cancelled" ? "Cancelled on PayPal" : "That Link Has Run Out"}>
          <p className="lead">{data.title} wasn&rsquo;t paid. Nothing moved, and your story hasn&rsquo;t changed.</p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link className="btn" href={data.kind === "buy" ? "/buy" : "/action/confirm"}>Start Again</Link>
            <Link className="btn dark" href="/story">Back to My Story</Link>
          </div>
        </Receipt>
      </div>
    );

  if (data.status !== "waiting") return null;
  return (
    <div className="wrap narrow">
      <Receipt stages={stages("Waiting")} now={1} amount={data.amount} title={titleCase(what)}>
        <p className="lead">Pay on PayPal with your own sandbox login, not your real PayPal login. You don&rsquo;t have to wait here: I&rsquo;ll add it to your story once it&rsquo;s paid.</p>
        <ul className="deal">
          <li><span>To</span><b>{data.to}</b></li>
        </ul>
        <div className="row" style={{ marginTop: 24 }}>
          {data.link && (
            <a className="btn paypal" href={data.link}>
              <i className="fa-brands fa-paypal" aria-hidden="true" /> Open PayPal <span className="sbx">Sandbox</span>
            </a>
          )}
          <button className="btn dark" disabled={checking} onClick={check}>{checking ? "Checking With PayPal…" : <>I&rsquo;ve Paid, Check Now</>}</button>
          <Link className="btn dark" href="/story">Keep Reading My Story</Link>
        </div>
      </Receipt>
      <p className="note">No sandbox login? Nothing moves, and you can keep reading and correcting your story.</p>
      {data.kind === "send" && <p className="note">
        Prototype, what PayPal could report:{" "}
        <button className="link" style={small} onClick={() => settle("completed")}>Paid</button>{" · "}
        <button className="link" style={small} onClick={() => settle("cancelled")}>Cancelled</button>{" · "}
        <button className="link" style={small} onClick={() => settle("expired")}>Link Ran Out</button>
      </p>}
      <Toast text={toast.text} />
    </div>
  );
}

export default function StatusPage() {
  return (
    <Suspense>
      <Status />
    </Suspense>
  );
}
