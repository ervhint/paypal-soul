# DESIGN

- FigJam (stories, page flow): https://www.figma.com/board/4MmmM8pMStHjAejPvQj856
- Figma design file: https://www.figma.com/design/EeWaUIKSULuHzVq9atOZla (page `P3 Style tiles`)

## Design references (direction only, no brand or asset copied)
- `DESIGN-REFERENCE-01.md`: black page, dot-matrix headline, pill nav, soft glow button, counted stats, video background.
- `DESIGN-REFERENCE-02.md`: grainy pastel panel that changes colour, huge tight grotesk, glossy icon, cream strip with curved notch.
- `DESIGN-REFERENCE-03.md`: sky-cyan bowl glow, navy on white, letter-by-letter reveal, dark split panel, dot that grows into an arrow.

## Research (P3b, Nov 2)
Based on public text pages only. No real product screens were seen, and the Perplexity citation point is from memory.
- [Copilot Money](https://www.copilot.money/): adopt "never acts without your approval" (US-19). Adapt explaining a single charge, opening on the evidence and not a fresh chat (US-07, US-16). Avoid its dashboard-and-list framing (US-05, US-06).
- [Perplexity](https://www.perplexity.ai/hub/blog/introducing-perplexity-deep-research): adopt numbered citations on chat claims (US-16). Avoid citing many sources to look rigorous. Say plainly when no payments match (US-17).
- [NotebookLM](https://support.google.com/notebooklm/answer/14276468): adapt answers grounded only in the given sources (US-07, US-17). No precedent found for a visible belief view (US-14).
- [Readwise Reader](https://readwise.io/read), taste: adopt the quiet reading page with evidence on tap (US-06, US-07). Adapt inline assistance for corrections (US-12, US-13). Avoid keyboard triage that hides confirmation (US-19, US-21).

## Directions for G3
- A. Receipt Light: Doto + Hanken Grotesk. The story is set in dot matrix, like a till slip.
- B. Weather: Bricolage Grotesque + Newsreader. Each chapter has a colour, and a correction changes it.
- C. Coming Into Focus: Instrument Serif + Instrument Sans. Unconfirmed beliefs are blurred and sharpen when confirmed.

Tile amounts and dates are illustrative, not real sandbox values.

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
