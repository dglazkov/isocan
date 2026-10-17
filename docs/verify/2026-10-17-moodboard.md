---
status: unverified
since: 2026-10-17
never: Whether real Nano Banana 2.1 images feel evocative (≥ 8/9 non-UI across three briefs), whether keeping and branching tiles into a Mood board feels natural, and whether deriving DESIGN.md and critiquing a screen with Board works end to end by hand.
needs: A Gemini API key on a project with billing enabled (`isocan keys set gemini`), a desktop browser, and `isocan rc` parked on the canvas — about twenty minutes and ~$0.75 of image spend.
---

# Mood board — Explore, Keep, Swatches, Derive, and the Board Critic

**Status: `unverified`.**

**What you need:**
- A **Gemini API key on a Google Cloud project with billing enabled** (`gemini-nano-banana-2.1` returns `429 limit: 0` on the free tier).
- A desktop browser on a local or hosted canvas.
- A terminal with `isocan` and `isocan rc` parked on that canvas (for **Derive from the board** and **Board** critiques).
- About twenty minutes and roughly **$0.75** of image spend (nine tiles at **$0.034** each is ~$0.30 per spread, plus ~$0.14 per four-tile branch).

**Why this page exists.** Phases 0–4 of `moodboard` are built and proved in Vitest and headless Chrome (`scripts/journey-moodboard.mjs`) with the Gemini image model stubbed at `fetch`. No automated test can look at real `gemini-nano-banana-2.1` pictures and judge whether ≥ 8 of 9 tiles avoid looking like app screens across three different briefs, or whether keeping tiles, reading their extracted swatches, deriving a `DESIGN.md` with tile citations, and critiquing a screen with **Board** feels right by hand.

---

## 1. Set your paid Gemini key and turn on the experiments

In your terminal, store a billing-enabled Gemini key and verify it:

```bash
isocan keys set gemini
isocan keys test gemini
```

Open your canvas in the browser, open **Settings → Experiments** (or `⌘K` → **Experiments**), and tick both **Mood board** and **Critique**.

**You should see:**
- `isocan keys test gemini` reports the key works.
- **Design systems** (`⌘K` → **Design systems**) now shows an **Explore a look…** button, and typing `/moodboard` in the Chat composer offers the Mood board command.

## 2. Scene 1 — Explore a look (and check the 8-of-9 non-UI bar)

Open **Design systems → Explore a look…** (or type `/moodboard` in the Chat). Paste:

> `neighbourhood bakery, early mornings, flour on everything, not twee`

Keep the count at **9** and check the price line before clicking **Draw spread**.

**You should see:**
- Before anything is spent, the dialog states the tile count, model (`gemini-nano-banana-2.1`), and price (`9 × $0.034 ≈ $0.30`).
- Within about a minute, a **Candidate tray** appears with nine pictures, each labelled under it with its axis (*light*, *material*, *texture*, *colour*, *era*, *density*, *place*, *lettering*, *wild card*).
- **Count how many of the nine are NOT app screens / UI mocks.** At least **8 of 9** should be photographs, surfaces, objects, colour fields, or signage rather than buttons and nav bars.
- Try two more briefs (for example, *"late-night jazz radio studio, brushed brass and warm VU meters"* and *"alpine field guide, pressed botanicals on cotton rag"*) and record latency, cost, and how many of 9 are non-UI on each spread.

**If fewer than 8 of 9 tiles on a spread are non-UI,** note which axes drifted into UI (`packages/core/src/mood.ts` holds the axis prompts and deny-list).

## 3. Scene 2 — Keep, swatches, More like this, Push, and a dropped photo

In the candidate tray from the bakery spread:

1. Click **✓ Keep** on four tiles that fit the look.
2. Click **✕ Drop** on two tiles.
3. On one kept tile, click **More like this**, then on another click **Push →** and choose **`quieter`**.
4. Drag any photo from your computer onto the **Mood** board group on the canvas.
5. Click **Close tray** on the first candidate tray, then press **`⌘Z`** once, then **`⌘⇧Z`**.

**You should see:**
- Kept tiles move into a **Mood** board group on the canvas, and each kept tile immediately shows a **colour swatch strip** underneath it (3–6 chips; click any chip to copy its `#rrggbb` hex).
- **More like this** and **Push → quieter** each open a new 4-tile tray run labelled with the parent tile and step taken.
- Your dropped photo lands inside **Mood** as a reference (`mood: reference`) with its own swatch strip, and right-clicking it offers **More like this…** and **Push →**.
- **Close tray** removes all unkept candidates from that run in one step, and one **`⌘Z`** brings all of them back together.
- In a terminal, `isocan mood board` (and `isocan mood board --json`) lists every kept and reference tile on the canvas with the exact same swatches the browser drew.

## 4. Scene 3 — Derive `DESIGN.md` from the board and hover to peek

Park an agent runner on the canvas in a terminal (`isocan rc`), then open **Design systems** in the browser and click **Derive from the board**.

**You should see:**
- Your parked agent receives `/design-system` with the Mood board attached, runs `isocan mood board --json`, and writes a governing `DESIGN.md` on the canvas.
- Open **Design systems** (or select `DESIGN.md` and press `Enter` for View Focus): every palette colour and every direction field (*layout*, *density*, *typography*, *palettePurpose*, *treatments*) shows **`from "<tile title>"`**.
- Hover (or keyboard-focus) a colour chip or source pill in **Design systems** or `DESIGN.md` View Focus: the kept tile it came from lights up on the canvas behind the dialog.
- In the terminal, run `isocan style check`: it passes with zero uncited-token warnings.

## 5. Scene 4 — The board as a critic (`Board`)

Ask your agent (or add an HTML screen by hand) for a checkout screen on the canvas that uses your derived palette plus one deliberate off-board colour (for example, a bright `#2563eb` blue **Place order** button that appears on none of your bakery tiles).

Right-click the checkout screen on the canvas and choose **Crit with the room…** (or **Critique with…**).

1. Under **Add a lens**, click **Board** (or tick **Board — from your kept tiles on the Mood board** in **Critique with…**).
2. Click **Ask the room about "…"** (or **Ask**).

From the terminal, you can also run:

```bash
isocan critic add board
isocan critique "#Checkout" --by board
```

**You should see:**
- A **Board** critic card appears on the canvas (`critique.critic = board`), listing your kept tiles' titles and hex swatches in its *What it looks for first* section.
- **Board** pins typed notes directly on the checkout screen without editing the screen: a **Working** note on an accent or surface that matches a kept tile, and a **Risk** note naming the off-board blue (`#2563eb`) and stating that no tile on the Mood board holds it.

---

## When you finish

- If every step worked and ≥ 8 of 9 tiles across three spreads were non-UI, change `status: unverified` at the top of this file to `status: works` (with the date, latency, and non-UI counts in `docs/projects/moodboard/phases.md` under Phase 0 and Phase 4), then run `node scripts/roadmap.mjs`.
- If a step broke or the prompts drew UI screens, set `status: broken`, link the issue in front matter (`issue: <number>`), and write down what happened at that step.
