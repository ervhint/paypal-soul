# DESIGN

- FigJam (stories, page flow): https://www.figma.com/board/4MmmM8pMStHjAejPvQj856
- Figma style tiles (made under workflow V9, replaced by the code samples under V10): https://www.figma.com/design/EeWaUIKSULuHzVq9atOZla

## Reference checklists (P3a)
Routes: `/samples/01`, `/samples/02`, `/samples/03`. Status after the browser check is in the G3 section below.

**01, from `DESIGN-REFERENCE-01.md`**
- Assets: CloudFront background video, Font Awesome 6.5.2, `logo.webp` (not supplied), Geist Pixel Circle.
- Fonts: Inter 400/500/600, BubbledotICG-FinePos, Geist Pixel fallback.
- Colors: the 11 variables in the spec.
- Layout: one viewport with header (logo, white nav pill, dark sign-in), hero (trust row, two-line headline, subhead, glowing CTA), four stats.
- Motion: header slide-down, per-line headline fade, shared blur reveal, CTA pulse, stat count-up, hovers, reduced motion.
- Breakpoints: 720 (burger, overlay, sheet menu, 2-column stats), 420, height 700.

**02, from `DESIGN-REFERENCE-02.md`**
- Assets: four webp icons on CloudFront.
- Fonts: Inter Tight 400/500.
- Colors: ink, cream, four gradient sets with glows, four tints.
- Layout: 1440x960 unit scale, hero panel 75%, nav, cycling headline, store-style buttons with caption, strip with S-curve notch, scroll hint, three stats, sprout.
- Motion: one clock, 1.75s slots, word enter and leave, icon pop and float, panel crossfade, gradient drift, first button fill in slot four, hidden tab pause, reduced motion still.
- Breakpoints: 760. Effects: SVG grain, grey icon with masked colour tint.

**03, from `DESIGN-REFERENCE-03.md`**
- Assets: ship photo through images.higgs.ai, inline SVG marks.
- Fonts: Inter Tight 400/500/600, Georgia for one wordmark.
- Colors: tokens and canvas colours in the spec.
- Layout: fixed pill nav, hero with headline, trust line, CTA and 4x2 grid, pinned statement, dark split.
- Motion: canvas bowl glow with scroll table and intro, letter reveal (load and scroll), statement rise, nav CTA pop, dot-to-arrow hover, ship zoom, row fade.
- Breakpoints: 820, no sideways scroll at 390.

## Research for app pages (P3c, Nov 2)
Only a Copilot Money marketing mockup was seen as a screen. ChatGPT is from help text, and Perplexity showed only its question box. US-13, US-17 and US-21 have no precedent here, so they are designed from scratch.
- [Copilot Money](https://www.copilot.money/): adopt one proposed change in plain words with a quiet Dismiss beside a clear Approve (US-12, US-19). Adapt its "To review" queue for uncertain beliefs (US-14). Avoid one-tap approval without recipient and amount (US-19).
- [ChatGPT memory](https://help.openai.com/en/articles/8590148-memory-in-chatgpt): adopt edit, correct a part, and stop using this (US-14). Adapt a sources list under each reply (US-07, US-16). Avoid hiding beliefs or being vague about what a control does (US-14).
- [Perplexity](https://www.perplexity.ai/hub/blog/introducing-perplexity-deep-research): adapt one-line labels for chat actions (US-16), a small point.

## Chosen direction (G3)
Sample 01, with Bubbledot and a strong dark fade over the video (added for headline contrast, not in the reference). Bubbledot's license is unconfirmed and it loads from OnlineWebFonts: check before shipping, with Geist Pixel as the fallback.

## Sample notes (G3)
Payment numbers in the samples are illustrative, not real sandbox values.

Content changed from the references (P3b):
- 01: Soul copy and stats. Brand logos became coffee, bus and basket icons, and "Trusted by" became "Soul noticed this today". The background video is now a project copy at `public/assets/bg.mp4`, which the user says is free to use. The logo is the user's `public/assets/logo.webp`. It is pale pink, so its circle is `#28282a` instead of the spec's white.
- 02: words are Ask, Notice, Correct, Explore. Store buttons became Read My Story and See It Change with line icons. Icons, panel colours and motion are unchanged.
- 03: Soul copy. The partner wordmarks became everyday payments and PayPal pieces. The ship photo stays and does not fit the product, so it needs a decision.
- 03 on phones: cells with no icon keep their text, because the spec would leave them empty.

## Golden path
S-01 → S-02 → S-03 → S-04 → S-05 → S-07 → S-07a → S-10 → S-13 → PayPal → S-02c → S-08 → S-13 → PayPal → S-09

Stories in order: US-01, US-05, US-07, US-12, US-13, US-16, US-23, US-10, US-18, US-19, US-20.

## Screen inventory
| ID | Name | Stories |
| --- | --- | --- |
| S-01 | Welcome, one-click entry | US-01, US-02, US-04, US-24 |
| S-02 | Story home, opens on what Soul noticed | US-03, US-05, US-06, US-08, US-09, US-18 |
| S-02a | Story syncing or empty | US-06 |
| S-02b | PayPal unavailable, last saved story | US-06 |
| S-02c | New chapter | US-10, US-11, US-20 |
| S-03 | Evidence panel | US-07 |
| S-04 | Correction | US-12 |
| S-04a | Clarifying question | US-12 |
| S-05 | Rewritten chapter, what changed | US-13, US-15 |
| S-06 | Memory | US-14 |
| S-07 | Chat | US-16 |
| S-07a | Answer with citations | US-16 |
| S-07b | No evidence reply | US-17 |
| S-08 | Confirm action | US-19, US-22 |
| S-09 | Action complete | US-20 |
| S-09a | Action failed, nothing moved | US-21 |
| S-10 | Sandbox purchase, hands off to PayPal | US-23 |
| S-11 | About the sandbox and what a real launch needs | US-04 |

## Tokens (P4)
In `app/globals.css`. Black page over `public/assets/bg.mp4` with a flat 80% dark layer on app pages (the hero keeps the sample's gradient). Text white, soft `#d0d0d0`, muted `#9a9a9a`. Pills `#28282a`, white nav pill, white glowing primary button. Panels `rgba(18,18,20,.9)` with a 16% white line. One accent, `#f4c7d4` (from the logo), used only for what was rewritten or is new. Fonts: Bubbledot for headings (Geist Pixel fallback), Inter for text. Motion: sample 01's reveal, header slide and button pulse, plus a rise on page and new chapters. Reduced motion stops all of it and pauses the video.

## Routes and screens (P4)
| Screen | Where |
| --- | --- |
| S-01 | `/`, two options: prepared data, or Log in with PayPal with the minimum-data note |
| S-12 | `/connect`: before PayPal, Check connection, and `?state=pending`, `denied`, `little`, `empty` (each offers the prepared data) |
| S-13 | `/action/status?id=`: PayPal link, waiting, cancelled, link ran out, for send money and purchases |
| S-14 | "Why are some rows missing?" sheet on `/story`, with the rows left out |
| S-15 | Delete my data, on `/memory`, removes only that person's data |
| S-02, S-02c | `/story` (new chapter appears after a purchase or a sent payment) |
| S-02a, S-02b | `/story?state=syncing`, `?state=offline`, and `?state=empty` (prototype links at the bottom of the page, removed in P6) |
| S-03, S-04, S-04a | evidence sheet on `/story`: tap a sentence, "That's not right", then a question if no person is named |
| S-05 | "Here's what changed" panel on `/story` after a correction |
| S-06 | `/memory` |
| S-07, S-07a, S-07b | `/chat` (ask about flights for the no-evidence reply) |
| S-08, S-09, S-09a | `/action/confirm`, `/action/done`, `/action/failed` (failure through the prototype link on the confirm page) |
| S-10 | `/buy`, then S-13, then back to `/story` with the new chapter once paid |
| S-11 | `/about` |

Mock data comes from BFF routes under `app/api/*`, backed by `lib/mock.ts` (in memory, cleared by Delete my data). Transaction IDs, the fee on done and the rows left out are prototype values.

## Image list (P4)
No screen needs a new picture. Every screen uses the background video, the logo, and Font Awesome icons (coffee, bus, basket, carrot, signal, paper plane). Nothing is blank or dropped. Ask if you want photos or illustrations on any page.

## Review log (P4b, Nov 2)
design-critic verdict: FAIL on the first pass. Fixed and rechecked in Chrome at desktop width:
- Fixed: the page entrance animation trapped the sheet, toast and chat box inside the page column. Pink now marks only what changed or is new (rewritten sentence, changed stats, "Updated" memory row), not "Not sure" or the failure icon. After a correction the rewritten chapter comes first, with the diff folded into one line. Headline no longer repeats the first sentence. Prototype state links moved to About. The success page redirects if nothing was sent, and names the recipient. The loading skeleton matches the page layout. "Use again" stays at full strength. Chat placeholder and starter wording tidied.
- Not changed, your call: the three overlapping icons and the four-stat band on the welcome page come straight from reference 01 (rule 21). The critic calls the icons a "trusted by" pattern. The inner pages share one template (eyebrow, pixel title, lead, rows), so only the font carries the identity there. Not rechecked at 375px after the fixes except in an iframe.
