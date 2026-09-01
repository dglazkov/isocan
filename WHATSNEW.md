# What's new

**Written for the people who use isocan, and this is the only thing in here.**

`docs/changelog/` is the other record: one page per day for whoever maintains
this, naming functions, keeping the arguments that were had and the roads not
taken. Right for that reader and wrong for this one — and it is excluded from
the production image on purpose, so nothing in it can be served by accident.

That separation is the point of this file. It ships, so a home can say what it
is running; nothing else about how the work was done ships with it.

**Days with nothing a person would notice are not here.** A day of
refactoring, of tests, of chasing a flake is a real day's work and an empty
notice. A what's-new with an entry every day is one nobody believes by the
second week.


## 31 August 2026

- Mark items as slides and press Enter: full screen flips through them with arrows, like a deck. Share the first slide's link and that is the presentation.
- Select as many screens as you like and make them all slides at once. The ones already in the deck are left alone, and one undo takes the whole thing back.
- Slides are outlined on the canvas, so you can see which of forty screens are in the deck without opening any of them.
- Presenting is quieter: after a few still seconds every bar fades away and the slide is the only thing on the screen. Move the mouse and they come back. Typing keeps them up, so writing is never interrupted.
- Full screen no longer offers the editor. It is for showing work; the workbench is for changing it.
- Moving between slides fades from one to the next, and a slide you have already seen does not load again — so no white flash between screens, and no fonts arriving late and shifting everything as they land.
- The link can now be view-only: anyone with the address sees the slides and can change nothing. Flip it in the Share dialog ("Can view") or with `isocan share --link view`.
- Only the person who made a canvas can change what its link allows. Before, anyone who could edit could make the link view-only — including themselves, leaving nobody able to undo it. Share and `isocan share` now both say whose canvas it is.
- Viewers are not asked for a name — they land straight on the presentation.
- Select the words of a comment and press ⌘C and you get the words. It used to copy the item behind them.
- A reply in a thread can be more than one line now: Enter sends, Shift+Enter starts a new line, the same as the Chat.
- The emoji picker knows 578 marks instead of 178 — flags, food, travel, animals — and finds a country by its name or its two-letter code.
- An emoji you pick appears everywhere your face is drawn, straight away, instead of on the next reload.
- Bringing back an older version of a file now tells you which file on disk it left behind. Saving that file no longer warns that somebody else changed it when it is only a version behind — that warning is kept for when somebody really did.

## 29 August 2026

- Personas: give an agent a name, a model and a brief, and it keeps them across sessions.
- Your CLI tells you when it is older than the canvas it is talking to, instead of quietly disagreeing.
- Panning and zooming a busy canvas is about three times smoother.


## 28 August 2026

- The side panel floats over the canvas instead of shoving it aside, so nothing jumps when you open it.
- Copy and paste works on the canvas, on both the app and the terminal.
- Closing the panel leaves a slim strip showing who is here and what is unread.
- Full screen now fades the chrome away after a few still seconds, so a canvas can be presented from.


## 27 August 2026

- Browse for a folder instead of typing its path from memory.


## 26 August 2026

- Read the whole history of a canvas, including the parts old enough to have been packed away.
- Edit the text of a screen in place, without opening its source.
- Every canvas has a Chat, and everything else is a comment.
- Attach a folder on your machine to a canvas, from the app.


## 25 August 2026

- isocan.io is live: canvases hosted, with nothing to install to open one.
- React to anything with an emoji, and find things by what people marked.
- Full screen, for presenting a canvas rather than working in it.


## 24 August 2026

- Turning a share link off now removes the people it let in, not just future arrivals.
- Prove an email address and a second browser becomes the same you — no account, no password.


## 23 August 2026

- Share a canvas by sending a link.
- A viewer for a design system, drawn as itself rather than described in text.


## 22 August 2026

- Cursors say who they belong to, so a busy canvas reads as people rather than arrows.
- The colours across the app were audited for legibility on both themes.


## 21 August 2026

- Type `/` in any message to ask an agent for work — `/format`, `/variation` and more.
- `/format` tidies the whole canvas in one step, and one undo puts it back.
- A shortcut list, so the keyboard is discoverable rather than folklore.


## 20 August 2026

- Scribble over part of a screen to point at it — the mark sticks to the thing, even when it moves or resizes.
- Attach files to a canvas, and see real thumbnails instead of placeholders.
- Star the things you want to find again.


## 19 August 2026

- Everything you can do by hand in the app you can now ask for from the terminal.


## 18 August 2026

- Draw straight on the canvas with the Pen, in your own colour.
- Arrows at the edge of the screen point to work that is off view.
- A minimap you can fold away, and renaming anything in place.


## 17 August 2026

- Name yourself once and the name follows you everywhere on the canvas.
- A tool rail down the side, and a Zoom tool for getting into detail.
- ⌘K opens a launcher for anything the canvas can do.


## 16 August 2026

- One command installs isocan and puts you on a canvas.
- Light and dark themes, following your system by default.
- Two people can share one machine without wearing each other's name.


## 15 August 2026

- The canvas works from a browser or a terminal — the same board, live, either way.
- Undo takes back what YOU did, not whatever happened most recently.
- Leave comments on anything on the canvas.

