---
status: unverified
since: 2026-10-01
issue: 182
never: "isocan on a physical phone — the on-screen keyboard over the Chat, Safari's toolbar coming and going, and whether pinch, pan and swipe feel right; mobile phases 0–2, owed since 13 Sep"
needs: "an iPhone with Safari (an Android phone too, if you have one), a canvas with a few cards and a short deck on it — twenty minutes"
---
# On a real phone

**What you need:** a phone, signed in to the home your canvases live on, and a
canvas with a handful of cards and a three-slide deck. Twenty minutes.

**Why this page exists.** Everything here passed in a desktop browser
pretending to be a phone, with simulated touches. That proves the events and
the layout. It cannot prove what the keyboard covers, what Safari's toolbar
does when you scroll, or whether a pinch feels like a pinch — and those are
most of what makes a phone app feel broken.

---

## The Chat and the keyboard

1. Open the canvas on the phone. **You should see** the Chat first, with the
   canvas one tab away.
2. Tap the message box. **You should see** the keyboard come up and the box
   stay visible above it, with Send reachable. Type a message and send it.
3. Start a second message, switch to the Canvas tab and back. **You should
   see** your unsent words still there.

## The canvas by touch

4. On the Canvas tab, drag with one finger to pan and pinch to zoom.
   **You should feel** each gesture do one thing — no jumping, no zoom when
   you meant to pan.
5. Press and hold a card, then lift without moving. Press and hold another,
   then drag away before lifting. **You should see** a menu only the first
   time.
6. Scroll down and up. **Watch Safari's toolbar** shrink and grow: nothing in
   isocan should be hidden under it or jump when it moves.
7. Turn the phone sideways and back.

## Presenting

8. Open the deck and start presenting. Swipe left and right, and tap the left
   and right thirds of the screen. **You should see** exactly one slide per
   swipe or tap, and nothing before the first slide.
9. Open the speaker notes, close them, and exit.

## Writing it down

Which phone and browser, and every place it felt wrong — a wrong feel is a
finding even when nothing is technically broken. Set this page's front matter
to `works`, or `broken` with an issue.
