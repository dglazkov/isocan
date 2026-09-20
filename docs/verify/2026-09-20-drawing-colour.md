# A drawing's colour

**Status: `unverified`.**

**What you need:** the web app, a mouse or trackpad, five minutes.

**Why this page exists.** Until 20 September a drawing carried no colour at
all, so *"move the red one"* could never resolve — red is not one of the five
paper colours, and a drawing's strokes vanish into an SVG blob the moment it is
made. The fix records the colour as a property when the ink is laid down. The
CLI and voice paths were driven for real; **the Pen was not.** Its test mocks
the two seams it writes through, which proves the operation is minted
correctly and proves nothing about whether drawing with your hand produces one.

---

## 1. Draw something red

Open a canvas in the web app, pick the **Pen**, choose a **red** ink, and draw
a decent-sized squiggle — not a dot.

**You should see:** an ordinary drawing land on the canvas where you drew it.

## 2. Ask the canvas what colour it thinks that is

```bash
node packages/cli/bin/isocan.js ls --json
```

Find your drawing in the output and look at its `properties`.

**You should see:** `{"kind": "drawing", "ink": "red"}`.

**If `ink` is missing**, the Pen is not recording it and the walk has found the
bug — the unit test passes in that case, which is exactly why this page exists.

## 3. Check it is the colour that covers the most ground, not the first stroke

On the same drawing, add a **short** blue stroke and a **long** red one, or
redraw with both.

**You should see:** `ink` still says `red`, because the measure is total stroke
length rather than which colour was laid first.

## 4. Check the word is honest

Draw something in a colour that is genuinely hard to name — a muddy
blue-green, say.

**You should see:** whatever single word the data settles on, it should be one
you would not argue with out loud. **A wrong word is worse than no word**: a
voice session will move the thing you named. If the word makes you hesitate,
write down the hex you drew with and the word you got.

---

## What this walk does not cover

- **Drawings made before 20 September** carry no colour and never will;
  nothing rewrites old items.
- **A picture's face** — a photo, a screenshot, a pasted card — is pixels
  rather than paths and stays colourless by design.
