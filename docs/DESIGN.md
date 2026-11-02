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
S-01 → S-02 → S-03 → S-04 → S-05 → S-07 → S-07a → S-10 → PayPal checkout → S-02c → S-08 → S-09

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
