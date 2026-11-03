"use client";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { Empty, Receipt, Skeleton, Toast, useToast } from "@/components/ui";
import { titleCase } from "@/lib/title-case";
import type { Action } from "@/lib/mock";

const small = { fontSize: 13.5 };

function Status() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const toast = useToast();
  const { data, setData, loaded, reload } = useApi<Action | null>(`/api/action?id=${id}`);

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

  if (!loaded) return <div className="wrap narrow"><Skeleton lines={4} tall /></div>;
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
          <a className="btn paypal" href="#paypal" onClick={(e) => e.preventDefault()}>
            <i className="fa-brands fa-paypal" aria-hidden="true" /> Open PayPal <span className="sbx">Sandbox</span>
          </a>
          <button className="btn dark" onClick={check}>I&rsquo;ve Paid, Check Now</button>
          <Link className="btn dark" href="/story">Keep Reading My Story</Link>
        </div>
      </Receipt>
      <p className="note">No sandbox login? Nothing moves, and you can keep reading and correcting your story.</p>
      <p className="note">
        Prototype, what PayPal could report:{" "}
        <button className="link" style={small} onClick={() => settle("completed")}>Paid</button>{" · "}
        <button className="link" style={small} onClick={() => settle("cancelled")}>Cancelled</button>{" · "}
        <button className="link" style={small} onClick={() => settle("expired")}>Link Ran Out</button>
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
