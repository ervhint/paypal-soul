# PROGRESS
Hackathon: PayPal AI Hackathon (Devpost) · Deadline: 2026-11-13 03:00 WIB (Nov 12 12:00 PT) · Track: web2
Workflow: HACKATHON-WORKFLOW-V10.md
Phase: G1 REOPENED, P4 paused (prototype built, not approved at G4) · Last gate passed: G3 (2026-11-02) · Waiting for user: no, the user starts a new chat on Opus 5.5 · high
Golden path: locked in docs/PLAN.md §1     App: Next.js scaffold and samples, localhost only (`npm run dev`, port 3000, may already be running)
Prototype: all 18 screens on localhost, routes and states in docs/DESIGN.md, mock data in lib/mock.ts via app/api/*. Direction: sample 01 (`/samples/01`) with Bubbledot and strong dark fade, details in docs/DESIGN.md · logo public/assets/logo.webp · favicon app/icon.svg · video public/assets/bg.mp4
Sandbox: app `soul` on [redacted], buyer [redacted], keys in .env.local · Transaction Search API returns 200 with scope present (2026-11-02) · subscriptions ACTIVE since 2026-11-02, first charges made: Morning coffee [redacted], Bus fare [redacted], Weekly groceries [redacted], Mobile data [redacted]
Accounts: OpenRouter key `paypal-soul-app` in .env.local ($20 limit, expires 2027-01-31, verified) · GitHub ervhint/paypal-soul (private) · Supabase and Vercel not provided yet

Done: P4 prototype of all 18 screens on the OLD plan (one-click prepared buyer, mock data in lib/mock.ts), critic findings fixed, see docs/DESIGN.md · Devpost research · novelty check · old sandbox data checked (read-only) · G1 approved, details in docs/PLAN.md §1 · fresh sandbox created · P2 FigJam board (24 stories, 18 screens and states), links in docs/DESIGN.md · G2 approved · V9 Figma tiles replaced by V10 code samples · research notes in docs/DESIGN.md · G3 sample chosen · design references removed from git history and ignored (old commit 64c07d4 still opens on GitHub by exact ID)
Not done: repeat daily charges not yet seen · one-off purchases · actions and webhook not run · webinar videos not watched · plan docs/PLAN.md still describes old sandbox data under findings · sample hover effects, reduced motion and hidden-tab pause not tested

Check before the repo goes public: Bubbledot license is unconfirmed and it loads from OnlineWebFonts, Geist Pixel is the fallback · the user says the video is free to use, source or license not on file · PROGRESS.md lists sandbox emails and subscription IDs · add an open source license

Security: about 40 characters of what looks like the `soul` sandbox secret appeared in chat on 2026-11-02. Rotation is the user's call. When reading the app list page, don't use the page finder on that row.

Blockers: none
Stuck notes: none
Next action: reopen P1. Judges will use their OWN PayPal sandbox accounts, not our prepared buyer or mock data (user, 2026-11-02). First check in Chrome whether PayPal sandbox lets an app read another account's payments (Log in with PayPal looked identity-only; options are judge-supplied sandbox app keys or another consent route, unverified). Then grill, decide the fallback for a judge account with little data, and rewrite docs/PLAN.md §1 (golden path step 1, Won't list, sandbox findings). After G1, redo the sign-in, welcome and About screens in the prototype; story, memory, chat and action screens mostly stay but read the judge's data. The user approves every commit and push.
