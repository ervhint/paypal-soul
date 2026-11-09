"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { post, useApi } from "@/lib/use-api";
import { Empty, PaymentRow, Sheet, Skeleton, Toast, money, useToast } from "@/components/ui";
import { titleCase } from "@/lib/title-case";
import type { Action } from "@/lib/action";
import type { Chapter, Change, Claim, LeftOut, Memory, Notice, Payment } from "@/lib/types";

type Story = {
  chapters: Chapter[];
  payments: Payment[];
  leftOut: LeftOut[];
  actions: Action[];
  memory: Memory[];
  change: Change | null;
  notice: Notice | null;
  summary: { payments: number; spent: number; habits: number; checks: number };
  source?: "prepared" | "own" | null;
  syncedThrough: string | null;
};
type Step = "evidence" | "correct" | "ask";

const saved = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function StoryView() {
  const param = useSearchParams().get("state"); // development only, to see a state on demand: syncing | offline | empty
  const demo = process.env.NODE_ENV === "development" ? param : null;
  const { data, reload } = useApi<Story>("/api/story");
  const [sync, setSync] = useState<"idle" | "syncing" | "offline">("idle");
  const [claim, setClaim] = useState<Claim | null>(null);
  const [step, setStep] = useState<Step>("evidence");
  const [text, setText] = useState("");
  const [question, setQuestion] = useState<{ question: string; options: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<Notice | null>(null); // the sheet was opened from the I Noticed card (U18)
  const [seen, setSeen] = useState(false);
  const [missing, setMissing] = useState(false);
  const [older, setOlder] = useState(false);
  const toast = useToast();

  // The saved story shows at once; new payments are read from PayPal behind it. Returns how many came in, or null when PayPal fails.
  const runSync = useCallback(async () => {
    setSync("syncing");
    const r = await fetch("/api/sync", { method: "POST" }).then((r) => r.json()).catch(() => null);
    await reload(); // the story may have been rewritten from saved payments even when PayPal failed
    setSync(r?.ok ? "idle" : "offline"); // after the reload, or a first visit shows "couldn't write" until the chapters arrive
    return r?.ok ? (r.added as number) : null;
  }, [reload]);
  // Once per open: development runs effects twice, and each sync may cost an LLM call.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    runSync();
  }, [runSync]);
  const state = (demo === "syncing" || demo === "offline" ? demo : null) ?? sync;

  // Live chapters (U15): while an order made in Soul waits, the story reads the saved story again every 5s
  // (no PayPal call), and for 30s after it settles, so the chapter PayPal's webhook writes shows by itself.
  // It stops 15 minutes after opening, so a forgotten order doesn't keep asking.
  const live = !!data?.actions.some((a) => a.status === "waiting");
  const watch = useRef({ until: 0, opened: Date.now() });
  useEffect(() => {
    if (live) watch.current.until = Date.now() + 30_000;
    if (Date.now() > watch.current.until || Date.now() - watch.current.opened > 15 * 60_000) return;
    const t = setTimeout(() => reload().catch(() => {}), 5000);
    return () => clearTimeout(t);
  }, [data, live, reload]);

  const closeMissing = useCallback(() => setMissing(false), []);
  const refresh = async () => {
    const added = await runSync();
    if (added !== null) toast.show(added ? `${added} New Payment${added > 1 ? "s" : ""} From PayPal` : "Up to Date With PayPal");
  };

  const close = useCallback(() => {
    setClaim(null);
    setAsking(null);
    setStep("evidence");
    setText("");
    setQuestion(null);
  }, []);

  const submit = async (who?: string) => {
    if (!claim) return;
    setBusy(true);
    const r = await post("/api/correct", { claimId: claim.id, text, who, paymentId: asking?.paymentId })
      .then((r) => r.json())
      .catch(() => ({ status: "error", message: "I couldn't reach Soul just now. Try again in a moment." }));
    setBusy(false);
    if (r.status === "ask") {
      setQuestion(r);
      return setStep("ask");
    }
    if (r.status === "error") return toast.show(r.message);
    close();
    setSeen(false);
    await reload();
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.show("Chapter Rewritten");
  };

  if (demo === "empty" || (data && data.payments.length === 0))
    return (
      <div className="wrap">
        <Empty icon="receipt" title="No Payments to Read Yet">
          <p>I only write about payments I can see, and this account has none. Make a Sandbox Purchase and your first chapter appears here, or read our prepared data.</p>
          <div className="row">
            <Link className="btn" href="/buy">Make a Sandbox Purchase</Link>
            <Link className="btn dark" href="/">Use Prepared Data</Link>
          </div>
        </Empty>
      </div>
    );
  if (!data)
    return (
      <div className="wrap story-skel" role="status" aria-label="Reading your sandbox payments">
        <div>
          <p className="eyebrow">Reading Your Sandbox Payments…</p>
          <Skeleton lines={1} tall />
          <Skeleton lines={5} />
        </div>
        <Skeleton lines={4} />
      </div>
    );

  // The first belief Soul isn't sure of in the newest chapter, so the person can check it.
  const unsure = new Map(data.memory.filter((m) => m.sure === "Not Sure").map((m) => [m.id, m]));
  const checkClaim = data.chapters[0]?.claims.find((c) => c.belief && unsure.has(c.belief));
  const check = checkClaim && unsure.get(checkClaim.belief!);
  const shown = older ? data.chapters : data.chapters.slice(0, 5);
  const open = (c: Claim) => {
    setClaim(c);
    setStep("evidence");
  };
  // The I Noticed card (U18): the sheet shows that payment and the earlier ones, and asks instead of checking.
  const { notice } = data;
  const ask = (n: Notice, at: Step) => {
    setAsking(n);
    setClaim({ id: n.claimId, text: n.sentence, paymentIds: n.paymentIds });
    setStep(at);
  };
  // Same as Usual: saved so Soul never asks about it again, and nothing is rewritten.
  const usual = async (n: Notice) => {
    setBusy(true);
    const r = await fetch("/api/story", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: n.paymentId }) })
      .then((r) => r.json())
      .catch(() => null);
    await reload();
    setBusy(false);
    close();
    toast.show(r?.status === "done" ? "Thanks, I Won't Ask Again" : (r?.message ?? "I Couldn't Save That Just Now"));
  };
  // Looks Right: the belief behind the sentence becomes Sure, and nothing is rewritten.
  const confirm = async () => {
    if (!claim) return;
    setBusy(true);
    const r = await fetch("/api/correct", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId: claim.id }) })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(false);
    if (r?.status !== "done") return toast.show(r?.message ?? "I Couldn't Save That Just Now");
    close();
    if (r.sure) await reload();
    toast.show(r.sure ? "Thanks, I'm Sure Now" : "Thanks for Checking");
  };
  // Undo: the belief and chapter go back as they were, at once, since nothing is rewritten.
  const undo = async () => {
    if (!data.change) return;
    setBusy(true);
    const r = await fetch("/api/correct", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.change.id }) })
      .then((r) => r.json())
      .catch(() => null);
    await reload();
    setBusy(false);
    if (r?.status === "done") window.scrollTo({ top: 0, behavior: "smooth" }); // the panel and its text are gone, so the page has moved
    toast.show(r?.status === "done" ? "Undone, Your Story Is Back" : (r?.message ?? "I Couldn't Undo That Just Now"));
  };
  const pays = (c: Claim) => data.payments.filter((p) => c.paymentIds.includes(p.id));
  const { change } = data;
  const changedIn = change && data.chapters.find((ch) => ch.claims.some((c) => c.id === change.claimId));
  const waiting = data.actions.filter((a) => a.status === "waiting");
  const hot = !!change && !seen;
  const rail: [string, string, boolean][] = [
    [String(data.summary.payments), "Payments Behind This", false],
    [money(data.summary.spent), "Spent on You", hot],
    [String(data.summary.habits), "Habits Noticed", hot],
    [String(data.summary.checks), "Belief to Check", hot],
  ];

  return (
    <div className="wrap story">
      <div className="read">
        {state === "syncing" && (
          <p className="eyebrow syncing" role="status">{data.source === "prepared" ? "Reading New Payments From the Prepared PayPal Account…" : "Reading New Payments From PayPal…"}</p>
        )}
        {state === "offline" && (
          <div className="panel offline" role="status">
            <h2>PayPal Isn&rsquo;t Answering Right Now</h2>
            <p>This is the story I saved{data.syncedThrough ? ` up to ${saved(data.syncedThrough)}` : " last time"}. It may be missing newer payments. I&rsquo;ll catch up when PayPal is back.</p>
            <button className="btn dark small" onClick={runSync}>Retry</button>
          </div>
        )}
        {!data.chapters.length && state === "syncing" && (
          <div role="status" aria-label="Writing your story">
            <p className="eyebrow">Writing Your Story…</p>
            <Skeleton lines={1} tall />
            <Skeleton lines={4} />
          </div>
        )}
        {!data.chapters.length && state !== "syncing" && (
          <div className="panel offline" role="status">
            <h2>I Couldn&rsquo;t Write Your Story Yet</h2>
            <p>Your payments are saved, but I couldn&rsquo;t turn them into chapters just now. Try again in a moment.</p>
            <button className="btn dark small" onClick={runSync}>Retry</button>
          </div>
        )}
        {shown.map((ch, i) => (
          <article key={ch.id} className={`chapter${ch.fresh ? " fresh" : ""}`}>
            <p className="eyebrow">
              {ch.fresh && <span className="tag">New</span>}
              {ch.when}
              {i === 0 && !ch.fresh && " · What I Noticed First"}
            </p>
            {i === 0 ? <h1 className="display">{ch.title}</h1> : <h2 className="display">{ch.title}</h2>}
            <p className="prose">
              {ch.claims.map((c) => (
                <span key={c.id}>
                  <button className={`claim${hot && ch === changedIn && (c.rewritten || c.id === change?.claimId) ? " changed" : ""}`} onClick={() => open(c)} aria-label={`${c.text} Show the payments behind this.`}>
                    <span className="claim-text">{c.text}</span>
                  </button>{" "}
                </span>
              ))}
            </p>
              {hot && ch === changedIn && (
                <details className="changes" aria-label="What changed">
                  <summary>
                    <span className="tag">Rewritten</span> You Corrected Me
                    <span className="changes-actions">
                      {change.canUndo && <button className="link" disabled={busy} onClick={(e) => { e.preventDefault(); undo(); }}>Undo</button>}
                      <button className="link" disabled={busy} onClick={(e) => { e.preventDefault(); setSeen(true); fetch("/api/story", { method: "DELETE" }); }}>Looks Right</button>
                    </span>
                  </summary>
                  <p className="before"><span className="sr">Before: </span>{change.before}</p>
                  <p className="after"><span className="sr">Now: </span>{change.after}</p>
                  <ul>{change.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                  <div className="row" style={{ marginTop: 16 }}>
                    <Link className="btn line small" href="/memory">See What I Remember</Link>
                  </div>
                </details>
              )}
            {notice && notice.chapterId === ch.id && (
              <div className="check-note">
                <span className="tag plain">I Noticed</span>
                <h2>{notice.sentence}</h2>
                <p>{notice.question}</p>
                <div className="row">
                  <button className="btn dark small" onClick={() => ask(notice, "evidence")}>Check the Payments</button>
                  <button className="btn line small" onClick={() => ask(notice, "correct")}>Tell Soul</button>
                  <button className="btn line small" disabled={busy} onClick={() => usual(notice)}>Same as Usual</button>
                </div>
              </div>
            )}
            {check && checkClaim && i === 0 && (
              <div className="check-note">
                <span className="tag plain">Not Sure</span>
                <h2>{check.text}</h2>
                <p>I&rsquo;m only guessing from {check.source.toLowerCase()} so far. Check them for me.</p>
                <button className="btn dark small" onClick={() => open(checkClaim)}>Check the Payments</button>
              </div>
            )}
            {ch.suggest && (
              <div className="suggest">
                <p>{ch.suggest.text}</p>
                <Link className="btn" href={ch.suggest.href}>{ch.suggest.label}</Link>
              </div>
            )}
          </article>
        ))}
        {data.chapters.length > shown.length && (
          <button className="btn line older" onClick={() => setOlder(true)}>Show Older Chapters</button>
        )}
        {!!data.chapters.length && <p className="note" style={{ marginTop: -24 }}>Tap any sentence to see the payments behind it.</p>}
      </div>

      <aside className="rail" aria-label="This week">
        <div className="rail-stats">
          {rail.map(([v, l, h]) => (
            <div className="rail-stat" key={l}><span>{l}</span><b className={h ? "hot" : ""}>{v}</b></div>
          ))}
        </div>
        {waiting.map((a) => (
          <div className="panel" key={a.id} role="status">
            <p className="eyebrow"><span className="tag plain">Waiting on PayPal</span></p>
            <h2 style={{ marginTop: 10 }}>{titleCase(a.title)}</h2>
            <p>It joins your story once it&rsquo;s paid.</p>
            <Link className="btn dark small" style={{ marginTop: 14 }} href={`/action/status?id=${a.id}`}>Open the Payment</Link>
          </div>
        ))}
        <Link className="btn line" href="/buy">Make a Sandbox Purchase</Link>
        <div className="rail-links">
          <button className="link" disabled={state === "syncing"} onClick={refresh}>{state === "syncing" ? "Reading PayPal…" : "Refresh From PayPal"}</button>
          <button className="link" onClick={() => setMissing(true)}>Why Are Some Rows Missing?</button>
        </div>
      </aside>

      <Sheet open={!!claim} onClose={close} title="Payments behind this sentence">
        {claim && step === "evidence" && (
          <>
            <p className="eyebrow">{asking ? "Why I’m Asking" : "Why I Wrote This"}</p>
            <h2>{claim.text}</h2>
            <p className="why">
              {asking
                ? `This payment comes first, then the ${pays(claim).length - 1} earlier ones I compared it with. ${asking.question}`
                : pays(claim).length === 1 ? "One payment says so." : `${pays(claim).length} payments say so.`}{" "}
              {!asking && data.memory.find((m) => m.id === claim.belief)?.sure === "Not Sure" ? "I'm not sure yet, so I'd like you to check." : ""}
            </p>
            <ul className="pays">{pays(claim).map((p) => <PaymentRow key={p.id} p={p} />)}</ul>
            <p className="note"><button className="link" style={{ fontSize: 13.5 }} onClick={() => { close(); setMissing(true); }}>Why Are Some Rows Missing?</button></p>
            {asking ? (
              <div className="actions">
                <button className="btn" onClick={() => setStep("correct")}>Tell Soul</button>
                <button className="btn dark" disabled={busy} onClick={() => usual(asking)}>Same as Usual</button>
              </div>
            ) : (
              <div className="actions">
                <button className="btn" disabled={busy} onClick={confirm}>Looks Right</button>
                <button className="btn dark" onClick={() => setStep("correct")}>That&rsquo;s Not Right</button>
              </div>
            )}
          </>
        )}
        {claim && step === "correct" && (
          <>
            <p className="eyebrow">{asking ? "Tell Soul" : "Correct Me"}</p>
            <h2>{asking ? "What Was This Payment For?" : <>What&rsquo;s Actually True?</>}</h2>
            <p className="why">{asking ? `${asking.sentence} ` : ""}Say it your way. I&rsquo;ll rewrite the chapter and tell you what changed.</p>
            <textarea className="field" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={asking ? "It was a birthday gift" : "Those groceries are for my mum"} aria-label="Your correction" autoFocus />
            <div className="actions">
              <button className="btn" disabled={busy || !text.trim()} onClick={() => submit()}>{busy ? "Rewriting…" : "Rewrite the Chapter"}</button>
              <button className="btn dark" onClick={() => setStep("evidence")}>{asking ? "See the Payments" : "Back"}</button>
            </div>
          </>
        )}
        {claim && step === "ask" && question && (
          <>
            <p className="eyebrow">One Question</p>
            <h2>{question.question}</h2>
            <p className="why">You said: &ldquo;{text}&rdquo;. I need a person to write this down.</p>
            <div className="chips">
              {question.options.map((o) => (
                <button key={o} className="chip" disabled={busy} onClick={() => submit(o)}>{o}</button>
              ))}
            </div>
            <div className="actions">
              <button className="btn dark" onClick={() => setStep("correct")}>Change What I Said</button>
            </div>
          </>
        )}
      </Sheet>
      <Sheet open={missing} onClose={closeMissing} title="Rows left out of your story">
        <p className="eyebrow">From Your PayPal Report</p>
        <h2>Why Are Some Rows Missing?</h2>
        <p className="why">PayPal&rsquo;s report also lists rows that aren&rsquo;t purchases. I leave them out of the story and the totals, and they&rsquo;re all here. A new payment can also take up to 3 hours to reach the report.</p>
        <ul className="pays">
          {data.leftOut.map((r) => (
            <li className="pay" key={r.txn}>
              <span className="pay-main">
                <b>{titleCase(r.label)}</b>
                <small>{r.why}</small>
                <small>{r.date} · {r.code} · PayPal ID {r.txn}</small>
              </span>
              <span className="pay-amt">{money(r.amount)}</span>
            </li>
          ))}
        </ul>
        <p className="note"><Link className="link" style={{ fontSize: 13.5 }} href="/about#differences">How Soul Uses Your PayPal Data</Link></p>
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
