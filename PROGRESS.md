# PROGRESS
Hackathon: PayPal AI Hackathon (Devpost) · Deadline: 2026-11-13 03:00 WIB (Nov 12 12:00 PT) · Track: web2
Workflow: HACKATHON-WORKFLOW-V10.md
Phase: P4 redo not started (prototype built on the old plan, not approved at G4) · Last gate passed: G1 re-approved (2026-11-02) · Waiting for user: no, the user starts a new chat on Opus 5.5 · medium
Golden path: locked in docs/PLAN.md §1     App: Next.js scaffold and samples, localhost only (`npm run dev`, port 3000, may already be running)
Prototype: all 18 screens on localhost, routes and states in docs/DESIGN.md, mock data in lib/mock.ts via app/api/*. Direction: sample 01 (`/samples/01`) with Bubbledot and strong dark fade, details in docs/DESIGN.md · logo public/assets/logo.webp · favicon app/icon.svg · video public/assets/bg.mp4
Sandbox: app `soul` on [redacted], buyer [redacted], second personal [redacted], new Platform app on [redacted] for consent, keys in .env.local · Transaction Search API returns 200 with scope present (2026-11-02) · subscriptions ACTIVE since 2026-11-02, first charges made: Morning coffee [redacted], Bus fare [redacted], Weekly groceries [redacted], Mobile data [redacted]
Accounts: OpenRouter key `paypal-soul-app` in .env.local ($20 limit, expires 2027-01-31, verified) · GitHub ervhint/paypal-soul (private) · Supabase and Vercel not provided yet

Done: P4 prototype of all 18 screens on the OLD plan (one-click prepared buyer, mock data in lib/mock.ts), critic findings fixed, see docs/DESIGN.md · Devpost research · novelty check · old sandbox data checked (read-only) · G1 approved, details in docs/PLAN.md §1 · fresh sandbox created · P2 FigJam board (24 stories, 18 screens and states), links in docs/DESIGN.md · G2 approved · V9 Figma tiles replaced by V10 code samples · research notes in docs/DESIGN.md · G3 sample chosen · design references removed from git history and ignored (old commit 64c07d4 still opens on GitHub by exact ID)
Not done: repeat daily charges not yet seen · $1 send money test not yet checked in report rows · buyer's PayPal activity page not compared with report rows · cancel action and webhook not run · webinar videos not watched · sample hover effects, reduced motion and hidden-tab pause not tested

Check before the repo goes public: Bubbledot license is unconfirmed and it loads from OnlineWebFonts, Geist Pixel is the fallback · the user says the video is free to use, source or license not on file · PROGRESS.md lists sandbox emails and subscription IDs · add an open source license

Security: about 40 characters of what looks like the `soul` sandbox secret appeared in chat on 2026-11-02. Rotation is the user's call. When reading the app list page, don't use the page finder on that row.

Reminder: before finishing deployment in P7, remind the user to create a second PayPal developer login and test consent and read with an account from it.
Reminder: at the end of P5, before P6, remind the user to create Supabase Staging and Prod projects, give the profile or org name and both refs, put keys in .env.local, connect the plugin through /mcp, and name the Vercel team.

Private findings: read `FINDINGS.local.md` (gitignored) before continuing.

Blockers: none
Stuck notes: none
Next action: redo P4 in a new chat, on Opus 5.5 · medium, then the G4 review. G1 re-approved on the new plan, docs/PLAN.md §1 and decisions log: prepared data or Log in with PayPal (sandbox-marked, PayPal's colors, opens the consent page through the Platform app, keys PAYPAL_PLATFORM_CLIENT_ID and PAYPAL_PLATFORM_CLIENT_SECRET in .env.local). Screens to change: entry with the minimum-data note, too-little-data and empty-account messages, Check connection, About with the differences from PayPal, "Why?" explanation with the rows left out, PayPal transaction ID on evidence, confirm and buy without "sandbox buyer", recipient picker, PayPal fee on done, and waiting, cancelled and link states for payments. Also recheck the $1 send money in report rows. The user approves every commit and push.
