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

Stack, commands and conventions get added here once verified.

## Conventions
- UI copy uses Title Case for headings, labels, buttons, tags, chips and short status text. Full sentences stay in sentence case. Use `titleCase` from `lib/title-case.ts` for names that come from data.
