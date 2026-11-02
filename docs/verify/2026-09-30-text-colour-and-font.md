---
status: unverified
since: 2026-09-30
never: Whether caption colour names and font pickers read correctly by eye in both themes and on paper.
needs: The web app, a mouse and ten minutes to inspect both themes and print preview.
---

# Text colour and named fonts, by eye

**Status: `unverified`.**

**What you need:** the web app, a mouse, ten minutes, and your own eyes in
both themes.

**Why this page exists.** Text nodes grew a colour and a named font on
30 September. Every shade is measured — each holds 4.5:1 against the ground
it lands on, and names itself — and every family's box was measured in
headless Chrome against its real file. What no test can say is whether the
shades *look* like the words they are called, whether dark brown reads as
brown rather than as a second orange, and whether the pickers are where a
hand expects them.

---

## 1. Colour a caption

Press **T**, click the canvas, type `Acme roadmap`. In the bar above the
words, click the **A** (underlined in the current colour). Hover each swatch.

**You should see:** the words take each colour while you hover and go back
when you leave; clicking one keeps it. The first swatch, half dark and half
light, is **Auto** — the theme's own ink.

## 2. Switch themes

Change the theme (light ⇄ dark) with the words still coloured.

**You should see:** the same colour word in a shade chosen for that ground —
red is a deep red on the light ground and a lighter red on graphite, and
both read easily. **Look hardest at yellow, brown and grey**: yellow on the
light ground is necessarily dark (a readable yellow on white is ochre), and
dark-theme brown is the one most likely to be mistaken for orange. If one of
them makes you hesitate, write down which theme and which colour.

## 3. Put it on paper

With the words coloured, pick a paper swatch.

**You should see:** the words switch to a darker shade of the same colour,
readable on the pale note in both themes.

## 4. Pick a font

Click the **Font** button. Hover **Fraunces**, then **Space Grotesk**, then
click one.

**You should see:** the words redraw in the family as you hover (the first
hover may show the plain face for a moment while the file arrives), and the
box grow if the family is wider. Nothing clipped at the right edge, at any
size step — try **XL** too.

## 5. The next node remembers

Click away, press **T** and click somewhere else.

**You should see:** the new composer opens in the colour and font you last
chose. Right-click the **T** in the rail: the **Font** and **Colour** rows say
the same.

---

## What this walk does not cover

- **Painted grounds** (ocean, mountains, desert, space): a caption's ink,
  coloured or not, was never chosen against them.
- **Offline**: a named font falls back to its face; the box was sized for the
  wider of the two, so it should not clip, but nobody has looked on a plane.
