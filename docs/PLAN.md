# PLAN

## 1. Context & golden path (draft for G1)

**Soul: your money has a story.** PayPal shows a person a list of payments. Soul turns them into a story that remembers, notices things first, and changes its mind when you correct it.

**Problem:** a payment list records what happened, not what it meant. People can't see their habits, the people they support, or what changed, and a chat over payment data answers one question and starts over next time.

**User:** anyone who uses PayPal. Judges can connect their own sandbox account or use our prepared data. The demo video follows the prepared person so the impact case stays concrete.

**Differentiator:** chat over MCP answers and moves on. Soul keeps beliefs about you tied to real payments, speaks up first, and rewrites its story when you correct it.

### Golden path (60–90 seconds)
1. Open Soul and choose: **Try it with our prepared data** (one click) or **Log in with PayPal**, in PayPal's colors and clearly marked sandbox (it opens PayPal's consent page). The note above the second button states the minimum data. An account below it gets an explanation and the offer of prepared data.
2. Soul opens with something it noticed, inside a story chapter.
3. Tap a sentence to see the sandbox payments behind it.
4. Correct it ("those groceries are for my mum"). The chapter rewrites and shows what changed. **The wow moment.**
5. Ask a question in chat. The answer uses the correction and cites payments.
6. A new sandbox payment is made on camera, and a new chapter appears.
7. Soul suggests an action. The user confirms, and it runs in the sandbox and joins the story.

### Scope
| Tier | What |
| --- | --- |
| Must | Two entry options · PayPal consent connection with Check connection · sandbox sync on open, refresh and one daily job · automatic categories from the user's list · story chapters · evidence on every claim with the PayPal transaction ID · "Why are some rows missing?" explanation, the rows left out, and an About section on differences from PayPal · Proactive Noticing · Revising Understanding · Richer Memory · limited Habit Recognition · grounded chat · one confirmed action (send money) · Delete my data |
| Should | Interests & Preferences · second action (cancel a subscription) · webhook for live chapters on purchases inside Soul |
| Could | Pasted sandbox app keys, only if consent fails for another developer's accounts |
| Won't | Reading real people's PayPal history · PayPal's identity-only login API · Web3 · ChatGPT or hosted MCP chat · AG Grid · APIMatic · real money |

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
- Must stay testable, free, until Dec 15, 2026. Judges have no AI key, so we host the demo. Judges use their own sandbox login, or none with the prepared data.

### Sandbox facts
- Payments keep their real dates, so bulk seeding can't create a habit. Prepared history comes from daily subscriptions. Only first charges are seen so far, and it should meet the minimum about Nov 9 if charges repeat.
- All prepared payments go to one merchant, `Test Store`, so the story follows what was bought, not who was paid.
- Send money and cancel subscription haven't been run. Consent lists payment, refund and fee permissions, not payouts, so sending from a judge's connected account is unproven.
- A real launch still needs PayPal's approval for production access. The README and pitch must say so.
- Hosted sandbox MCP has an open bug (paypal/agent-toolkit#119), so we use REST or the Agent Toolkit on the server.

### Judge account access (tested Nov 2 on our `soul` app)
- Log in with PayPal scopes are `openid`, `profile`, `email`, `address` and account attributes. None gives payments.
- Partner referral with `THIRD_PARTY` and `ACCESS_MERCHANT_INFORMATION` returned 403 NOT_AUTHORIZED on `soul`, likely because it isn't a Platform app.
- `paypal-soul-01` notes (Oct 23-26, not retested here) show a consent route on a sandbox Platform app, with no partner enrollment: referral link 201, then the account approves on PayPal. Reported: a business account and personal account A read 200 with matching transactions, personal B stayed 403 after approving, personal C never reached a read. Its working app was US, Expanded Checkout off, Mixed intent. PayPal bundled payment, refund and fee permissions into the consent, and the return to localhost failed, so it added a Check Connection button.
- Retested Nov 2 on a new Platform app: two sandbox accounts approved, and each read returned its own account (our buyer 9 rows, the other 0). Names are in `transaction_subject`. Filter T1900 and T0300 rows. An account from a different developer login is untested.
- App keys work as a backup: Transaction Search returned our app's business account rows. A second account's keys are untested, and a judge's app may need Transaction Search turned on.
- Rows are the merchant's view: first charges show as T0002 with a payer. A T1900 $5,000 row must be filtered out. Item name came back blank on subscription charges, so names may need a lookup through the subscription.
- 32 days or more in one request returns 400, so 90 days means several requests of 31 days or less.
- Supabase free plan: pauses after 1 week of inactivity, 2 active projects. Both Staging and Prod use those 2 slots, so keep the demo active with a scheduled ping or use a paid plan.

### Novelty check (Nov 2)
| Closest | What it does | Gap |
| --- | --- | --- |
| [MyBudgetNerd](https://mybudgetnerd.com) | Statement PDFs, "Financial Story", Ask Oracle Q&A. Maintained. | Generic uploads, no PayPal, no actions |
| [SpendTel](https://www.producthunt.com/p/spendtel/spendtel) | Uploaded statements become AI financial stories | No chat mentioned |
| [Goalmatic Bank Statement Wrap](https://www.producthunt.com/products/goalmatic-end-of-year-bank-summary) | Year-end Wrapped with personas | One-off recap, low traction |

Also near: [Salah](https://salah-liart.vercel.app/#/overview), merchant intelligence on synthetic data with evidence labels, a copilot and updates. Its footer refers to Paytm. This hackathon's gallery isn't public, so current entries are unchecked.

### Open questions
- "Send money" moves the connected judge's own sandbox money (user, Nov 2), through an order paying the recipient, which the judge approves on PayPal. A $1 test on Nov 2 completed: our buyer paid the second account, funded by the buyer's bank, and PayPal took a $0.52 fee, so the recipient got $0.48. It's a merchant-style payment, so the done screen must show the real fee. Recipient must be a sandbox email the judge picks or a prefilled test account. Not yet seen in the report rows, recheck after 3 hours.
- A second developer login is untested, to be tested before deployment finishes.
- Supabase profile with Staging and Prod refs and the Vercel team are needed before P6. Remind the user at the end of P5. Check whether free projects pause when idle, since the demo must stay up until Dec 15.

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
| Nov 2 | Entry screen has two options: prepared data with one click, or the judge's own sandbox account. How the second one connects depends on the access check. | Judges can use their own account, and nobody hits a dead end |
| Nov 2 | Connecting uses PayPal consent through the new sandbox Platform app. Prepared data uses the same route with our buyer, so there's no buyer flip. Replaces the one-click prepared buyer as the only entry and the merchant-side reading. | Passed on 2 accounts, and judges share no keys |
| Nov 2 | Own account needs payments spanning at least 7 days, 5 or more payments, and at least 1 repeat. The note sits above the button and in the README. Below that, Soul says what's missing and offers the prepared data. Numbers can change after testing. | Soul needs history for a story, and sandbox payments can't be backdated |
| Nov 2 | `paypal-soul-01` may be read as reference only, no copying (user). Payment naming follows its idea: item, subject and note first, event code for mechanics only, then AI picks from a fixed category list, with `unknown` when evidence is thin. | The user's earlier work solved this, but the code is messy |
| Nov 2 | Use the user's own detailed category list from `paypal-soul-01` (the user's list, so reuse is approved). Every new payment is categorised automatically on import and saved. Code does totals and repeat counts, and the LLM writes the story. | Detailed now avoids a painful change later, labels stay consistent, and sums don't depend on the LLM. AI cost is fine for the hackathon. |
| Nov 2 | Import runs on open and refresh. One daily scheduled job also imports for connected accounts and keeps Supabase awake. | New payments are ready without a visit, and one job covers both needs |
| Nov 2 | Consent is the main route. A second developer login stays untested for now, and must be tested before deployment finishes. | The user accepts the risk and will create the login later |
| Nov 2 | Send money and purchases give the user a PayPal link and don't block Soul. The action stays "waiting" until paid. Soul completes approved orders on return, on open and in the daily job, and only completed payments join the story. | The user keeps moving, and the story never claims a payment that didn't happen |
| Nov 2 | Read back up to about 90 days (limit to confirm), then add new payments on each visit or refresh. Purchases inside Soul use the checkout result directly. | The story keeps growing without re-reading everything. Webhooks on a judge's app wouldn't reach us. |
| Nov 2 | On prepared data, reading needs no login, but approving a payment on PayPal needs the person's own sandbox login. Soul shares no test login. Without one, nothing moves and the rest of Soul still works. | The user's choice. Nobody else can use our buyer's account. |
| Nov 2 | Read back up to about 6 months (limit to confirm). Replaces the 90 days above. The story shows the newest 5 chapters, with Show Older Chapters added in the build phase. | The user looks back about 6 months, and categories are only worked out once per payment |
| Nov 2 | The header shows which data is in use and opens a menu: Prepared Data, My Sandbox or Log In With PayPal, and Log Out of My Sandbox. Switching needs no logout, and each one keeps its own memory and chat. | A logged-in user can try prepared data and come back |
| Nov 2 | Chat history is saved. The LLM gets the last 10 questions and answers, saved memory, and only the totals and payments code finds for the question. Questions are limited to 300 characters and 30 per person per day (can change after testing), with no thread limit. Logged-in chats stay until Delete My Data, prepared-data chats go 30 days after the last visit. | Cost stays flat however long the chat gets, and the $20 OpenRouter limit needs protecting from spam |
| Nov 2 | Delete My Data removes only that person's data, and on prepared data never the shared payments. | One person must not reset the demo for others |
| Nov 2 | Supabase stores payment copies, chapters, corrections, memory and chat per judge. Prepared payments are shared, memory stays private. With consent, Soul stores only the judge's PayPal account ID, no keys or tokens. Add "Delete my data". | Evidence stays stable, and a leak can't expose judge keys |
