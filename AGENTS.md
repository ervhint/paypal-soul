# AGENTS

Soul for the PayPal AI Hackathon. Workflow: `HACKATHON-WORKFLOW-V11-CURRENT.md` (gitignored).
Status: `PROGRESS.md` · Plan: `docs/PLAN.md`

## Rules
- Commits and PRs carry no AI attribution: no `Co-Authored-By` trailer and no "Generated with" line.
- Before moving to another phase or unit, tell the user, name the model and effort, and wait for their reply.
- Claude in Chrome for all browser work: research, reading pages and docs, opening localhost, checking pages while building, screenshots, design reviews, console and network debugging, testing and Vercel checks. Never the built-in browser pane (`mcp__Claude_Browser__*`, including `preview_start`) or Playwright. During research only look: never sign in, submit forms or change anything. If Chrome isn't connected, say so and ask.
- PayPal sandbox only. Credentials stay in the gitignored `.env.local`.
- This is a fresh build. Don't copy code, scripts, data or settings from `paypal-soul-01` or the `VibeCoding` workspace.
- Repo: `ervhint/paypal-soul`, private until about Nov 12, then public under MIT. Steps are in `PROGRESS.md`, under Going public. CI is paused by GitHub billing, so local tests are the check.

## Stack
Next.js 16 (App Router) + TypeScript 7 + Tailwind 4 · BFF in Route Handlers (`app/api/*`) · Supabase Postgres with RLS and anonymous users · Vitest 5 · GitHub Actions · Vercel from P7.

## Commands
- `npm.cmd run dev`: localhost:3000 against Staging. PowerShell blocks `npm.ps1`, so use `npm.cmd` there (plain `npm` in Git Bash).
- `npm test`: `next typegen` (makes the gitignored `next-env.d.ts`, needed in CI), typecheck (`tsc --noEmit`), then Vitest (`tests/**/*.test.ts`). Integration tests hit the hosted Staging project with keys from `.env.local`. Run before every unit report and commit.
- `npm run build`: production build, also run in CI.
- `REAL=1 npx vitest run picker` (Git Bash): T-16.13's question list on the real picker, about $0.30, `ONLY=3,7` reruns those. `REAL=1 npx vitest run writer` reads whole answers. Costs money, so `npm test` never runs them.
- CI (`.github/workflows/ci.yml`, every push and PR): `npm test`, `npm run build`, and gitleaks over the full history. Needs GitHub secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` (Staging).
- Pre-commit hook: `.git/hooks/pre-commit` runs `gitleaks git --pre-commit --redact --staged --verbose`. Hooks aren't committed; recreate it on a new clone. Never `--no-verify`.

## Supabase
Org `ervhint` (free plan). Staging `puqcbsrprhuohuqmltdx` (localhost, Preview). Prod `nliwrfawcbvofhetsxja` (Production, untouched until P7, writes only with the user's yes). Schema changes are files in `supabase/migrations/`, applied to Staging with the Supabase MCP `apply_migration`, then replayed on Prod in P7. Never edit in the dashboard. Staging also holds the user's older objects (schemas `soul*`, edge functions, pg_cron jobs, old auth users): never change or delete them; Soul uses `public` only. ER diagram and RLS policies: `docs/PLAN.md` §3.

## Architecture
The browser talks only to the BFF. The BFF talks to PayPal, Supabase and OpenRouter. Each visitor is a Supabase anonymous user whose session lives in a cookie set by the BFF; BFF calls with that session go through RLS. The secret key is server only, for shared tables (accounts, payments, rows left out), captures and the daily job.

Folders:
- `app/` pages, `app/api/` BFF routes
- `components/` shared UI (`shell.tsx` header and menu, `ui.tsx` primitives)
- `lib/` server and shared code. `types.ts` is what the BFF sends the pages (the prototype store `mock.ts` is gone, U11). Built: `supabase.ts` (session and secret clients, U1), `session.ts` (session client from request cookies), `paypal.ts` (token, transactions; orders, capture with PayPal-Request-Id, U8), `import.ts` (31-day windows, rows left out, cursor, U2; a buyer row whose reference is a Soul capture is left out, U8), `categories.ts` (the user's fixed list, vague names, LLM pick, only uncategorised rows, U3), `llm.ts` (OpenRouter `askJson`, Haiku 5.5, payment text as data, token log, U3; `askTools`, Opus 5.5 with its fixed prompt cached, and `creditLeft`, U16), `totals.ts` (sums, repeats, habit sureness, weeks, U4; interests from repeated chosen categories, U13), `story.ts` (one chapter per week, rewritten only when its payments change; sentences need payments and code's figures; habits saved as beliefs, what the person told Soul laid over the payments, U4, U5; interests kept in line with the payments on every build, U13), `correct.ts` (correction read by the LLM, support or told belief, rewrite, Here's What Changed by code, Looks Right, U5; Undo puts back a saved copy of the beliefs and chapters, no LLM call, U12), `chat.ts` (the picker, Opus 5.5 at low effort, calls functions for up to 3 rounds; the writer, Haiku 5.5, words the answer from their results; amounts checked against the results, the list under an answer built from the payments behind the figures it states, at most 60 rows to the LLM with a note past 60, last 10 questions and answers, 300 characters and 5 a day, Chat stops with $2 left on the key, U7, U16; a request to cancel gets code's reply pointing to PayPal's settings, U14 cut), `chat-functions.ts` (Chat's 24 read-only functions, their parameters and checks, each figure keeping the payments behind it, U16), `action.ts` (Buy Something Small order, capture once on return, story open or daily job, payment owned by the person, new chapter from the capture, U8; send money from a support belief to Soul's test account or another sandbox email, $25.00 fixed, the payment kept as money for that person, suggestion under the support chapter, U9), `connect.ts` (consent link, Check Connection from what PayPal says, account ID kept only after a read works, minimum for a story, Log Out deletes the own account, U10), `forget.ts` (Delete My Data deletes the anonymous user, which cascades to everything Soul keeps for them; daily job: captures, then imports every readable account, then deletes people last seen 30 days or more ago with no connected sandbox, U11), `pay-list.ts` (20 rows at a time and category totals for a long payment list), `memory.ts` (all beliefs, edit saved as a correction in the person's words, Stop Using This and Use Again, each rewriting the belief's weeks first, U6)
- `supabase/migrations/` SQL migrations
- `tests/` Vitest unit and integration tests

BFF routes:
| Route | Does | Unit |
| --- | --- | --- |
| `GET/POST/DELETE /api/connect` | data in use; choose prepared (makes the anonymous person) or own; `step` consent gives PayPal's link, check is Check Connection; log out of own sandbox (real) | U1, U10 |
| `GET /api/story`, `DELETE /api/story` | chapters, claims, evidence, totals, beliefs, rows left out, sync state, Here's What Changed, actions, send money suggestion under a support chapter (real); dismiss Here's What Changed (real) | U2, U4, U5, U8, U9 |
| `POST /api/sync` | Refresh From PayPal on open and Refresh: captures this person's approved orders, reads only past the cursor, categorises new payments, then rewrites this person's changed weeks, even when PayPal fails (real) | U2, U3, U4, U8 |
| `POST/PATCH/DELETE /api/correct` | correction, clarifying question, rewritten chapter; Looks Right; Undo (real) | U5, U12 |
| `GET/PATCH /api/memory` | all beliefs and their payments; edit, Stop Using This, Use Again (real) | U6 |
| `GET/POST /api/chat` | history; POST streams lines of JSON, each step as it happens and then the answer or refusal (real) | U7, U16 |
| `GET/POST /api/action` | status, captures an approved order (a refused capture is failed), `cancelled=1` from PayPal's cancel link; `?belief=` what the confirm page offers; create the purchase or send money order (real) | U8, U9 |
| `DELETE /api/me` | Delete My Data: clears the session cookies, then deletes the person with their own sandbox link and its payments (real) | U11 |
| `GET /api/cron` | daily job with `CRON_SECRET` (`vercel.json`, 03:00 UTC): captures, imports, 30-day cleanup; its queries keep Supabase awake (real) | U8, U11 |

Env vars (names in `.env.example`, all server only, never `NEXT_PUBLIC_`): `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (app `soul`, orders), `PAYPAL_PLATFORM_CLIENT_ID`, `PAYPAL_PLATFORM_CLIENT_SECRET` (consent and reading), `PAYPAL_PREPARED_ACCOUNT_ID` (our sandbox buyer behind the prepared data), `PAYPAL_SEND_RECIPIENT` (Soul's test account that send money pays by default, the second sandbox personal account), `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `DEV_ORIGIN` (optional, the laptop's IP so a phone on the same Wi-Fi can use `next dev`). `.env.local` also keeps the `_PROD` Supabase values and sandbox test logins for P7 and manual tests; the app doesn't read those.

## Conventions
- UI copy uses Title Case for headings, labels, buttons, tags, chips and short status text. Full sentences stay in sentence case. Use `titleCase` from `lib/title-case.ts` for names that come from data.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
