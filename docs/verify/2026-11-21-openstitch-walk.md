---
status: unverified
since: 2026-11-21
never: Whether the Open Stitch shell (TopNav project tabs, HomeInbox, Hide-UI, calibrated sizing, and make-room feel) holds up in a real desktop browser, whether private memory pointers stay locked to collaborators and transition cleanly to Forgotten across two real browser profiles, and whether physical microphone voice choreography and co-listening feel natural with real speakers.
needs: A desktop browser with a second browser profile (or incognito window) for two-user privacy checks, a physical microphone and speakers, a local isocan daemon on main with a Gemini key configured (`isocan keys set gemini`), and twenty-five minutes.
---

# Open Stitch — Shell, Memory Privacy & Forget, and Voice Choreography

**Status: `unverified`.**

**What you need:** a desktop browser (plus a second browser profile or incognito
window signed in as a second person), a physical microphone and speakers, and a
local daemon running on `main`:

```bash
npm run dev
```

Confirm a Gemini key is available on this home if you are running Part C:

```bash
isocan keys set gemini
```

**Why this page exists.** Automated tests prove the shell components mount,
memory pointers return `200`/`403`/`410` against a real daemon, and the voice
choreography state machine obeys its invariants. **None of those can judge**
whether TopNav tabs and Hide-UI feel calm at 60 fps, whether make-room pushes
items without jarring jumps, whether a collaborator in a second browser sees
zero private text before and after Forget, or whether spoken turn-taking and
co-listening feel right through a real microphone and speakers.

---

## Part A — Phase 1: Stitch Shell, TopNav, HomeInbox, Hide-UI, Calibrated Sizing & Make-Room

### 1. Open Home and inspect `HomeInbox`

1. Open the web app root (`/`) in your primary browser profile.
2. Create two synthetic canvases (for example, `Acme Launch` and `Acme Archive`)
   and leave an open comment or agent ask on `Acme Launch`.
3. Return to `/`.

**You should see:** the `HomeInbox` panel lists the open thread/ask beside your
canvases, and inline reply submits cleanly without leaving the home view.

**If something is wrong:** note whether the inbox is missing, clipped, or fails
to update after replying.

### 2. Switch canvases via `TopNav` project tabs

1. Open `Acme Launch`, then open `Acme Archive` from the `TopNav` project tabs
   bar at the top of the workspace.
2. Switch back and forth between the two tabs and close one tab.

**You should see:** switching tabs is immediate, preserves each canvas's
viewport position, and highlights the active project tab without layout shift.

### 3. Toggle Hide-UI

1. On `Acme Launch`, toggle Hide-UI (`⌘.` / `Ctrl+.` or the Hide-UI control in
   the shell chrome).
2. Pan and zoom the canvas, then press `⌘.` / `Ctrl+.` again to restore the
   chrome.

**You should see:** top navigation, toolbars, and side panels disappear cleanly
leaving an unobstructed canvas, and return intact on the second toggle.

### 4. Calibrated sizing and make-room feel

1. Drop or add three cards of different kinds (a markdown note, an image, and a
   web/HTML screen) onto `Acme Launch`.
2. Drag or resize one card so it overlaps a neighbor, or insert a new card
   between two existing cards.

**You should see:** each item lands at a legible, calibrated default size (no
postage-stamp or full-viewport surprises), and make-room shifts neighbors
smoothly without overlapping labels or jittering under the pointer.

---

## Part B — Phase 5: Pointer Privacy Across Two Browser Profiles & Source-Level Forget

### 5. Create a private observation and place a pointer on a shared canvas

1. In your primary browser profile (**Alice**), create a private canvas titled
   `About you (Alice)` and a shared canvas titled `Acme Shared`.
2. Share `Acme Shared` with link-edit access (`Share` → copy link), and open
   that link in the second browser profile (**Bob**). Do **not** share
   `About you (Alice)`.
3. From a terminal claimed as Alice on `Acme Shared`, record a private
   observation and place a pointer to it:

```bash
OBS=$(isocan memory learn "Alice prefers Swiss-grid layouts and dislikes drop shadows." \
  --personal --facet quality_and_taste_bar --json | node -e "const d = JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.canvasId + ':' + d.itemId);")
isocan memory place "$OBS" --label "Layout preference"
```

### 6. Verify owner hydration vs. collaborator lock

1. Look at the new pointer card on `Acme Shared` in **Alice's** browser.
2. Look at the same pointer card on `Acme Shared` in **Bob's** browser, and
   inspect the card's network/blob payload in DevTools.

**You should see:**
- **Alice** sees the hydrated observation text (`Swiss-grid layouts...`) and an
  owner-only **Forget** button on the card and in the Memory inspector.
- **Bob** sees a **Locked memory** badge (`Private memory pointer — visible only
  to its owner.`), **no** Forget button, and zero observation text in the
  downloaded pointer blob.

### 7. Trigger source-level Forget and verify permanent exclusion

1. In **Alice's** browser, click **Forget** on the pointer card (or run
   `isocan memory forget <itemId> --canvas <aboutAliceCanvasId> --reason "Outdated"`).
2. Reload both browsers and run a memory search and reflection as Alice:

```bash
isocan memory search "Swiss-grid" --json
isocan memory reflect --json
```

**You should see:**
- In **Alice's** browser, the pointer card switches to **Forgotten**
  (`This memory has been forgotten.`) and hydrating it returns `410 Gone`.
- In **Bob's** browser, the card remains locked (does not leak private text or
  forgetting metadata).
- `About you (Alice)` no longer contains the deleted observation item, `search`
  returns zero hits for `"Swiss-grid"`, and `reflect` omits both the observation
  and the forgotten pointer.

---

## Part C — Phase 6: Physical Microphone Voice Choreography & Co-Listening

### 8. Open browser voice and check 5-axis disposition

1. On `Acme Launch`, open the command palette (`⌘K` / `Ctrl+K`), choose
   **Configure voice**, and start a live voice session with your physical
   microphone.
2. From a terminal, inspect or adjust the 5-axis disposition hint:

```bash
isocan voice disposition --initiative 0.7 --curiosity 0.8 --divergence 0.6 --depth 0.7 --partnering 0.8
```

3. Speak naturally: ask the voice partner to summarize the canvas, then
   interrupt mid-sentence with a new direction ("Wait — focus on the checkout
   card instead").

**You should see (and hear):** audio connects cleanly through your microphone
and speakers, barge-in stops the assistant promptly without clipping or echo
loops, and the follow-up answer reflects the interruption.

### 9. Exercise co-listening media control

1. Add an audio or video item with a transcript to `Acme Launch` (or use an
   existing media card on the canvas).
2. While the live voice session is active, issue a co-listening control command
   by voice ("Pause the video and jump to 15 seconds") or verify the ephemeral
   command via CLI:

```bash
isocan voice control <mediaItemId> seek --time 15
isocan voice control <mediaItemId> pause
```

**You should see:** playback pauses and seeks smoothly on the media card, the
voice partner stays in sync with the current playback position, and `⌘Z` / Undo
does **not** show spurious playback ops (co-listening controls stay ephemeral).

---

## What this walk does not cover

- **Server-side RRF scoring and token-budget math.** Covered by
  `packages/core/test/memory-core.test.ts` and the daemon integration tests.
- **Deterministic voice choreography state transitions and lease bounds.**
  Covered by `packages/core/test/voice-choreography.test.ts` and
  `packages/modules/talk/test/choreography.test.ts`.
