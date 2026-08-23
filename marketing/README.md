# marketing/

The logged-out surface for isocan.io — what somebody sees before they have a
canvas. Static: `index.html`, `style.css`, one screenshot. No build step, no
dependencies, nothing to install. Open the file, or serve the directory.

```sh
open marketing/index.html
# or
npx serve marketing
```

## What it inherits and what it doesn't

The visual world is the app's own, lifted from `packages/web/src/styles.css`:
the same cobalt, the same graphite ground, the same 8px radius, and the canvas
dot grid as the page's literal background. Nothing here invents a second
identity for the product.

What changes is the register. The app is a room you work in and its job is to
get out of the way; this page has to argue. So the accent owns whole bands
rather than accenting a neutral one, and the display face is
[Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque)
rather than the system stack — the body copy stays system-ui, which is the
app's own voice.

**Two tokens differ from the app, on purpose.** `--accent-solid` (`#1f3fd0`,
the app's light-theme accent) is the accent as a *fill under white text*:
white on the dark theme's `#4c6ef5` measures 4.32:1, under the 4.5 body text
needs, so anything carrying white words sits on the darker value while
borders, glows and links keep `--accent`.

The page is dark and single-theme by decision, not omission. The scene is
somebody at a desk with a terminal in one window and the canvas in the other,
agents working while they read; the product's own chrome is dark in that
scene, and a light page would put the screenshot in a frame it does not
belong in.

## The design contract

`index.html` opens with an HTML comment naming the thesis, the world, the
story, the first viewport, the form it chose and the five it beat, per
[impeccable](https://github.com/pbakaus/impeccable)'s new-work discipline. It
is the thing to re-read before editing, and the thing to audit the render
against.

## img/canvas.png

**A real canvas, not a mockup.** It was produced by driving the actual app in
a headless browser against a live daemon: three CLI agents (`Fable`, `Codex`,
`Gemini`) with real presence sessions, real cursors, real statuses, and a real
comment thread, plus a person in the browser. The version badges are real
version counts.

The screens *on* that canvas are synthetic — an onboarding flow for a product
named Tideline that does not exist. That is the AGENTS.md rule for fixtures,
and it matters more than usual here: an earlier take used pricing cards, which
on isocan's own marketing page would have read as isocan's prices.

To reproduce it, make a canvas, add the screens, start three named sessions
with `isocan identity --session --new --name <name>` and `isocan session work
<item> --say "<what it is doing>"`, then screenshot the app at a 1440×760
viewport with the main panel closed.

## Claims

Every command on this page is a real command; every capability described is
one that exists today. Two things are stated as forthcoming rather than shipped
— the hosted home, and multi-machine collaboration. Keep it that way: the
audience for this page will run the install line within a minute of reading
it, and anything that is not true will be found immediately.
