"use client";
import Link from "next/link";
import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { post, useApi } from "@/lib/use-api";
import { Empty, PaymentRow, Sheet, Skeleton, Toast, money, useToast } from "@/components/ui";
import type { Chapter, Change, Claim, Memory, Payment } from "@/lib/mock";

type Story = {
  chapters: Chapter[];
  payments: Payment[];
  memory: Memory[];
  change: Change | null;
  summary: { payments: number; spent: number; habits: number; checks: number };
};
type Step = "evidence" | "correct" | "ask";

function StoryView() {
  const demo = useSearchParams().get("state"); // prototype only: syncing | offline | empty
  const { data, reload } = useApi<Story>("/api/story");
  const [claim, setClaim] = useState<Claim | null>(null);
  const [step, setStep] = useState<Step>("evidence");
  const [text, setText] = useState("");
  const [question, setQuestion] = useState<{ question: string; options: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState(false);
  const toast = useToast();

  const close = useCallback(() => {
    setClaim(null);
    setStep("evidence");
    setText("");
    setQuestion(null);
  }, []);

  const submit = async (who?: string) => {
    if (!claim) return;
    setBusy(true);
    const r = await (await post("/api/correct", { claimId: claim.id, text, who })).json();
    setBusy(false);
    if (r.status === "ask") {
      setQuestion(r);
      return setStep("ask");
    }
    close();
    setSeen(false);
    await reload();
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.show("Chapter rewritten");
  };

  if (demo === "syncing")
    return (
      <div className="wrap" style={{ maxWidth: 640 }}>
        <p className="eyebrow">Reading your sandbox payments…</p>
        <Skeleton lines={1} tall />
        <Skeleton lines={4} />
        <p className="note">This takes a few seconds the first time. Nothing is shown until I can point to a payment.</p>
      </div>
    );
  if (demo === "empty" || (data && data.payments.length === 0))
    return (
      <div className="wrap">
        <Empty icon="receipt" title="No payments to read yet">
          <p>I only write about payments I can see. Make a sandbox purchase and your first chapter appears here.</p>
          <div className="row">
            <Link className="btn" href="/buy">Make a sandbox purchase</Link>
          </div>
        </Empty>
      </div>
    );
  if (!data)
    return (
      <div className="wrap story-skel" role="status" aria-label="Reading your sandbox payments">
        <div>
          <p className="eyebrow">Reading your sandbox payments…</p>
          <Skeleton lines={1} tall />
          <Skeleton lines={5} />
        </div>
        <Skeleton lines={4} />
      </div>
    );

  const check = data.memory.find((m) => m.kind === "check" && m.active);
  const checkClaim = data.chapters.flatMap((c) => c.claims).find((c) => c.belief === check?.id);
  const open = (c: Claim) => {
    setClaim(c);
    setStep("evidence");
  };
  const pays = (c: Claim) => data.payments.filter((p) => c.paymentIds.includes(p.id));
  const { change } = data;
  const hot = !!change && !seen;
  const rail: [string, string, boolean][] = [
    [String(data.summary.payments), "Payments behind this", false],
    [money(data.summary.spent), "Spent on you", hot],
    [String(data.summary.habits), "Habits noticed", hot],
    [String(data.summary.checks), "Belief to check", hot],
  ];

  return (
    <div className="wrap story">
      <div className="read">
        {demo === "offline" && (
          <div className="panel" role="status">
            <h2>PayPal isn&rsquo;t answering right now</h2>
            <p>This is the story I saved this morning. It may be missing newer payments. I&rsquo;ll catch up when PayPal is back.</p>
          </div>
        )}
        {change && !seen && (
          <details className="changes" aria-label="What changed">
            <summary>
              <span className="tag">Rewritten</span> You corrected me. See what changed
              <button className="link" onClick={(e) => { e.preventDefault(); setSeen(true); fetch("/api/story", { method: "DELETE" }); }}>Looks right</button>
            </summary>
            <p className="before">{change.before}</p>
            <ul>{change.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            <div className="row" style={{ marginTop: 16 }}>
              <Link className="btn line small" href="/memory">See what I remember</Link>
            </div>
          </details>
        )}
        {data.chapters.map((ch, i) => (
          <article key={ch.id} className={`chapter${ch.fresh ? " fresh" : ""}`}>
            <p className="eyebrow">
              {ch.fresh && <span className="tag">New</span>}
              {ch.when}
              {i === 0 && !ch.fresh && " · what I noticed first"}
            </p>
            {i === 0 ? <h1 className="display">{ch.title}</h1> : <h2 className="display">{ch.title}</h2>}
            <p className="prose">
              {ch.claims.map((c) => (
                <span key={c.id}>
                  <button className={`claim${c.rewritten ? " changed" : ""}`} onClick={() => open(c)} aria-label={`${c.text} Show the payments behind this.`}>
                    {c.text}
                  </button>{" "}
                </span>
              ))}
            </p>
            {ch.suggest && (
              <div className="suggest">
                <p>{ch.suggest.text}</p>
                <Link className="btn" href={ch.suggest.href}>{ch.suggest.label}</Link>
              </div>
            )}
          </article>
        ))}
        <p className="note" style={{ marginTop: -24 }}>Tap any sentence to see the payments behind it.</p>
      </div>

      <aside className="rail" aria-label="This week">
        <div className="rail-stats">
          {rail.map(([v, l, h]) => (
            <div className="rail-stat" key={l}><span>{l}</span><b className={h ? "hot" : ""}>{v}</b></div>
          ))}
        </div>
        {check && checkClaim && (
          <div className="panel">
            <p className="eyebrow"><span className="tag plain">Not sure</span></p>
            <h2 style={{ marginTop: 10 }}>{check.text}</h2>
            <p>I&rsquo;m guessing from two payments. Check them for me.</p>
            <button className="btn dark small" style={{ marginTop: 14 }} onClick={() => open(checkClaim)}>Check the payments</button>
          </div>
        )}
        <Link className="btn line" href="/buy">Make a sandbox purchase</Link>
      </aside>

      <Sheet open={!!claim} onClose={close} title="Payments behind this sentence">
        {claim && step === "evidence" && (
          <>
            <p className="eyebrow">Why I wrote this</p>
            <h2>{claim.text}</h2>
            <p className="why">
              {pays(claim).length === 1 ? "One payment says so." : `${pays(claim).length} payments say so.`}{" "}
              {data.memory.find((m) => m.id === claim.belief)?.sure === "Not sure" ? "I'm not sure yet, so I'd like you to check." : ""}
            </p>
            <ul className="pays">{pays(claim).map((p) => <PaymentRow key={p.id} p={p} />)}</ul>
            <div className="actions">
              <button className="btn" onClick={() => setStep("correct")}>That&rsquo;s not right</button>
              <button className="btn dark" onClick={close}>That&rsquo;s right</button>
            </div>
          </>
        )}
        {claim && step === "correct" && (
          <>
            <p className="eyebrow">Correct me</p>
            <h2>What&rsquo;s actually true?</h2>
            <p className="why">Say it your way. I&rsquo;ll rewrite the chapter and tell you what changed.</p>
            <textarea className="field" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Those groceries are for my mum" aria-label="Your correction" autoFocus />
            <div className="actions">
              <button className="btn" disabled={busy || !text.trim()} onClick={() => submit()}>{busy ? "Rewriting…" : "Rewrite the chapter"}</button>
              <button className="btn dark" onClick={() => setStep("evidence")}>Back</button>
            </div>
          </>
        )}
        {claim && step === "ask" && question && (
          <>
            <p className="eyebrow">One question</p>
            <h2>{question.question}</h2>
            <p className="why">You said: &ldquo;{text}&rdquo;. I need a person to write this down.</p>
            <div className="chips">
              {question.options.map((o) => (
                <button key={o} className="chip" disabled={busy} onClick={() => submit(o)}>{o}</button>
              ))}
            </div>
            <div className="actions">
              <button className="btn dark" onClick={() => setStep("correct")}>Change what I said</button>
            </div>
          </>
        )}
      </Sheet>
      <Toast text={toast.text} />
    </div>
  );
}

export default function StoryPage() {
  return (
    <Suspense>
      <StoryView />
    </Suspense>
  );
}
