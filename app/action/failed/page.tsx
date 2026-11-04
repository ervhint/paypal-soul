import Link from "next/link";
import { Receipt } from "@/components/ui";
import { PURCHASE, SEND } from "@/lib/action";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The order couldn't be made, or PayPal declined the capture (AC-9.5). Nothing moved either way.
export default async function FailedPage({ searchParams }: { searchParams: Promise<{ kind?: string; belief?: string; why?: string }> }) {
  const q = await searchParams;
  const buy = q.kind === "buy";
  const retry = buy ? "/buy" : q.belief && UUID.test(q.belief) ? `/action/confirm?belief=${q.belief}` : "/story";
  const why = q.why === "refused" ? "PayPal didn’t accept this payment, so it wasn’t made. If you typed an email, check it’s a sandbox account." : q.why === "declined" ? "PayPal declined the payment." : "PayPal’s sandbox didn’t answer in time.";
  return (
    <div className="wrap narrow">
      <Receipt stages={["Check", "Didn’t Go Through"]} now={1} bad amount={Number(buy ? PURCHASE.amount : SEND.amount)} title="That Didn&rsquo;t Go Through">
        <p className="lead">{why} Nothing moved, and your balance is the same. Your story hasn&rsquo;t changed.</p>
        <div className="row" style={{ marginTop: 24 }}>
          <Link className="btn" href={retry}>Try Again</Link>
          <Link className="btn dark" href="/story">Back to My Story</Link>
        </div>
      </Receipt>
    </div>
  );
}
