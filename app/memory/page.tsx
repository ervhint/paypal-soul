"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { PaymentRow, Sheet, Skeleton, Toast, money, useToast } from "@/components/ui";
import { SendForm } from "@/components/send-form";
import { MinimumSteps, UsePrepared, type Minimum } from "@/components/minimum";
import { titleCase } from "@/lib/title-case";
import type { Memory, Payment } from "@/lib/types";

const CHIPS = 5;
const ABOUT_MAX = 200; // characters in Tell Soul About You (U19)
const ABOUT_KEEP = 10; // things kept about the person
type Person = { who: string; beliefId: string | null; last: { actionId: string; status: "waiting" | "completed"; amount: number; at: string } | null };
type Data = { memory: Memory[]; payments: Payment[]; people: Person[]; minimum?: Minimum };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The person's latest send, under their name on Memory (U21). */
function LastSend({ p }: { p: Person }) {
  if (!p.last) return null;
  const paid = p.last.status === "completed";
  return (
    <p className="send-last">
      {paid ? `Sent ${money(p.last.amount)} on ${day(p.last.at)}.` : `${money(p.last.amount)} is waiting for your approval on PayPal.`}{" "}
      <Link className="link" href={paid ? `/action/done?id=${p.last.actionId}` : `/action/status?id=${p.last.actionId}`}>{paid ? "See the Payment" : "Open the Payment"}</Link>
    </p>
  );
}
type Reply = ({ status: "done" } & Data) | { status: "ask"; question: string; options: string[] } | { status: "error"; message: string };

const call = (method: "POST" | "PATCH" | "DELETE", body: object): Promise<Reply> =>
  fetch("/api/memory", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch(() => ({ status: "error", message: "I couldn't reach Soul just now. Try again in a moment." }));

export default function MemoryPage() {
  const { data, setData } = useApi<Data>("/api/memory");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [question, setQuestion] = useState<{ question: string; options: string[] } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [about, setAbout] = useState(""); // Tell Soul About You
  const [dropping, setDropping] = useState<string | null>(null); // the preference asking Delete This?
  const [shown, setShown] = useState<{ text: string; pays: Payment[]; of: number } | null>(null);
  const [sending, setSending] = useState<string | null>(null); // who the Send Money form is open for
  const stopSending = useCallback(() => setSending(null), []);
  const closeShown = useCallback(() => setShown(null), []);
  const router = useRouter();
  const toast = useToast();

  const remove = async () => {
    setBusy("delete");
    const r = await fetch("/api/me", { method: "DELETE" }).catch(() => null);
    if (r?.ok) return router.push("/?deleted=1");
    setBusy(null);
    toast.show("Soul couldn't delete your data just now. Try again in a moment.");
  };

  // Each change rewrites the story first, so it takes a few seconds and can fail with nothing changed.
  const change = async (m: Memory, body: object, done: string, method: "PATCH" | "DELETE" = "PATCH") => {
    setBusy(m.id);
    const r = await call(method, { id: m.id, ...body });
    setBusy(null);
    if (r.status === "ask") return setQuestion(r);
    if (r.status === "error") return toast.show(r.message);
    setData(r);
    setEditing(null);
    setQuestion(null);
    setDropping(null);
    toast.show(done);
  };
  const tell = async () => {
    setBusy("about");
    const r = await call("POST", { text: about });
    setBusy(null);
    if (r.status === "error") return toast.show(r.message);
    if (r.status !== "done") return;
    setData(r);
    setAbout("");
    toast.show("Thanks. I'll keep that in mind");
  };
  const drop = (m: Memory) => change(m, {}, "Deleted. I won't use it again", "DELETE");
  const toggle = (m: Memory) => change(m, { active: !m.active }, m.active ? "I'll stop using that" : "I'm using it again");
  const save = (m: Memory, who?: string) => change(m, { text: draft, who }, "Saved. I'll use your wording");
  const prefs = data?.memory.filter((m) => m.kind === "preference") ?? [];
  const beliefs = data?.memory.filter((m) => m.kind !== "preference") ?? [];
  // Development only, to see a state on demand: ?state=empty | little
  const [demo, setDemo] = useState<string | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === "development") setDemo(new URLSearchParams(location.search).get("state"));
  }, []);
  // An own sandbox below the minimum has no story, so nothing to remember or change yet (U10).
  const waiting =
    demo === "empty" ? { days: 0, payments: 0, repeats: 0, ok: false } : demo === "little" ? { days: 3, payments: 2, repeats: 0, ok: false } : data?.minimum && !data.minimum.ok ? data.minimum : null;

  return (
    <div className="wrap narrow">
      <p className="eyebrow">What I Remember About You</p>
      <h1 className="display" style={{ marginTop: 12, fontSize: "clamp(32px, 4.6vw, 54px)" }}>Memory</h1>
      <p className="lead">Everything I believe, in plain words. Edit a belief, or tell me to stop using it. Each one comes from payments or from something you told me. You can send money to the people here through PayPal.</p>

      {waiting ? (
        <section className="tell">
          <h2>{waiting.payments ? "Nothing to Remember Yet" : "No Payments to Remember Yet"}</h2>
          <p>{waiting.payments ? "I only remember what your payments show and what you tell me about them, and there isn’t enough here for a story yet." : "This sandbox account has no payments yet, so there’s nothing for me to remember."} Memory starts with your story, once your sandbox has 5 or more payments across at least 7 days, with 1 repeat.</p>
          {!!waiting.payments && <MinimumSteps found={waiting} />}
          <div className="row" style={{ marginTop: 20 }}>
            <Link className="btn small" href="/buy">Make a Sandbox Purchase</Link>
            <UsePrepared className="btn dark small" />
          </div>
        </section>
      ) : (
      <>
      <section className="tell">
        <h2>Tell Soul About You</h2>
        <p>A priority, a hobby or something you like. I keep it in your words, and mention it when your payments fit it.</p>
        <form onSubmit={(e) => { e.preventDefault(); tell(); }}>
          <textarea className="field" rows={2} maxLength={ABOUT_MAX} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="I love baking" aria-label="Tell Soul about you" disabled={!data || prefs.length >= ABOUT_KEEP} />
          <div className="row">
            <button className="btn small" disabled={!data || !about.trim() || !!busy || prefs.length >= ABOUT_KEEP}>{busy === "about" ? "Rewriting Your Story…" : "Tell Soul"}</button>
            <span className="tell-count">{prefs.length >= ABOUT_KEEP ? `You've told me ${ABOUT_KEEP} things. Delete one to add another.` : `${about.length}/${ABOUT_MAX}`}</span>
          </div>
        </form>
        {!!prefs.length && (
          <ul className="mem">
            {prefs.map((m) => (
              <li key={m.id} className={m.active ? "" : "off"}>
                <div>
                  <div className="mem-text">{m.text}</div>
                  <div className="mem-meta">
                    <span>{m.source}</span>
                    <span className="tag plain">{m.topic}</span>
                    <span>{m.categories?.length ? `Fits ${m.categories.join(", ")}` : "No Spending Linked"}</span>
                    {!m.active && <span className="tag plain">Not Used</span>}
                  </div>
                </div>
                <div className={`mem-actions${editing === m.id || dropping === m.id ? " held" : ""}`}>
                  {m.active && <button className="btn dark small" disabled={!!busy} onClick={() => { setEditing(m.id); setDraft(m.text); setDropping(null); }}>Edit</button>}
                  <button className="btn line small" disabled={!!busy} onClick={() => toggle(m)}>{busy === m.id ? "Rewriting Your Story…" : m.active ? "Stop Using This" : "Use Again"}</button>
                  <button className="btn line small" disabled={!!busy} onClick={() => { setDropping(m.id); setEditing(null); }}>Delete</button>
                </div>
                {editing === m.id && (
                  <form onSubmit={(e) => { e.preventDefault(); save(m); }}>
                    <textarea className="field" rows={2} maxLength={ABOUT_MAX} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit what you told me" autoFocus />
                    <div className="row">
                      <button className="btn small" disabled={!draft.trim() || !!busy}>{busy === m.id ? "Rewriting Your Story…" : "Save"}</button>
                      <button type="button" className="btn dark small" disabled={!!busy} onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </form>
                )}
                {dropping === m.id && (
                  <div className="mem-confirm">
                    <p>Delete this for good? I&rsquo;ll stop using it in your story and chat.</p>
                    <div className="row">
                      <button className="btn line small" disabled={!!busy} onClick={() => drop(m)}>{busy === m.id ? "Deleting…" : "Yes, Delete It"}</button>
                      <button className="btn small" disabled={!!busy} onClick={() => setDropping(null)}>Keep It</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="mem-head">What I Believe</h2>
      {!data ? (
        <Skeleton lines={4} />
      ) : !beliefs.length ? (
        <p className="note">I don&rsquo;t believe anything yet. A belief appears here when a payment or a kind of spending repeats, or you correct a sentence in your story.</p>
      ) : (
        <ul className="mem">
          {beliefs.map((m) => {
            const pays = data.payments.filter((p) => m.paymentIds.includes(p.id));
            const person = m.active ? data.people.find((p) => p.beliefId === m.id) : undefined;
            return (
            <li key={m.id} className={m.active ? "" : "off"}>
              <div>
                <div className="mem-text">{m.text}</div>
                <div className="mem-meta">
                  <span>{m.sure}</span>
                  <span>{m.source}</span>
                  {m.kind === "interest" && <span className="tag plain">Interest</span>}
                  {m.oneOff && <span className="tag plain">One-Off</span>}
                  {m.source.startsWith("You Told Me") && <span className="tag">Updated</span>}
                  {!m.active && <span className="tag plain">Not Used</span>}
                </div>
                <div className="mem-pays">
                  {pays.slice(0, CHIPS).map((p) => (
                    <button key={p.id} type="button" className="pay-chip" title={`PayPal ID ${p.txn}`} onClick={() => setShown({ text: m.text, pays: [p], of: pays.length })}>
                      <i className={`fa-solid fa-${p.icon}`} aria-hidden="true" /> {titleCase(p.item)} · {p.date}
                    </button>
                  ))}
                  {pays.length > CHIPS && <button type="button" className="pay-chip" onClick={() => setShown({ text: m.text, pays: pays.slice(CHIPS), of: pays.length })}>+{pays.length - CHIPS} More</button>}
                </div>
              </div>
              {/* Hidden, not removed, while editing: its width keeps the payment chips where they are. */}
              <div className={`mem-actions${editing === m.id ? " held" : ""}`}>
                {m.active && <button className="btn dark small" disabled={!!busy} onClick={() => { setEditing(m.id); setDraft(m.text); setQuestion(null); }}>Edit</button>}
                <button className="btn line small" disabled={!!busy} onClick={() => toggle(m)}>{busy === m.id ? "Rewriting Your Story…" : m.active ? "Stop Using This" : "Use Again"}</button>
                {person && sending !== person.who && <button className="btn small" disabled={!!busy} onClick={() => { setSending(person.who); setEditing(null); }}>Send Money to {titleCase(person.who)}</button>}
              </div>
              {person && <LastSend p={person} />}
              {person && sending === person.who && <SendForm who={person.who} onCancel={stopSending} />}
              {editing === m.id && (
                <form onSubmit={(e) => { e.preventDefault(); save(m); }}>
                  <textarea className="field" rows={2} maxLength={300} value={draft} onChange={(e) => { setDraft(e.target.value); setQuestion(null); }} aria-label="Edit belief" autoFocus />
                  {question ? (
                    <>
                      <p className="note" style={{ marginTop: 0 }}>{question.question}</p>
                      <div className="row">
                        {question.options.map((o) => (
                          <button key={o} type="button" className="btn small" disabled={!!busy} onClick={() => save(m, o)}>{o}</button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="row">
                      <button className="btn small" disabled={!draft.trim() || !!busy}>{busy === m.id ? "Rewriting Your Story…" : "Save"}</button>
                      <button type="button" className="btn dark small" disabled={!!busy} onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  )}
                </form>
              )}
            </li>
            );
          })}
        </ul>
      )}
      {!!data?.people.some((p) => !p.beliefId) && (
        <section className="sent-to">
          <h2>People You&rsquo;ve Sent Money To</h2>
          <ul className="mem">
            {data.people.filter((p) => !p.beliefId).map((p) => (
              <li key={p.who}>
                <div>
                  <div className="mem-text">{titleCase(p.who)}</div>
                  <LastSend p={p} />
                </div>
                <div className="mem-actions">
                  {sending !== p.who && <button className="btn small" onClick={() => setSending(p.who)}>Send Money to {titleCase(p.who)}</button>}
                </div>
                {sending === p.who && <SendForm who={p.who} onCancel={stopSending} />}
              </li>
            ))}
          </ul>
        </section>
      )}
      </>
      )}
      <section className="danger">
        <h2>Delete My Data</h2>
        <p>Removes your corrections, memory, chat and saved chapters from Soul, and the link to your sandbox if you connected one. Your PayPal sandbox account isn&rsquo;t touched.</p>
        {deleting ? (
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn line small" disabled={!!busy} onClick={remove}>{busy === "delete" ? "Deleting…" : "Yes, Delete It All"}</button>
            <button className="btn small" onClick={() => setDeleting(false)}>Keep My Data</button>
          </div>
        ) : (
          <button className="btn line small" style={{ marginTop: 14 }} onClick={() => setDeleting(true)}>Delete My Data</button>
        )}
      </section>
      <Sheet open={!!shown} onClose={closeShown} title="Payments behind this belief">
        {shown && (
          <>
            <p className="eyebrow">Why I Believe This</p>
            <h2>{shown.text}</h2>
            <p className="why">{shown.pays.length} of {shown.of} {shown.of === 1 ? "payment" : "payments"} behind this belief.</p>
            <ul className="pays">{shown.pays.map((p) => <PaymentRow key={p.id} p={p} />)}</ul>
          </>
        )}
      </Sheet>
      <Toast text={toast.text} />
    </div>
  );
}
