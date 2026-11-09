import Link from "next/link";
import { Receipt } from "@/components/ui";
import { PURCHASE, SEND, sendAmount } from "@/lib/action";

// The order couldn't be made, or PayPal declined the capture (AC-9.5). Nothing moved either way.
export default async function FailedPage({ searchParams }: { searchParams: Promise<{ kind?: string; why?: string; amount?: string }> }) {
  const q = await searchParams;
  const buy = q.kind === "buy";
  const sent = sendAmount(q.amount) ?? SEND.amount; // the amount the person picked (U18)
  const retry = buy ? "/buy" : "/memory"; // a send starts on Memory (U21)
  const why = q.why === "refused" ? "PayPal didn’t accept this payment, so it wasn’t made. If you typed an email, check it’s a sandbox account." : q.why === "declined" ? "PayPal declined the payment." : "PayPal’s sandbox didn’t answer in time.";
  return (
    <div className="wrap narrow">
      <Receipt stages={["Check", "Didn’t Go Through"]} now={1} bad amount={Number(buy ? PURCHASE.amount : sent)} title="That Didn&rsquo;t Go Through">
        <p className="lead">{why} Nothing moved, and your balance is the same. Your story hasn&rsquo;t changed.</p>
        <div className="row" style={{ marginTop: 24 }}>
          <Link className="btn" href={retry}>Try Again</Link>
          <Link className="btn dark" href="/story">Back to My Story</Link>
        </div>
      </Receipt>
    </div>
  );
}
