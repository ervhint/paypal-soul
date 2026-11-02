"use client";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { Skeleton, Toast, useToast } from "@/components/ui";
import { titleCase } from "@/lib/title-case";
import type { Action } from "@/lib/mock";

const title = { marginTop: 20, fontSize: "clamp(32px, 4.6vw, 54px)" };

function Status() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const toast = useToast();
  const { data, setData, reload } = useApi<Action | null>(`/api/action?id=${id}`);
  const retry = data?.kind === "buy" ? "/buy" : "/action/confirm";

  useEffect(() => {
    if (data?.status === "completed") router.replace(data.kind === "send" ? `/action/done?id=${data.id}` : "/story");
  }, [data, router]);

  const settle = async (outcome: "completed" | "cancelled" | "expired") => {
    const r = await fetch("/api/action", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, outcome }) });
    setData(await r.json());
  };
  const check = async () => {
    await reload(); // P6: Soul completes the order here if PayPal says it's approved
    toast.show("Not Paid Yet");
  };

  if (!data) return <div className="wrap narrow"><Skeleton lines={4} tall /></div>;

  if (data.status === "cancelled" || data.status === "expired")
    return (
      <div className="wrap narrow">
        <span className="badge bad"><i className="fa-solid fa-xmark" aria-hidden="true" /></span>
        <h1 className="display" style={title}>{data.status === "cancelled" ? "Cancelled on PayPal" : "That Link Has Run Out"}</h1>
        <p className="lead">{data.title} wasn&rsquo;t paid. Nothing moved, and your story hasn&rsquo;t changed.</p>
        <div className="row" style={{ marginTop: 28 }}>
          <Link className="btn" href={retry}>Start Again</Link>
          <Link className="btn dark" href="/story">Back to My Story</Link>
        </div>
      </div>
    );

  if (data.status !== "waiting") return null;
  return (
    <div className="wrap narrow">
      <p className="eyebrow"><span className="tag plain">Waiting on PayPal</span></p>
      <h1 className="display" style={{ ...title, marginTop: 12 }}>Approve {titleCase(data.title)}</h1>
      <p className="lead">Pay on PayPal with your own sandbox login, not your real PayPal login. You don&rsquo;t have to wait here: I&rsquo;ll add it to your story once it&rsquo;s paid.</p>
      <ul className="deal">
        <li><span>To</span><b>{data.to}</b></li>
        <li><span>Amount</span><b className="big">${data.amount.toFixed(2)}</b></li>
      </ul>
      <div className="row" style={{ marginTop: 28 }}>
        <a className="btn paypal" href="#paypal" onClick={(e) => e.preventDefault()}>
          <i className="fa-brands fa-paypal" aria-hidden="true" /> Open PayPal <span className="sbx">Sandbox</span>
        </a>
        <button className="btn dark" onClick={check}>I&rsquo;ve Paid, Check Now</button>
        <Link className="btn dark" href="/story">Keep Reading My Story</Link>
      </div>
      <p className="note">No sandbox login? Nothing moves, and you can keep reading and correcting your story.</p>
      <p className="note">
        Prototype, what PayPal could report:{" "}
        <button className="link" style={{ fontSize: 13.5 }} onClick={() => settle("completed")}>Paid</button>{" · "}
        <button className="link" style={{ fontSize: 13.5 }} onClick={() => settle("cancelled")}>Cancelled</button>{" · "}
        <button className="link" style={{ fontSize: 13.5 }} onClick={() => settle("expired")}>Link Ran Out</button>
      </p>
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
