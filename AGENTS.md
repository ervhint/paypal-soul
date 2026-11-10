# AGENTS

Soul for the PayPal AI Hackathon. Workflow: `HACKATHON-WORKFLOW-V12-OPUS.md` (gitignored). Opus 5.5 only, medium effort by default, high at most.
Status: `PROGRESS.md` · Plan: `docs/PLAN.md`

## Rules
- Commits and PRs carry no AI attribution: no `Co-Authored-By` trailer and no "Generated with" line.
- Before moving to another phase or unit, tell the user, name the model and effort, and wait for their reply.
- Claude in Chrome for all browser work: research, reading pages and docs, opening localhost, checking pages while building, screenshots, design reviews, console and network debugging, testing and Vercel checks. Never the built-in browser pane (`mcp__Claude_Browser__*`, including `preview_start`) or Playwright. During research only look: never sign in, submit forms or change anything. If Chrome isn't connected, say so and ask.
- Write every answer to the user simply: gate and unit reports, questions, summaries and quick replies. Answer first, then only the details they need. Short sentences, everyday words, one idea per sentence. Explain a technical term in a few words the first time. Keep file names, commands and code exact.
- PayPal sandbox only. Credentials stay in the gitignored `.env.local`.
- This is a fresh build. Don't copy code, scripts, data or settings from `paypal-soul-01` or the `VibeCoding` workspace.
- Repo: `ervhint/paypal-soul`, private until about Nov 12, then public under MIT. Steps are in `PROGRESS.md`, under Going public. CI is paused by GitHub billing, so local tests are the check.

## Stack
Next.js 16 (App Router) + TypeScript 7 + Tailwind 4 · BFF in Route Handlers (`app/api/*`) · Supabase Postgres with RLS and anonymous users · Vitest 5 · GitHub Actions · Vercel from P7.

## Commands
- `npm.cmd run dev`: localhost:3000 against Staging. PowerShell blocks `npm.ps1`, so use `npm.cmd` there (plain `npm` in Git Bash).
- `npm test`: `next typegen` (makes the gitignored `next-env.d.ts`, needed in CI), typecheck (`tsc --noEmit`), then Vitest (`tests/**/*.test.ts`). Integration tests hit the hosted Staging project with keys from `.env.local`. Run before every unit report and commit.
- `npm run build`: production build, also run in CI.
- `REAL=1 npx vitest run picker` (Git Bash): T-16.13's question list on the real picker, about $0.30, `ONLY=3,7` reruns those. `REAL=1 npx vitest run writer` reads whole answers. `REAL=1 npx vitest run correction` scores one-off against broader corrections, about $0.01. `REAL=1 npx vitest run remember` scores when Chat offers Remember This? (50 lines), about $0.20. Costs money, so `npm test` never runs them.
- CI (`.github/workflows/ci.yml`, every push and PR): `npm test`, `npm run build`, and gitleaks over the full history. Needs GitHub secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` (Staging).
- Pre-commit hook: `.git/hooks/pre-commit` runs `gitleaks git --pre-commit --redact --staged --verbose`. Hooks aren't committed; recreate it on a new clone. Never `--no-verify`.

## Supabase
Org `ervhint` (free plan). Staging `puqcbsrprhuohuqmltdx` (localhost, Preview). Prod `nliwrfawcbvofhetsxja` (Production, untouched until P7, writes only with the user's yes). Schema changes are files in `supabase/migrations/`, applied to Staging with the Supabase MCP `apply_migration`, then replayed on Prod in P7. Never edit in the dashboard. Staging also holds the user's older objects (schemas `soul*`, edge functions, pg_cron jobs, old auth users): never change or delete them; Soul uses `public` only. ER diagram and RLS policies: `docs/PLAN.md` §3.

## Architecture
The browser talks only to the BFF. The BFF talks to PayPal, Supabase and OpenRouter. Each visitor is a Supabase anonymous user whose session lives in a cookie set by the BFF; BFF calls with that session go through RLS. The secret key is server only, for shared tables (accounts, payments, rows left out), captures and the daily job.

Folders:
- `app/` pages, `app/api/` BFF routes
- `components/` shared UI (`shell.tsx` header and menu, `ui.tsx` primitives, `send-form.tsx` the Send Money form on Memory, U21)
- `lib/` server and shared code. `types.ts` is what the BFF sends the pages (the prototype store `mock.ts` is gone, U11). Built: `supabase.ts` (session and secret clients, U1), `session.ts` (session client from request cookies), `paypal.ts` (token, transactions; orders, capture with PayPal-Request-Id, U8), `import.ts` (31-day windows, rows left out, cursor, U2; a buyer row whose reference is a Soul capture is left out, U8), `categories.ts` (the user's fixed list, vague names, LLM pick, only uncategorised rows, U3), `llm.ts` (OpenRouter `askJson`, Haiku 5.5, payment text as data, token log, U3; `askTools`, Opus 5.5 with its fixed prompt cached, and `creditLeft`, U16), `totals.ts` (sums, repeats, habit sureness, weeks, U4; interests from repeated chosen categories, U13; `unusual`, a payment much bigger than the usual for its name or person, shared by the story and Chat, U18), `story.ts` (one chapter per week, rewritten only when its payments change; sentences need payments and code's figures; habits saved as beliefs, what the person told Soul laid over the payments, U4, U5; interests kept in line with the payments on every build, U13), `correct.ts` (correction read by the LLM, support or told belief, rewrite, Here's What Changed by code, Looks Right, U5; Undo puts back a saved copy of the beliefs and chapters, no LLM call, U12; a correction that singles out a one-time payment becomes its own one-off belief, `oneoff:<payment id>`, and the broader belief keeps its text, U17), `chat.ts` (the picker, Opus 5.5 at low effort, calls functions for up to 3 rounds; the writer, Haiku 5.5, words the answer from their results; amounts checked against the results, the list under an answer built from the payments behind the figures it states, at most 60 rows to the LLM with a note past 60, last 10 questions and answers, 300 characters and 5 a day, Chat stops with $2 left on the key, U7, U16; a request to cancel gets code's reply pointing to PayPal's settings, U14 cut), `chat-functions.ts` (Chat's 24 read-only functions, their parameters and checks, each figure keeping the payments behind it, U16), `action.ts` (Buy Something Small order, capture once on return, story open or daily job, payment owned by the person, new chapter from the capture, U8; send money to Soul's test account or another sandbox email, $1.00 to $100.00 checked on the server, the payment kept as money for that person, U9, U18; since U21 it starts from Memory with no support belief needed, and typed accounts are saved per person in `send_account`), `connect.ts` (consent link, Check Connection from what PayPal says, account ID kept only after a read works, minimum for a story, Log Out deletes the own account, U10), `forget.ts` (Delete My Data deletes the anonymous user, which cascades to everything Soul keeps for them; daily job: captures, then imports every readable account, then deletes people last seen 30 days or more ago with no connected sandbox, U11), `send.ts` (the people Memory offers Send Money for, and Chat's line pointing a request to send money to Memory, unsaved and uncounted, U21), `notice.ts` (the I Noticed card under the newest chapter with an unexplained unusual payment, written by code; Tell Soul is a correction on that payment, Same as Usual a `check` belief `unusual:<payment id>` that Memory and Chat never show, U18), `remember.ts` (Chat's Remember This? card: the picker may propose one belief, code checks it, it rides on the answer in `chat_message.remember`, and only the person's Remember tap saves it, like a correction or a preference, source You Told Me in Chat, U20), `pay-list.ts` (20 rows at a time and category totals for a long payment list), `webhook.ts` (PayPal's notices for `soul`: signature checked with PayPal on the raw body, then an approved or captured order made in Soul is settled like a return, U15), `memory.ts` (all beliefs, edit saved as a correction in the person's words, Stop Using This and Use Again, each rewriting the belief's weeks first, U6; a preference is handed to `about.ts`), `about.ts` (Tell Soul About You: a `preference` belief in the person's words with no payments, its topic and listed categories read by Haiku as data, an amount dropped, 200 characters and 10 per person; save, edit, stop, use again and delete each rewrite the weeks with payments in its categories first; the story names it only citing those payments, an interest in its category becomes Sure and You Told Me, Chat reads it as "they told you about themselves", U19)
- `supabase/migrations/` SQL migrations
- `tests/` Vitest unit and integration tests

BFF routes:
| Route | Does | Unit |
| --- | --- | --- |
| `GET/POST/DELETE /api/connect` | data in use; choose prepared (makes the anonymous person) or own; `step` consent gives PayPal's link, check is Check Connection; log out of own sandbox (real) | U1, U10 |
| `GET/PATCH/DELETE /api/story` | chapters, claims, evidence, totals, beliefs, rows left out, sync state, Here's What Changed, actions, the I Noticed card (real); Same as Usual (real); dismiss Here's What Changed (real) | U2, U4, U5, U8, U9, U18 |
| `POST /api/sync` | Refresh From PayPal on open and Refresh: captures this person's approved orders, reads only past the cursor, categorises new payments, then rewrites this person's changed weeks, even when PayPal fails (real) | U2, U3, U4, U8 |
| `POST/PATCH/DELETE /api/correct` | correction, clarifying question, rewritten chapter; Looks Right; Undo (real) | U5, U12 |
| `GET/POST/PATCH/DELETE /api/memory` | all beliefs and their payments, and the people Send Money is offered for with their latest send; Tell Soul About You; edit, Stop Using This, Use Again; delete a preference (real) | U6, U19, U21 |
| `GET/POST/PATCH /api/chat` | history; POST streams lines of JSON, each step as it happens and then the answer or refusal, with a Remember This? card when the person told Soul something; a request to send money gets code's line pointing to Memory; PATCH is Remember or Not Now on a card (real) | U7, U16, U20, U21 |
| `GET/POST /api/action` | status, captures an approved order (a refused capture is failed), `cancelled=1` from PayPal's cancel link; `?accounts=1` what Memory's send form offers; create the purchase, or a send from who, how much and the account, saving a typed account for that person (real) | U8, U9, U21 |
| `DELETE /api/me` | Delete My Data: clears the session cookies, then deletes the person with their own sandbox link and its payments (real) | U11 |
| `POST /api/paypal-webhook` | PayPal's CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED for `soul`: signature checked, then the order settled (capture once, new chapter); off without `PAYPAL_WEBHOOK_ID`. `/story` reads `/api/story` every 5s while an order waits (real) | U15 |
| `GET /api/cron` | daily job with `CRON_SECRET` (`vercel.json`, 03:00 UTC): captures, imports, 30-day cleanup; its queries keep Supabase awake (real) | U8, U11 |

Env vars (names in `.env.example`, all server only, never `NEXT_PUBLIC_`): `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (app `soul`, orders), `PAYPAL_PLATFORM_CLIENT_ID`, `PAYPAL_PLATFORM_CLIENT_SECRET` (consent and reading), `PAYPAL_PREPARED_ACCOUNT_ID` (our sandbox buyer behind the prepared data), `PAYPAL_SEND_RECIPIENT` (Soul's test account that send money pays by default, the second sandbox personal account), `PAYPAL_WEBHOOK_ID` (the `soul` app's webhook, P7; unset turns the webhook off), `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `DEV_ORIGIN` (optional, the laptop's IP so a phone on the same Wi-Fi can use `next dev`). `.env.local` also keeps the `_PROD` Supabase values and sandbox test logins for P7 and manual tests; the app doesn't read those.

## Conventions
- UI copy uses Title Case for headings, labels, buttons, tags, chips and short status text. Full sentences stay in sentence case. Use `titleCase` from `lib/title-case.ts` for names that come from data.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
