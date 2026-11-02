# PROGRESS
Hackathon: PayPal AI Hackathon (Devpost) · Deadline: 2026-11-13 03:00 WIB (Nov 12 12:00 PT) · Track: web2
Workflow: HACKATHON-WORKFLOW-V10.md
Phase: P3 Samples finished, P4 All pages next · Last gate passed: G3 (2026-11-02) · Waiting for user: no, the user starts P4 in a new chat (Sonnet 5.5 · medium)
Golden path: locked in docs/PLAN.md §1     App: Next.js scaffold and samples, localhost only (`npm run dev`, port 3000, may already be running)
Direction: sample 01 (`/samples/01`) with Bubbledot and strong dark fade, details in docs/DESIGN.md · logo public/assets/logo.webp · favicon app/icon.svg · video public/assets/bg.mp4
Sandbox: app `soul` on [redacted], buyer [redacted], keys in .env.local · Transaction Search saved in dashboard, API still 403 and scope missing at last check (recheck) · subscriptions ACTIVE since 2026-11-02, first charges made: Morning coffee [redacted], Bus fare [redacted], Weekly groceries [redacted], Mobile data [redacted]
Accounts: OpenRouter key `paypal-soul-app` in .env.local ($20 limit, expires 2027-01-31, verified) · GitHub ervhint/paypal-soul (private) · Supabase and Vercel not provided yet

Done: Devpost research · novelty check · old sandbox data checked (read-only) · G1 approved, details in docs/PLAN.md §1 · fresh sandbox created · P2 FigJam board (24 stories, 18 screens and states), links in docs/DESIGN.md · G2 approved · V9 Figma tiles replaced by V10 code samples · research notes in docs/DESIGN.md · G3 sample chosen · design references removed from git history and ignored (old commit 64c07d4 still opens on GitHub by exact ID)
Not done: repeat daily charges not yet seen · one-off purchases · actions and webhook not run · webinar videos not watched · plan docs/PLAN.md still describes old sandbox data under findings · sample hover effects, reduced motion and hidden-tab pause not tested

Check before the repo goes public: Bubbledot license is unconfirmed and it loads from OnlineWebFonts, Geist Pixel is the fallback · the user says the video is free to use, source or license not on file · PROGRESS.md lists sandbox emails and subscription IDs · add an open source license

Security: about 40 characters of what looks like the `soul` sandbox secret appeared in chat on 2026-11-02. Rotation is the user's call. When reading the app list page, don't use the page finder on that row.

Blockers: none
Stuck notes: none
Next action: P4 All pages from workflow V10: build every screen in docs/DESIGN.md as a clickable prototype in the sample 01 style. Recheck Transaction Search and further daily charges first, because the story depends on that data. Daily one-off purchases not set up yet. Agent doesn't sign in with passwords, including saved ones. Sample numbers are illustrative. The user approves every commit and push.
