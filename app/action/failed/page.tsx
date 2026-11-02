import Link from "next/link";

export default function FailedPage() {
  return (
    <div className="wrap narrow">
      <span className="badge bad"><i className="fa-solid fa-xmark" aria-hidden="true" /></span>
      <h1 className="display" style={{ marginTop: 20, fontSize: "clamp(32px, 4.6vw, 54px)" }}>That Didn&rsquo;t Go Through</h1>
      <p className="lead">PayPal&rsquo;s sandbox didn&rsquo;t answer in time. Nothing moved, and your balance is the same. Your story hasn&rsquo;t changed.</p>
      <div className="row" style={{ marginTop: 28 }}>
        <Link className="btn" href="/action/confirm">Try Again</Link>
        <Link className="btn dark" href="/story">Back to My Story</Link>
      </div>
    </div>
  );
}
