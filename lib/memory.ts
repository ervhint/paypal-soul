// The Memory page (U6). Everything Soul believes, with who said it and the payments behind it. An edit is a
// correction in the person's own words: the LLM only reads who the payments were for and their category,
// and the person's text is kept as it is (AC-6.2). Stop Using This takes a belief out of the story and chat
// (AC-6.3), and Use Again brings it back. All three rewrite every week with the belief's payments first, so
// a failed rewrite changes nothing.
import type { SupabaseClient } from "@supabase/supabase-js";
import { editPreference, usePreference } from "@/lib/about";
import { interpret, MAX_SAID, movedIds, nextTold, saveCorrection, saveMoved, undoPoint, WHO_QUESTION, type Reading, type Result } from "@/lib/correct";
import type { AskJson } from "@/lib/llm";
import { peopleOf } from "@/lib/send";
import { applyTold, BELIEF_COLUMNS, beliefView, clip, HABIT, isOneOff, loadPayments, loadPreferences, loadStopped, loadTold, must, paymentView, saveChapters, short, stopKey, writeChapters, type Told } from "@/lib/story";
import { INTEREST, weekOf, type StoryPayment } from "@/lib/totals";

const FAILED = "I couldn't rewrite your story just now, so nothing changed. Try again in a moment.";
const LOST = "I can't find that belief any more. Refresh the page and try again.";
const STOPPED = "Use this belief again before you edit it.";
const error = (message: string): Result => ({ status: "error", message });

type Row = { id: string; kind: string; key: string | null; text: string; who: string | null; category: string | null; payment_ids: string[]; active: boolean };
const isTold = (b: Row) => b.kind === "support" || b.kind === "told";
const noticed = (key: string | null) => !!key && (key.startsWith(HABIT) || key.startsWith(INTEREST));
/** Keys an edit keeps: a habit's or interest's, so a rebuild leaves the person's words, and a one-off's, so it stays apart. */
const ownKey = (key: string | null) => noticed(key) || isOneOff({ key });
const toTold = (b: Row): Told => ({ id: b.id, key: b.key, text: b.text, who: b.who, category: b.category, paymentIds: b.payment_ids });

/**
 * Every belief, stopped ones too, with the payments as this person sees them, for the chips, and the people
 * they can send money to from here (U21): those they support, and anyone they already sent money to.
 */
export async function readMemory(db: SupabaseClient, accountId: string) {
  const [all, told, beliefs, sends] = await Promise.all([
    loadPayments(db, accountId),
    loadTold(db, accountId),
    must(db.from("belief").select(`${BELIEF_COLUMNS}, who`).eq("account_id", accountId).neq("kind", "check").order("created_at")), // a Same as Usual answer isn't listed (AC-18.4)
    must(db.from("action").select("id, kind, recipient, status, amount, created_at").eq("account_id", accountId).eq("kind", "send")),
  ]);
  const people = peopleOf(beliefs.map((b) => ({ ...b, oneOff: isOneOff(b) })), sends);
  return { memory: beliefs.map(beliefView), payments: applyTold(all, told).map(paymentView).reverse(), people };
}

const loadBelief = async (db: SupabaseClient, accountId: string, id: string) =>
  (await db.from("belief").select("id, kind, key, text, who, category, payment_ids, active").eq("id", id).eq("account_id", accountId).neq("kind", "check").maybeSingle()).data as Row | null;

/** Writes every week with these payments, newest first, or null unless all of them worked. */
async function rewrite(db: SupabaseClient, accountId: string, ids: string[], after: StoryPayment[], ask: AskJson, told: Told[], stopped: string[]) {
  const weeks = [...new Set(after.filter((p) => ids.includes(p.id)).map((p) => weekOf(p.occurred_at)))].sort().reverse();
  const written = await writeChapters(weeks, after, ask, told, stopped, await loadPreferences(db, accountId));
  return written.length === weeks.length ? { weeks, written } : null;
}

/** Who the payments are for after an edit: whoever it names, or nobody if they say it was theirs, or as before. */
export const whoAfter = (r: Reading, was: string | null) => r.who ?? (r.forSelf ? null : was);

/** The belief's key after an edit. A habit or interest keeps its own, so a rebuild finds it and leaves the person's words. */
export function keyAfter(b: Pick<Row, "key" | "who">, who: string | null, category: string | null) {
  if (ownKey(b.key) || who === b.who) return b.key;
  return who && !category ? `support:${who.toLowerCase()}` : null;
}

/** Saves an edit as a correction and rewrites the weeks of the belief's payments with it (AC-6.2). */
export async function editBelief(db: SupabaseClient, personId: string, accountId: string, input: { id: string; text: string; answer?: string }, ask: AskJson): Promise<Result> {
  const said = clip(input.text, MAX_SAID + 1);
  if (!said) return error("Write what's true first.");
  if (said.length > MAX_SAID) return error(`Keep it under ${MAX_SAID} characters.`);
  const b = await loadBelief(db, accountId, input.id);
  if (!b) return error(LOST);
  if (b.kind === "preference") return editPreference(db, personId, accountId, b.id, input.text, ask); // read like the Tell Soul About You box (U19)
  if (!b.active) return error(STOPPED);
  if (said === b.text) return { status: "done" };

  const [all, told, stopped] = await Promise.all([loadPayments(db, accountId), loadTold(db, accountId), loadStopped(db, accountId)]);
  const before = applyTold(all, told);
  let reading: Reading;
  try {
    reading = await interpret(said, b.text, before.filter((p) => b.payment_ids.includes(p.id)), ask, input.answer);
  } catch (e) {
    console.error("memory edit failed", e);
    return error(FAILED);
  }
  if (reading.needsWho) return { status: "ask", ...WHO_QUESTION };

  const who = whoAfter(reading, b.who);
  const category = reading.category ?? b.category;
  const wanted = keyAfter(b, who, category);
  // A key is unique, and a stopped belief keeps its own: a second one for that person goes without.
  const taken = wanted && wanted !== b.key && (await db.from("belief").select("id").eq("account_id", accountId).eq("key", wanted).maybeSingle()).data;
  const key = taken ? null : wanted;
  const add: Told = { id: b.id, key, text: said, who, category, paymentIds: b.payment_ids };
  const next = nextTold(told, add);
  const after = applyTold(all, next);

  // Their words replace what Soul noticed, so the rewrite mustn't state the interest as well.
  const done = await rewrite(db, accountId, b.payment_ids, after, ask, next, b.key?.startsWith(INTEREST) ? [...stopped, b.key] : stopped);
  const main = done?.written[0];
  if (!done || !main) return error(FAILED);
  const { data: chapter } = await db.from("chapter").select("title, claim(text, belief_id, payment_ids, position)").eq("account_id", accountId).eq("week", done.weeks[0]).maybeSingle();
  const claims = ((chapter?.claim ?? []) as { text: string; belief_id: string | null; payment_ids: string[]; position: number }[]).sort((x, y) => x.position - y.position);
  const claim = claims.find((c) => c.belief_id === b.id) ?? claims.find((c) => c.payment_ids.some((id) => b.payment_ids.includes(id)));

  const undo = await undoPoint(db, accountId, done.written.map((w) => w.week), [b.id, ...movedIds(told, next)]);
  const now = new Date().toISOString();
  await must(db.from("belief").update({ kind: who ? "support" : "told", key, text: said, who, category, sureness: "sure", source: `You Told Me, ${short(now)}`, told_at: now, updated_at: now }).eq("id", b.id));
  await saveMoved(db, told, next, b.id);
  await saveCorrection(db, personId, accountId, {
    written: done.written,
    main,
    oldClaims: claims.map((c) => c.text),
    claimBefore: claim?.text ?? null,
    titleBefore: chapter?.title ?? main.title,
    belief: { id: b.id, text: said, who, before: b.text },
    said,
    targets: b.payment_ids,
    before,
    after,
    undo,
  });
  return { status: "done" };
}

/** Stop Using This, or Use Again: the belief leaves or rejoins what the story and chat are given (AC-6.3). */
export async function setUsing(db: SupabaseClient, personId: string, accountId: string, id: string, active: boolean, ask: AskJson): Promise<Result> {
  const b = await loadBelief(db, accountId, id);
  if (!b) return error(LOST);
  if (b.kind === "preference") return usePreference(db, personId, accountId, b.id, active, ask);
  if (b.active === active) return { status: "done" };

  const [all, told, wasStopped] = await Promise.all([loadPayments(db, accountId), loadTold(db, accountId), loadStopped(db, accountId)]);
  const stop = noticed(b.key) ? stopKey(b.key!) : null;
  const stopped = [...wasStopped.filter((k) => k !== stop), ...(stop && !active ? [stop] : [])];
  const next = !active ? told.filter((t) => t.id !== b.id) : isTold(b) ? nextTold(told, toTold(b)) : told;

  const done = await rewrite(db, accountId, b.payment_ids, applyTold(all, next), ask, next, stopped);
  if (!done) return error(FAILED);
  const now = new Date().toISOString();
  await must(db.from("belief").update({ active, updated_at: now }).eq("id", b.id)); // the newest told belief wins
  await saveMoved(db, told, next, b.id);
  await must(db.from("correction").update({ seen_at: now }).eq("account_id", accountId).is("seen_at", null)); // the story moved on, so Undo closes
  await saveChapters(db, personId, accountId, done.written);
  return { status: "done" };
}
