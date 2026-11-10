# Soul

Your money has a story.

PayPal gives you a list of payments. That list tells you what happened, but not what it meant. You can't easily see your habits, who you've been helping out, or what changed this month. Soul reads your PayPal sandbox payments and writes them up as a short story, one chapter per week. It remembers what you tell it, and when it gets something wrong, you can correct it and it rewrites the chapter.

I built this for the PayPal AI Hackathon. It runs on the PayPal sandbox only, so every account and every dollar in it is fake.

**Live:** https://paypal-soul.vercel.app

## Trying it

On the first screen you get two choices:

- **Try it with our prepared data.** One click. You get your own private copy of a sandbox account I filled with a few weeks of payments: coffee, bus fares, groceries, some money sent to family.
- **Log in with PayPal.** Connect your own sandbox personal account through PayPal's consent page. Soul needs a handful of payments before it has anything to say. If there aren't enough, it tells you what's missing.

You don't sign up. Soul remembers you through your browser, and **Delete My Data** in the menu removes everything it kept about you. People who leave and never come back are cleaned up after 30 days.

A quick tour:

1. Open the story. Soul starts with something it noticed.
2. Tap any sentence to see the payments behind it, with their PayPal transaction IDs.
3. Correct it. Something like "those groceries are for my mum". The chapter is rewritten, and you can see what changed. Undo if you change your mind.
4. Ask Chat a question. It answers from your payments and from what you've told it, and lists the payments it used.
5. Buy something small, or send money from the Memory page. You approve it on PayPal, and a new chapter shows up.

## What it does

- **Story.** Weekly chapters. Every sentence is tied to real payments, and the amounts come from code, not from the model.
- **Noticing.** It points out habits, and asks about a payment that's much bigger than usual.
- **Corrections.** You tell it what something really was. It updates what it believes and rewrites the weeks that belief touches. A one-off ("that was a birthday gift") stays a one-off.
- **Memory.** Everything Soul believes about you, in one place. You can edit a belief, stop it from being used, or tell Soul something about yourself.
- **Chat.** Read-only questions over your payments: totals, people, categories, your balance. It won't move money from Chat. It points you to Memory for that.
- **Actions.** Buy Something Small and Send Money, both in the sandbox, both confirmed by you on PayPal.

Soul works alongside PayPal. It doesn't replace anything there, and it never changes your PayPal settings.

## How it's built

- Next.js 16 (App Router), TypeScript, Tailwind 4
- The browser only talks to Soul's own server routes (`app/api/*`). Those talk to PayPal, Supabase and the model, so keys never reach the browser.
- Supabase Postgres with row level security. Each visitor is an anonymous Supabase user, so one person can't read another's rows.
- PayPal sandbox REST APIs: Transaction Search for reading, Orders for buying and sending, a webhook for payments that finish while the tab is closed
- OpenRouter for the model calls: a small fast model for categories, the story and chat answers, and a stronger one for picking which of Chat's read-only functions to call
- Vercel for hosting, with a daily job at 03:00 UTC that captures approved orders, imports new payments and cleans up old visitors
- Vitest for the tests

The longer version, with the database diagram and the rules for each table, is in [`docs/PLAN.md`](docs/PLAN.md).

## Running it yourself

You'll need Node 20.9 or newer, two PayPal sandbox apps (one for orders, one Platform app for consent), a Supabase project and an OpenRouter key.

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`. Every variable is explained in [`.env.example`](.env.example). They're all server only. Then apply the migrations in `supabase/migrations/` to your Supabase project, in order.

```bash
npm run dev
```

The app opens at http://localhost:3000.

## Tests

```bash
npm test
```

This runs the typecheck and then the Vitest suite. The integration tests use a real Supabase project, with the keys from `.env.local`. A few tests call the real model, cost a little money, and only run when you ask for them with `REAL=1`. See `AGENTS.md` for the list.

## License

MIT. See [`LICENSE`](LICENSE).
