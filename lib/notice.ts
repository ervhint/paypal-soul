// The I Noticed card (U18). Under the newest chapter that holds one, Soul asks about the first unusual payment
// the person hasn't explained yet (lib/totals.ts `unusual`). Code writes the card from code's figures, never
// the LLM, and never guesses why the payment was bigger.
import { titleCase } from "@/lib/title-case";
import type { Notice } from "@/lib/types";
import type { Unusual } from "@/lib/totals";

const money = (n: number) => `$${n.toFixed(2)}`;
const short = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "This $80.00 for your mum on Nov 4 is bigger than your usual $25.00." and the question. */
export function noticeText(u: Unusual) {
  const what = u.who ?? titleCase(u.name);
  return { sentence: `This ${money(u.payment.amount)} for ${what} on ${short(u.payment.occurred_at)} is bigger than your usual ${money(u.usual)}.`, question: "Does it have a different purpose?" };
}

type ChapterIn = { id: string; week: string | null; paymentIds: string[]; claims: { id: string; paymentIds: string[] }[] };

/** Soul asks only about payments from the last 30 days: older ones sit in chapters behind Show Older Chapters. */
export const ASK_DAYS = 30;

/**
 * The card for the newest week chapter (newest first) that holds an unexplained unusual payment from the last
 * 30 days, or null. A payment's own New chapter (U8, U9) has no week, so a correction can't rewrite it. The
 * claim is the sentence that cites the payment, else the chapter's first, so Tell Soul rewrites that chapter.
 */
export function noticeFor(chapters: ChapterIn[], odd: Unusual[], now = new Date()): Notice | null {
  const since = new Date(+now - ASK_DAYS * 86_400_000).toISOString();
  const recent = odd.filter((x) => x.payment.occurred_at >= since);
  for (const ch of chapters.filter((c) => c.week)) {
    const u = recent.find((x) => ch.paymentIds.includes(x.payment.id));
    const claim = u && (ch.claims.find((c) => c.paymentIds.includes(u.payment.id)) ?? ch.claims[0]);
    if (!u || !claim) continue;
    return { chapterId: ch.id, claimId: claim.id, paymentId: u.payment.id, ...noticeText(u), paymentIds: [u.payment.id, ...[...u.earlier].reverse().map((p) => p.id)] };
  }
  return null;
}
