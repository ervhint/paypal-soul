// Chat remembers what you tell it (U20). Chat only reads (AC-16.6), but when someone says "the payments to Sam
// are my rent" or "I love baking", the picker may propose one belief next to its function calls. Code checks it
// like a correction: a real person, a listed category, payments only from this question's function results, no
// amount in its words, and never from a question. The proposal is kept on Soul's answer and shown as a Remember
// This? card. Nothing is believed until the person taps Remember, so a planted payment name or chat line can at
// most make a card they turn down (NF-6). Remember saves through the same code as a correction (U5, U17) or Tell
// Soul About You (U19), with the source You Told Me in Chat. The tap costs no question. Not Now drops it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isCategory } from "@/lib/categories";
import type { Result as FunctionResult } from "@/lib/chat-functions";
import { changeFor, movedIds, person, saveCorrection, saveMoved, undoPoint, type Reading, type Result } from "@/lib/correct";
import { hasAmount, savePreference, TOPICS, type Topic } from "@/lib/about";
import type { AskJson } from "@/lib/llm";
import { applyTold, clip, loadPayments, loadPreferences, loadStopped, loadTold, must, saveHabits, short, writeChapters } from "@/lib/story";
import { weekOf, type StoryPayment } from "@/lib/totals";

const KINDS = ["support", "told", "oneoff", "preference"] as const;
type Kind = (typeof KINDS)[number];
/** A belief Chat proposes. Payments are IDs from this question's results; a preference has none. */
export type Proposal = { kind: Kind; text: string; who: string | null; category: string | null; categories: string[]; topic: Topic; paymentIds: string[] };

export const SOURCE = "You Told Me in Chat";
const MAX_PAYMENTS = 60;
const FAILED = "I couldn't save that just now, so nothing changed. Try again in a moment.";
const GONE = "That suggestion isn't open any more. Tell me again if you'd like me to remember it.";
const error = (message: string): Result => ({ status: "error", message });

/** The picker's extra tool. Calling it runs nothing: it only says what Soul could remember. */
export const REMEMBER_TOOL = {
  type: "function",
  function: {
    name: "remember",
    description:
      "Propose one thing to remember, only when the person tells you something true about their payments or themselves (\"the payments to Sam are my rent\", \"that was a birthday gift\", \"I love baking\"). Never for a question or a request. The person sees it and decides, so nothing is saved by this call. Call the function that finds the payments it's about in the same round, and name it in \"from\".",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...KINDS], description: "support: payments were for someone else. told: payments belong in another category. oneoff: one-time payments, apart from what usually happens. preference: about themselves, not a payment" },
        belief: { type: "string", description: "One short sentence to them as \"you\", e.g. \"You pay Sam your rent.\" No amounts" },
        who: { type: "string", description: "support: the person as Soul says it back, e.g. \"your mum\" or \"Sam\"" },
        category: { type: "string", description: "told: one category id from the list" },
        categories: { type: "array", items: { type: "string" }, description: "preference: up to 3 related category ids" },
        topic: { type: "string", enum: [...TOPICS], description: "preference: what it is" },
        from: { type: "string", description: "The function called for this question whose payments it's about. Leave out for a preference" },
      },
      required: ["kind", "belief"],
      additionalProperties: false,
    },
  },
};

// "Who is Sam?", "how much did I spend", "can you…": a question never makes a proposal (AC-20.4).
const QUESTION = /\?\s*$|^\s*(who|what|when|where|why|how|which|whose|did|do|does|is|are|was|were|can|could|should|would|will|have|has|am|tell me|show me|list|give me)\b/i;
export const isQuestion = (s: string) => QUESTION.test(s);

const listed = (c: unknown) => isCategory(c) && c !== "unknown" && c !== "mixed";

/** The proposal checked against its rules, with payments only from the given ones, or null. */
function checked(p: { kind: unknown; belief: unknown; who?: unknown; category?: unknown; categories?: unknown; topic?: unknown }, pays: StoryPayment[]): Proposal | null {
  if (!KINDS.includes(p.kind as Kind)) return null;
  const kind = p.kind as Kind;
  const text = clip(p.belief, 160);
  if (!text || hasAmount(text)) return null;
  const paymentIds = kind === "preference" ? [] : [...new Set(pays.map((x) => x.id))].slice(0, MAX_PAYMENTS);
  if (kind !== "preference" && !paymentIds.length) return null;
  const who = kind === "support" ? person(p.who) : null;
  if (kind === "support" && !who) return null;
  const category = kind === "told" && listed(p.category) ? (p.category as string) : null;
  if (kind === "told" && !category) return null;
  const raw = kind === "preference" && Array.isArray(p.categories) ? p.categories : [];
  if (!raw.every(listed)) return null; // an unknown category drops the proposal
  const topic = TOPICS.includes(p.topic as Topic) ? (p.topic as Topic) : "preference";
  return { kind, text, who, category, categories: [...new Set(raw as string[])].slice(0, 3), topic, paymentIds };
}

/**
 * The picker's `remember` call as a proposal, or null. Its payments are the ones behind the function it names,
 * which must have run for this question; anything else is dropped (AC-20.4).
 */
export function readProposal(question: string, raw: string, results: FunctionResult[]): Proposal | null {
  if (isQuestion(question)) return null;
  let a: Record<string, unknown>;
  try {
    a = JSON.parse(raw || "{}");
  } catch {
    return null;
  }
  if (!a || typeof a !== "object" || Array.isArray(a)) return null;
  const from = results.filter((r) => r.name === a.from);
  if (a.kind !== "preference" && !from.length) return null;
  return checked(a as Parameters<typeof checked>[0], from.flatMap((r) => [...r.rows, ...r.behind]));
}

/** A saved proposal checked again when it's tapped, against the payments the person has now. */
export function stillHolds(p: Proposal, all: StoryPayment[]): Proposal | null {
  const own = all.filter((x) => p.paymentIds.includes(x.id));
  if (p.kind !== "preference" && own.length !== p.paymentIds.length) return null;
  return checked({ kind: p.kind, belief: p.text, who: p.who, category: p.category, categories: p.categories, topic: p.topic }, own);
}

/** Saves a support, told or one-off belief the way a correction does, with the newest week its payments touch as the main chapter. */
async function saveTold(db: SupabaseClient, personId: string, accountId: string, p: Proposal, said: string, ask: AskJson): Promise<Result> {
  const [all, told, stopped, prefs] = await Promise.all([loadPayments(db, accountId), loadTold(db, accountId), loadStopped(db, accountId), loadPreferences(db, accountId)]);
  const before = applyTold(all, told);
  const pays = before.filter((x) => p.paymentIds.includes(x.id));
  const reading: Reading = { who: p.who, forSelf: false, needsWho: false, category: p.category as Reading["category"], paymentIds: pays.map((x) => x.id), belief: p.text, oneOff: p.kind === "oneoff", what: p.kind === "oneoff" ? p.text.replace(/\.$/, "") : null };
  const { oneOff, targets, same, add, next } = changeFor(told, reading, pays, said);
  const after = applyTold(all, next);

  const weeks = [...new Set(targets.map((x) => weekOf(x.occurred_at)))].sort().reverse().slice(0, 6);
  const written = await writeChapters(weeks, after, ask, next, stopped, prefs);
  const main = written.find((w) => w.week === weeks[0]);
  if (!main) return error(FAILED);

  const now = new Date().toISOString();
  const old = (await db.from("chapter").select("title, claim(text)").eq("account_id", accountId).eq("week", main.week).maybeSingle()).data as { title: string; claim: { text: string }[] } | null;
  const row = { kind: add.who ? "support" : "told", key: add.key, text: add.text, who: add.who, category: add.category, sureness: "sure", source: `${SOURCE}, ${short(now)}`, payment_ids: add.paymentIds, active: true, told_at: now, updated_at: now };
  const stoppedId = add.key && !same ? (await db.from("belief").select("id").eq("account_id", accountId).eq("key", add.key).maybeSingle()).data?.id : undefined;
  const existing = same?.id ?? stoppedId;
  const beliefBefore = existing ? ((await db.from("belief").select("text").eq("id", existing).maybeSingle()).data?.text ?? null) : null;
  const undo = await undoPoint(db, accountId, written.map((w) => w.week), [...(existing ? [existing] : []), ...movedIds(told, next)]);
  const belief = existing
    ? await must(db.from("belief").update(row).eq("id", existing).select("id").single())
    : await must(db.from("belief").insert({ person_id: personId, account_id: accountId, ...row }).select("id").single());
  await saveMoved(db, told, next, same?.id);
  if (oneOff) await saveHabits(db, personId, accountId, after);
  const kept = told.filter((t) => movedIds(told, next).includes(t.id));
  await saveCorrection(db, personId, accountId, {
    written,
    main,
    oldClaims: old?.claim.map((c) => c.text) ?? [],
    claimBefore: null,
    titleBefore: old?.title ?? main.title,
    belief: { id: belief.id, text: add.text, who: add.who, before: beliefBefore },
    ...(oneOff ? { oneOff: { what: reading.what ?? add.text, kept } } : {}),
    said,
    targets: reading.paymentIds.filter((id) => add.paymentIds.includes(id)),
    before,
    after,
    undo: { ...undo, created: existing ? null : belief.id },
  });
  return { status: "done" };
}

type Held = { id: string; remember: Proposal | null; created_at: string };

/** The question an answer replied to: the person's message just before it. */
async function questionOf(db: SupabaseClient, accountId: string, m: Held) {
  const rows = await must(db.from("chat_message").select("text").eq("account_id", accountId).eq("role", "user").lt("created_at", m.created_at).order("created_at", { ascending: false }).limit(1));
  return (rows[0]?.text as string | undefined) ?? m.remember?.text ?? "";
}

/**
 * Remember or Not Now on an answer's card (AC-20.2, AC-20.3). Taking the proposal off the answer first stops a
 * second tap; if saving fails it goes back, so the person can try again.
 */
export async function decide(db: SupabaseClient, personId: string, accountId: string, messageId: string, keep: boolean, ask: AskJson): Promise<Result> {
  const { data } = await db.from("chat_message").select("id, remember, created_at").eq("id", messageId).eq("account_id", accountId).eq("role", "soul").not("remember", "is", null).maybeSingle();
  const m = data as Held | null;
  if (!m?.remember) return error(GONE);
  // Only the tap that clears it goes on.
  const { data: taken } = await db.from("chat_message").update({ remember: null }).eq("id", m.id).not("remember", "is", null).select("id");
  if (!taken?.length) return error(GONE);
  if (!keep) return { status: "done" };
  const putBack = () => db.from("chat_message").update({ remember: m.remember }).eq("id", m.id);
  try {
    const all = applyTold(await loadPayments(db, accountId), await loadTold(db, accountId));
    const p = stillHolds(m.remember, all);
    if (!p) return error(GONE);
    const said = await questionOf(db, accountId, m);
    const r =
      p.kind === "preference"
        ? await savePreference(db, personId, accountId, { topic: p.topic, text: p.text, categories: p.categories }, SOURCE, ask)
        : await saveTold(db, personId, accountId, p, said, ask);
    if (r.status === "error") await putBack();
    return r;
  } catch (e) {
    console.error("remember failed", e);
    await putBack();
    return error(FAILED);
  }
}
