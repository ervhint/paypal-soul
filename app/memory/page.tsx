"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post, useApi } from "@/lib/use-api";
import { Skeleton, Toast, useToast } from "@/components/ui";
import { titleCase } from "@/lib/title-case";
import type { Memory, Payment } from "@/lib/mock";

const CHIPS = 5;
type Data = { memory: Memory[]; payments: Payment[] };
type Reply = ({ status: "done" } & Data) | { status: "ask"; question: string; options: string[] } | { status: "error"; message: string };

const patch = (body: object): Promise<Reply> =>
  fetch("/api/memory", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch(() => ({ status: "error", message: "I couldn't reach Soul just now. Try again in a moment." }));

export default function MemoryPage() {
  const { data, setData } = useApi<Data>("/api/memory");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [question, setQuestion] = useState<{ question: string; options: string[] } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const toast = useToast();

  // Each change rewrites the story first, so it takes a few seconds and can fail with nothing changed.
  const change = async (m: Memory, body: object, done: string) => {
    setBusy(m.id);
    const r = await patch({ id: m.id, ...body });
    setBusy(null);
    if (r.status === "ask") return setQuestion(r);
    if (r.status === "error") return toast.show(r.message);
    setData(r);
    setEditing(null);
    setQuestion(null);
    toast.show(done);
  };
  const toggle = (m: Memory) => change(m, { active: !m.active }, m.active ? "I'll stop using that" : "I'm using it again");
  const save = (m: Memory, who?: string) => change(m, { text: draft, who }, "Saved. I'll use your wording");

  return (
    <div className="wrap narrow">
      <p className="eyebrow">What I Remember About You</p>
      <h1 className="display" style={{ marginTop: 12, fontSize: "clamp(32px, 4.6vw, 54px)" }}>Memory</h1>
      <p className="lead">Everything I believe, in plain words. Edit a belief, or tell me to stop using it. Each one comes from payments or from something you told me.</p>

      {!data ? (
        <Skeleton lines={4} />
      ) : !data.memory.length ? (
        <p className="note">I don&rsquo;t believe anything yet. A belief appears here when a payment repeats or you correct a sentence in your story.</p>
      ) : (
        <ul className="mem">
          {data.memory.map((m) => {
            const pays = data.payments.filter((p) => m.paymentIds.includes(p.id));
            return (
            <li key={m.id} className={m.active ? "" : "off"}>
              <div>
                <div className="mem-text">{m.text}</div>
                <div className="mem-meta">
                  <span>{m.sure}</span>
                  <span>{m.source}</span>
                  {m.source.startsWith("You Told Me") && <span className="tag">Updated</span>}
                  {!m.active && <span className="tag plain">Not Used</span>}
                </div>
                <div className="mem-pays">
                  {pays.slice(0, CHIPS).map((p) => (
                    <Link key={p.id} className="pay-chip" href="/story" title={`PayPal ID ${p.txn}`}>
                      <i className={`fa-solid fa-${p.icon}`} aria-hidden="true" /> {titleCase(p.item)} · {p.date}
                    </Link>
                  ))}
                  {pays.length > CHIPS && <Link className="pay-chip" href="/story">+{pays.length - CHIPS} More</Link>}
                </div>
              </div>
              {editing !== m.id && <div className="mem-actions">
                {m.active && <button className="btn dark small" disabled={!!busy} onClick={() => { setEditing(m.id); setDraft(m.text); setQuestion(null); }}>Edit</button>}
                <button className="btn line small" disabled={!!busy} onClick={() => toggle(m)}>{busy === m.id ? "Rewriting Your Story…" : m.active ? "Stop Using This" : "Use Again"}</button>
              </div>}
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
      <section className="danger">
        <h2>Delete My Data</h2>
        <p>Removes your corrections, memory, chat and saved chapters from Soul. Your PayPal sandbox account isn&rsquo;t touched.</p>
        {deleting ? (
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn line small" onClick={async () => { await post("/api/reset"); router.push("/?deleted=1"); }}>Yes, Delete It All</button>
            <button className="btn small" onClick={() => setDeleting(false)}>Keep My Data</button>
          </div>
        ) : (
          <button className="btn line small" style={{ marginTop: 14 }} onClick={() => setDeleting(true)}>Delete My Data</button>
        )}
      </section>
      <Toast text={toast.text} />
    </div>
  );
}
