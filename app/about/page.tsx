import Link from "next/link";

export const metadata = { title: "About the Sandbox · Soul" };

export default function AboutPage() {
  return (
    <div className="wrap narrow">
      <p className="eyebrow">About This Demo</p>
      <h1 className="display" style={{ marginTop: 12, fontSize: "clamp(32px, 4.6vw, 54px)" }}>The Sandbox, and How Soul Works With PayPal</h1>
      <div className="about">
        <section>
          <h2>What You&rsquo;re Looking At</h2>
          <p>Every payment in Soul comes from PayPal&rsquo;s sandbox: test accounts and test money. You&rsquo;re reading either our prepared data, which follows a made-up person, or your own sandbox account. Soul never reads a real PayPal account.</p>
        </section>
        <section>
          <h2>What Is Real</h2>
          <ul>
            <li>The payments are read from PayPal&rsquo;s Transaction Search, after the account approves on PayPal&rsquo;s consent page.</li>
            <li>The purchase and the money you send run through PayPal&rsquo;s sandbox, and you approve each one on PayPal.</li>
            <li>Soul keeps what it believes about you, and every claim points to payments with their PayPal transaction IDs.</li>
          </ul>
        </section>
        <section id="differences">
          <h2>How Soul Uses Your PayPal Data</h2>
          <ul>
            <li>Soul leaves out rows that aren&rsquo;t purchases, such as balance corrections and bank funding rows. Counting them would double your spending. You can see them under &ldquo;Why Are Some Rows Missing?&rdquo; on your story.</li>
            <li>A new payment can take up to 3 hours to reach PayPal&rsquo;s report. Purchases made inside Soul show up right away.</li>
            <li>Soul reads back about 6 months, then adds new payments as they come.</li>
            <li>Categories and totals are Soul&rsquo;s own, and your corrections can change them. PayPal&rsquo;s records don&rsquo;t change.</li>
            <li>When you send money, PayPal treats it as a merchant-style payment and takes a fee from what the other person receives. Soul shows that fee.</li>
          </ul>
        </section>
        <section id="data">
          <h2>Your Data</h2>
          <p>If you connect your account, Soul stores its PayPal account ID, copies of your payments, chapters, corrections, memory and chat, until you delete them. It stores no keys or tokens. On the prepared data, your corrections, memory and chat are private to you and go 30 days after your last visit. Deleting never touches the prepared payments.</p>
          <div className="row" style={{ marginTop: 14 }}>
            <Link className="btn dark small" href="/memory">Delete My Data</Link>
            <Link className="btn line small" href="/connect?state=check">Check Connection</Link>
          </div>
        </section>
        <section>
          <h2>What a Real Launch Needs</h2>
          <p>Soul runs on PayPal&rsquo;s sandbox only. Reading real accounts would need:</p>
          <ul>
            <li>PayPal&rsquo;s approval for production access. Consent works in the sandbox today, but Soul can&rsquo;t read real accounts until PayPal grants it, and each person would still approve it themselves.</li>
            <li>Live PayPal app keys, kept apart from the sandbox ones.</li>
            <li>A privacy policy and terms that say what Soul keeps and for how long.</li>
            <li>Real sign-in, so a story follows a person across devices instead of one browser.</li>
          </ul>
        </section>
        <section>
          <h2>Demo Controls</h2>
          <p>Preview connecting: <a className="link" href="/connect?state=pending">Not Approved Yet</a> · <a className="link" href="/connect?state=denied">Approved, Can&rsquo;t Read</a> · <a className="link" href="/connect?state=little">Too Little Data</a> · <a className="link" href="/connect?state=empty">Empty Account</a>. These links go when the real app is built.</p>
        </section>
      </div>
    </div>
  );
}
