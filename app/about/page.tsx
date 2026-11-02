export const metadata = { title: "About the sandbox · Soul" };

export default function AboutPage() {
  return (
    <div className="wrap narrow">
      <p className="eyebrow">About this demo</p>
      <h1 className="display" style={{ marginTop: 12, fontSize: "clamp(32px, 4.6vw, 54px)" }}>The sandbox, and what a real launch needs</h1>
      <div className="about">
        <section>
          <h2>What you&rsquo;re looking at</h2>
          <p>Every payment in Soul comes from PayPal&rsquo;s sandbox: test accounts and test money. The &ldquo;sandbox buyer&rdquo; is not a real person. Nothing here touches a real PayPal account.</p>
        </section>
        <section>
          <h2>What is real</h2>
          <ul>
            <li>The payments are read from PayPal&rsquo;s Transaction Search.</li>
            <li>The purchase and the money you send run through PayPal&rsquo;s sandbox.</li>
            <li>Soul keeps what it believes about you, and every claim points to payments.</li>
          </ul>
        </section>
        <section>
          <h2>What a real launch needs</h2>
          <p>PayPal does not let an app read a person&rsquo;s payment history today. Log in with PayPal shares identity only. Soul would need PayPal to grant that access, with the person&rsquo;s consent, before it could work on real accounts.</p>
        </section>
        <section>
          <h2>Demo controls</h2>
          <p>Preview the story in other states: <a className="link" href="/story?state=syncing">syncing</a> · <a className="link" href="/story?state=offline">PayPal unavailable</a> · <a className="link" href="/story?state=empty">no payments</a>. These links go when the real app is built.</p>
        </section>
      </div>
    </div>
  );
}
