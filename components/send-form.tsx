"use client";
// Send Money on Memory (U21): the form under a person, with them filled in. How Much? and the Account paid.
// Nothing moves until the person taps Get the PayPal Link and approves it on PayPal with their own sandbox login.
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { post, useApi } from "@/lib/use-api";
import { titleCase } from "@/lib/title-case";

type Accounts = { testEmail: string | null; saved: { who: string; email: string }[]; min: number; max: number };
type Field = "amount" | "account";
const NEW = "new";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function SendForm({ who, onCancel }: { who: string; onCancel: () => void }) {
  const router = useRouter();
  const id = useId();
  const { data } = useApi<Accounts>("/api/action?accounts=1");
  const [amount, setAmount] = useState("25.00");
  const [picked, setPicked] = useState<string | null>(null); // null: the account saved for this person
  const [typed, setTyped] = useState("");
  const [bad, setBad] = useState<{ field: Field; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return null;

  const mine = data.saved.filter((s) => same(s.who, who));
  const others = data.saved.filter((s) => !same(s.who, who));
  const account = picked ?? mine[0]?.email ?? (data.testEmail ? "test" : NEW);
  const name = titleCase(who);

  const send = async () => {
    const n = Number(amount.trim().replace(/^\$/, ""));
    if (!/^\$?\d+(\.\d{1,2})?$/.test(amount.trim()) || n < data.min || n > data.max) return setBad({ field: "amount", text: `Choose an amount from $${data.min}.00 to $${data.max}.00.` });
    const to = account === NEW ? typed.trim() : account;
    if (account === NEW && !EMAIL.test(to)) return setBad({ field: "account", text: "Enter an account email." });
    setBusy(true);
    const r = await post("/api/action", { kind: "send", who, amount: n.toFixed(2), to }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) return router.push(`/action/status?id=${j.id}`);
    setBusy(false);
    if (r?.status === 400) return setBad({ field: j.field === "amount" ? "amount" : "account", text: j.reason });
    router.push(`/action/failed?kind=send&amount=${n.toFixed(2)}${r?.status === 422 ? "&why=refused" : ""}`);
  };
  const clear = () => setBad(null);

  return (
    <form className="send-card" onSubmit={(e) => { e.preventDefault(); send(); }} aria-label={`Send money to ${name}`}>
      <label className="field-label" htmlFor={`${id}-amount`}>How Much?</label>
      <input className="field" id={`${id}-amount`} inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); clear(); }} aria-invalid={bad?.field === "amount"} aria-describedby={`${id}-amount-note`} autoFocus />
      {bad?.field === "amount" ? (
        <p className="field-error" id={`${id}-amount-note`} role="alert">{bad.text}</p>
      ) : (
        <p className="note" id={`${id}-amount-note`}>From ${data.min}.00 to ${data.max}.00, from the account you approve with on PayPal.</p>
      )}

      <label className="field-label" htmlFor={`${id}-account`}>Account</label>
      <select className="field" id={`${id}-account`} value={account} onChange={(e) => { setPicked(e.target.value); clear(); }}>
        {mine.map((s) => <option key={s.email} value={s.email}>{s.email} ({titleCase(s.who)})</option>)}
        {data.testEmail && <option value="test">Soul&rsquo;s Test Account ({data.testEmail})</option>}
        {others.map((s) => <option key={`${s.who}-${s.email}`} value={s.email}>{s.email} ({titleCase(s.who)})</option>)}
        <option value={NEW}>Type a New Account</option>
      </select>
      {account === NEW && (
        <input className="field" type="email" value={typed} onChange={(e) => { setTyped(e.target.value); clear(); }} placeholder="name@personal.example.com" aria-label="New account email" aria-invalid={bad?.field === "account"} />
      )}
      {bad?.field === "account" ? (
        <p className="field-error" role="alert">{bad.text}</p>
      ) : (
        account === NEW && <p className="note">I&rsquo;ll remember it for {name}.</p>
      )}

      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn small" disabled={busy}>{busy ? "Making the Link…" : "Get the PayPal Link"}</button>
        <button type="button" className="btn dark small" disabled={busy} onClick={onCancel}>Not Now</button>
      </div>
    </form>
  );
}
