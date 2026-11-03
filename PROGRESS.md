# PROGRESS
Hackathon: PayPal AI Hackathon (Devpost) · Deadline: 2026-11-13 03:00 WIB (Nov 12 12:00 PT) · Track: web2
Workflow: HACKATHON-WORKFLOW-V11-CURRENT.md (from 2026-11-03, during P5)
Phase: P6 Build, U0 committed, U1 next · Last gate passed: G5 approved (2026-11-03) · Waiting for user: yes, open a new chat for U1
Golden path: locked in docs/PLAN.md §1     App: Next.js 16 prototype, localhost only. Start it with `npm.cmd run dev` (PowerShell blocks `npm.ps1`, don't change the execution policy), port 3000, may already be running in the user's Terminal tab. POST `/api/reset` restores the mock data if the seed changed. The hidden browser pane pauses CSS animations, so run `document.getAnimations().forEach(a=>a.finish())` before judging a screenshot.
Prototype: all 18 screens on localhost, routes and states in docs/DESIGN.md, mock data in lib/mock.ts via app/api/*. Direction: sample 01 (`/samples/01`) with Bubbledot and strong dark fade, details in docs/DESIGN.md · logo public/assets/logo.webp · favicon app/icon.svg · video public/assets/bg.mp4
Sandbox: app `soul` on our business account, our buyer, a second personal account, and a new Platform app on another business account for consent. Account emails and subscription IDs are in `FINDINGS.local.md`, keys in .env.local · Transaction Search API returns 200 with scope present (2026-11-02) · subscriptions ACTIVE since 2026-11-02, first charges made: Morning coffee, Bus fare, Weekly groceries, Mobile data
Accounts: OpenRouter key `paypal-soul-app` in .env.local ($20 limit, expires 2027-01-31, verified) · GitHub ervhint/paypal-soul (private) · Supabase org `ervhint` (free): Staging `puqcbsrprhuohuqmltdx`, Prod `nliwrfawcbvofhetsxja` (untouched until P7) · Vercel team `ervhint`

| Build phase | Unit | Status | Tests | Notes |
| --- | --- | --- | --- | --- |
| A Setup | U0 skeleton, tests, architecture | committed | T-0.2–T-0.7 ✅, NF-4 ✅, T-0.1 on push | approved 2026-11-03, migration `init` on Staging, GitHub secrets set |
| B Enter and read | U1 entry, private copy, data menu | todo | — | |
| B Enter and read | U2 PayPal import, rows left out | todo | — | |
| B Enter and read | U3 automatic categories | todo | — | |
| B Enter and read | U4 story, noticing, habits, evidence | todo | — | |
| C Correct | U5 correction, rewritten chapter | todo | — | |
| C Correct | U6 Memory page | todo | — | built after U9 |
| D Ask | U7 grounded chat | todo | — | |
| E New chapter and action | U8 purchase, new chapter | todo | — | |
| E New chapter and action | U9 send money | todo | — | |
| F Own sandbox and data | U10 connect own sandbox | todo | — | |
| F Own sandbox and data | U11 Delete My Data, daily job | todo | — | |
| G Shoulds | U12–U15 | todo | — | only if time allows, cut first at ~Nov 9 evening |

Done: U0 (2026-11-03): `npm test`, GitHub Actions CI with gitleaks, pre-commit hook, schema `init` with RLS on Staging, architecture in AGENTS.md and PLAN §3 · P5 build plan (docs/PLAN.md §2–6, 16 units, glossary at top) and test plan (docs/TESTS.md, 79 rows), G5 approved 2026-11-03 · workflow moved to V11 during P5 · P4 redo on the new plan (entry with two options, /connect, /action/status, rows left out, recipient picker, fee, data menu, Delete My Data, Title Case, short-screen fix, chat scroll fix) · P4 prototype of all 18 screens on the OLD plan (one-click prepared buyer, mock data in lib/mock.ts), critic findings fixed, see docs/DESIGN.md · Devpost research · novelty check · old sandbox data checked (read-only) · G1 approved, details in docs/PLAN.md §1 · fresh sandbox created · P2 FigJam board (24 stories, 18 screens and states), links in docs/DESIGN.md · G2 approved · V9 Figma tiles replaced by V10 code samples · research notes in docs/DESIGN.md · G3 sample chosen · design references removed from git history and ignored (old commit 64c07d4 still opens on GitHub by exact ID)
Not done: repeat daily charges not yet seen · $1 send money test not yet checked in report rows · buyer's PayPal activity page not compared with report rows · cancel action and webhook not run · webinar videos not watched · sample hover effects, reduced motion and hidden-tab pause not tested · design-critic did not review the last round of fixes · Memory edit form at phone width, the pink highlight in a real recording, and real phones not checked

Check before the repo goes public: Bubbledot license is unconfirmed and it loads from OnlineWebFonts, Geist Pixel is the fallback · the user says the video is free to use, source or license not on file · sandbox emails and subscription IDs were removed from PROGRESS.md and rewritten out of git history on 2026-11-03 (old commit 5bc4cdd and its parents may still open on GitHub by exact ID) · add an open source license

Security: about 40 characters of what looks like the `soul` sandbox secret appeared in chat on 2026-11-02. Rotation is the user's call. When reading the app list page, don't use the page finder on that row.

Reminder: before finishing deployment in P7, remind the user to create a second PayPal developer login and test consent and read with an account from it.
Reminder: in P7, turn on anonymous sign-ins on Prod too, and set its auth URLs.

Private findings: read `FINDINGS.local.md` (gitignored) before continuing.

Staging leftovers: the user's earlier Codex trial (`paypal-soul-01`) left schemas `soul`, `soul_w2`, `soul_mcp_check`, `soul_w2_identity_check`, 9 edge functions, 2 pg_cron jobs and 42 auth users on Staging. The user said (2026-11-03): keep using this project but never touch any of that; the user's other agent stops the cron jobs. Our tables live in `public` only. Prod is untouched, per the user.

Blockers: none
Stuck notes: none
Next action: U1 (entry, private copy, data menu) in a new chat on Sonnet 5.5 · medium, or Opus 5.5 · medium for the anonymous session. U1 adds `@supabase/ssr` and `lib/supabase.ts`, and checks whether server-side anonymous sign-ins share one IP rate limit once on Vercel (forward the visitor IP or raise Auth → Rate Limits). Still open in PLAN §6: daily charge repeats (check Nov 3–4), the $1 send money row, the prefilled recipient on prepared data. The user approves every commit and push.
