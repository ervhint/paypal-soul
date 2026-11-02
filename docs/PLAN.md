# PLAN

## 1. Context & golden path (draft for G1)

**Soul: your money has a story.** PayPal shows a person a list of payments. Soul turns them into a story that remembers, notices things first, and changes its mind when you correct it.

**Problem:** a payment list records what happened, not what it meant. People can't see their habits, the people they support, or what changed, and a chat over payment data answers one question and starts over next time.

**User:** anyone who uses PayPal. The demo follows one specific person so the impact case stays concrete.

**Differentiator:** chat over MCP answers and moves on. Soul keeps beliefs about you tied to real payments, speaks up first, and rewrites its story when you correct it.

### Golden path (60–90 seconds)
1. Open Soul and enter as the prepared sandbox person with one click. No login, no transaction list.
2. Soul opens with something it noticed, inside a story chapter.
3. Tap a sentence to see the sandbox payments behind it.
4. Correct it ("those groceries are for my mum"). The chapter rewrites and shows what changed. **The wow moment.**
5. Ask a question in chat. The answer uses the correction and cites payments.
6. A new sandbox payment is made on camera, and a new chapter appears.
7. Soul suggests an action. The user confirms, and it runs in the sandbox and joins the story.

### Scope
| Tier | What |
| --- | --- |
| Must | Sandbox sync · story chapters · evidence on every claim · Proactive Noticing · Revising Understanding · Richer Memory · limited Habit Recognition · grounded chat · one confirmed action (send money) |
| Should | Interests & Preferences · second action (cancel a subscription) · webhook for live chapters |
| Could | Log in with PayPal for identity only |
| Won't | Reading real people's PayPal history · Web3 · ChatGPT or hosted MCP chat · AG Grid · APIMatic · real money |

### Judging and prizes
| Criterion or prize | What serves it |
| --- | --- |
| Technological Implementation | Reporting, Payouts, Subscriptions, webhooks and an AI agent with long-term memory |
| Design | A story instead of a list, with a designed correction moment |
| Potential Impact | One specific person's story, and a clear statement of what a real launch needs |
| Innovation/Idea | Memory that visibly changes its mind |
| Presentation, Best Demo Delivery | Correction and live chapter on camera |
| Best Use of PayPal + AI | PayPal data and actions drive every AI step |
| Best Use of Agentic Commerce | Confirmed actions that move sandbox money |
| Most Creative, Most Impactful, Grand prizes | Automatic entries |

A project can win one Grand or Honorable Mention prize, plus one Sponsor prize. No sponsor tool is planned.

### Hackathon facts
- https://paypalaihackathon.devpost.com/ · Deadline Nov 12, 2026 12:00 PT = Nov 13, 03:00 WIB. Optional early check if submitted by Nov 5, with editing open until the deadline.
- Must submit: description, working demo, tools used, public repo with a detected open source license, public YouTube video under 3 minutes. Name PayPal and AI in all of them.
- Must stay testable, free, until Dec 15, 2026. Judges have no AI key, so we host the demo. Give judges any sandbox logins they need.

### Sandbox findings (tested Nov 2, read-only, on old accounts we won't use)
- Daily plans work: plans set to 1 DAY × 2 charged at signup and again about a day later (10 charges across 5 subscriptions).
- The app `Platform Partner ...80204` (US business sandbox account) holds old test data: 170 transactions, 5 invoices, 5 plans, 1 product, 0 disputes, with labels like "Controlled item". The other two apps hold only an opening balance.
- Reporting, Payouts and identity scopes are on. Transaction Search returned 200.
- **It is a merchant's view of one customer.** Everyday purchases (morning coffee, bus fare, groceries, lunch, mobile data) are T0006 money **in**, from 1 distinct payer. Outgoing rows are refunds, withdrawals, mass payouts and T2002 (meaning unconfirmed), not the person's spending.
- **Consumer model:** read the merchant-side records and tell them from the payer's side, flipping direction. All purchases currently share one merchant, so "who was paid" comes from item names unless more merchant apps are used.
- **Timing:** 154 of 170 rows fall on Oct 26–27, and nothing is newer than Oct 29. Payments keep their real dates, so bulk seeding can't create a habit. New data must be spread over days.
- Mass payouts (T0001) and subscription payments (T0002) already exist, so both actions look feasible. Cancelling would run with the merchant's credentials. Neither has been run by us.
- Log in with PayPal scopes cover identity only. No route to a real person's history found, so a real launch needs PayPal to grant that access. The README and pitch must say so.
- Hosted sandbox MCP has an open bug (paypal/agent-toolkit#119), so we use REST or the Agent Toolkit on the server.

### Novelty check (Nov 2)
| Closest | What it does | Gap |
| --- | --- | --- |
| [MyBudgetNerd](https://mybudgetnerd.com) | Statement PDFs, "Financial Story", Ask Oracle Q&A. Maintained. | Generic uploads, no PayPal, no actions |
| [SpendTel](https://www.producthunt.com/p/spendtel/spendtel) | Uploaded statements become AI financial stories | No chat mentioned |
| [Goalmatic Bank Statement Wrap](https://www.producthunt.com/products/goalmatic-end-of-year-bank-summary) | Year-end Wrapped with personas | One-off recap, low traction |

Also near: [Salah](https://salah-liart.vercel.app/#/overview), merchant intelligence on synthetic data with evidence labels, a copilot and updates. Its footer refers to Paytm. This hackathon's gallery isn't public, so current entries are unchecked.

### Open questions
- Supabase profile with Staging and Prod refs and the Vercel team are needed before P6.

## 5. Decisions log
| Date | Decision | Why |
| --- | --- | --- |
| Nov 2 | Web2, solo, sandbox data only | No crypto prize. The user wants no made-up history. |
| Nov 2 | Individual customers, not sellers | More unique, and the sandbox data already supports it |
| Nov 2 | Own chat with Vercel AI SDK and OpenRouter | User has OpenRouter credit. Hosted MCP is unreliable and judges shouldn't need setup. |
| Nov 2 | AG Grid and APIMatic dropped | Extra work with no product benefit. APIMatic proposal not approved. |
| Nov 2 | New private repo `ervhint/paypal-soul` | User wanted a fresh start. It goes public with a license before submission. |
| Nov 2 | No AI attribution on commits or PRs | User's instruction |
| Nov 2 | All browser work uses Claude in Chrome | Workflow rule 19 |
| Nov 2 | Each judge gets a private copy of memory | One judge's correction must not change the story for the next |
| Nov 2 | Fresh sandbox buyer, merchant and app. Old accounts, data and `paypal-soul-01` tools are not used. | The user wants a clean build. Old data has test labels and bulk days, so little is lost. Replaces the earlier choice to reuse the old person. |
| Nov 2 | Daily history comes from subscriptions, plus occasional one-off checkouts | The buyer approves once and PayPal then charges by itself each day |
