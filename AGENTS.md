# AGENTS

Soul for the PayPal AI Hackathon. Workflow: `HACKATHON-WORKFLOW-V11-CURRENT.md` (gitignored).
Status: `PROGRESS.md` · Plan: `docs/PLAN.md`

## Rules
- Commits and PRs carry no AI attribution: no `Co-Authored-By` trailer and no "Generated with" line.
- Before moving to another phase or unit, tell the user, name the model and effort, and wait for their reply.
- Claude in Chrome for all browser work: research, reading pages and docs, opening localhost, checking pages while building, screenshots, design reviews, console and network debugging, testing and Vercel checks. Never the built-in browser pane (`mcp__Claude_Browser__*`, including `preview_start`) or Playwright. During research only look: never sign in, submit forms or change anything. If Chrome isn't connected, say so and ask.
- PayPal sandbox only. Credentials stay in the gitignored `.env.local`.
- This is a fresh build. Don't copy code, scripts, data or settings from `paypal-soul-01` or the `VibeCoding` workspace.
- Repo: `ervhint/paypal-soul`, private. It must be public with an open source license before submission.

## Stack
Next.js 16 (App Router) + TypeScript 7 + Tailwind 4 · BFF in Route Handlers (`app/api/*`) · Supabase Postgres with RLS and anonymous users · Vitest 5 · GitHub Actions · Vercel from P7.

## Commands
- `npm.cmd run dev`: localhost:3000 against Staging. PowerShell blocks `npm.ps1`, so use `npm.cmd` there (plain `npm` in Git Bash).
- `npm test`: `next typegen` (makes the gitignored `next-env.d.ts`, needed in CI), typecheck (`tsc --noEmit`), then Vitest (`tests/**/*.test.ts`). Integration tests hit the hosted Staging project with keys from `.env.local`. Run before every unit report and commit.
- `npm run build`: production build, also run in CI.
- CI (`.github/workflows/ci.yml`, every push and PR): `npm test`, `npm run build`, and gitleaks over the full history. Needs GitHub secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` (Staging).
- Pre-commit hook: `.git/hooks/pre-commit` runs `gitleaks git --pre-commit --redact --staged --verbose`. Hooks aren't committed; recreate it on a new clone. Never `--no-verify`.

## Supabase
Org `ervhint` (free plan). Staging `puqcbsrprhuohuqmltdx` (localhost, Preview). Prod `nliwrfawcbvofhetsxja` (Production, untouched until P7, writes only with the user's yes). Schema changes are files in `supabase/migrations/`, applied to Staging with the Supabase MCP `apply_migration`, then replayed on Prod in P7. Never edit in the dashboard. Staging also holds the user's older objects (schemas `soul*`, edge functions, pg_cron jobs, old auth users): never change or delete them; Soul uses `public` only. ER diagram and RLS policies: `docs/PLAN.md` §3.

## Architecture
The browser talks only to the BFF. The BFF talks to PayPal, Supabase and OpenRouter. Each visitor is a Supabase anonymous user whose session lives in a cookie set by the BFF; BFF calls with that session go through RLS. The secret key is server only, for shared tables (accounts, payments, rows left out), captures and the daily job.

Folders:
- `app/` pages, `app/api/` BFF routes
- `components/` shared UI (`shell.tsx` header and menu, `ui.tsx` primitives)
- `lib/` server and shared code. `mock.ts` is the prototype store; each unit replaces its part and `mock.ts` goes when empty. Built: `supabase.ts` (session and secret clients, U1), `session.ts` (session client from request cookies), `paypal.ts` (token, transactions; orders and captures in U8), `import.ts` (31-day windows, rows left out, cursor, U2), `categories.ts` (the user's fixed list, vague names, LLM pick, only uncategorised rows, U3), `llm.ts` (OpenRouter `askJson`, Haiku 5.5, payment text as data, token log, U3). Planned: `totals.ts` (sums, repeats, habit sureness, U4), `story.ts` (chapters and claims, U4)
- `supabase/migrations/` SQL migrations
- `tests/` Vitest unit and integration tests

BFF routes (now on mock data unless marked):
| Route | Does | Unit |
| --- | --- | --- |
| `GET/POST/DELETE /api/connect` | data in use; choose prepared (makes the anonymous person) or own; consent link, Check Connection; log out of own sandbox | U1, U10 |
| `GET /api/story`, `DELETE /api/story` | chapters, claims, evidence, totals, rows left out, sync state; dismiss Here's What Changed | U2, U4, U5 |
| `POST /api/sync` | Refresh From PayPal on open and Refresh, reads only past the cursor, then categorises new payments (real) | U2, U3 |
| `POST /api/correct` | correction, clarifying question, rewritten chapter | U5 |
| `GET/PATCH /api/memory` | beliefs; edit or Stop Using This | U6 |
| `GET/POST /api/chat` | history; grounded answer with limits | U7 |
| `GET/POST/PATCH /api/action` | status; create sandbox order; capture or settle | U8, U9 |
| `DELETE /api/me` (planned) | Delete My Data | U11 |
| `GET /api/cron` (planned) | daily job with `CRON_SECRET`: import, captures, 30-day cleanup, keep Supabase awake | U11 |
| `POST /api/reset` | prototype only, removed with `mock.ts` | — |

Env vars (names in `.env.example`, all server only, never `NEXT_PUBLIC_`): `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (app `soul`, orders), `PAYPAL_PLATFORM_CLIENT_ID`, `PAYPAL_PLATFORM_CLIENT_SECRET` (consent and reading), `PAYPAL_PREPARED_ACCOUNT_ID` (our sandbox buyer behind the prepared data), `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`. `.env.local` also keeps the `_PROD` Supabase values and sandbox test logins for P7 and manual tests; the app doesn't read those.

## Conventions
- UI copy uses Title Case for headings, labels, buttons, tags, chips and short status text. Full sentences stay in sentence case. Use `titleCase` from `lib/title-case.ts` for names that come from data.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
