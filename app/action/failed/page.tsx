import Link from "next/link";
import { Receipt } from "@/components/ui";

export default async function FailedPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const buy = (await searchParams).kind === "buy";
  return (
    <div className="wrap narrow">
      <Receipt stages={["Check", "Didn\u2019t Go Through"]} now={1} bad amount={buy ? 18 : 25} title="That Didn&rsquo;t Go Through">
        <p className="lead">PayPal&rsquo;s sandbox didn&rsquo;t answer in time. Nothing moved, and your balance is the same. Your story hasn&rsquo;t changed.</p>
        <div className="row" style={{ marginTop: 24 }}>
          <Link className="btn" href={buy ? "/buy" : "/action/confirm"}>Try Again</Link>
          <Link className="btn dark" href="/story">Back to My Story</Link>
        </div>
      </Receipt>
    </div>
  );
}
