# The story of isocan

*Written 2 September 2026 from the git history, the changelog and the code,
and then laid out on the demo canvas (`prj_sN8FgZuimi`) as screenshots,
notes, ink and reactions. This is the written half.*

isocan is an infinite canvas that two kinds of collaborator share: people in
a browser, and agents in a terminal. Everything either of them can do, the
other can do too, because both speak the same vocabulary of operations to the
same engine. That single decision, made on the first day, is the spine that
every feature below hangs off. The story is told in fourteen chapters, in
roughly the order the features arrived, with the small delights called out
beside the big ones, because a canvas earns affection in the small ones.

---

## 1. One canvas, two doors

The first commit (15 August) scaffolded four packages: `core`, `server`,
`cli`, `web`. `core` holds an `Operation` union (`item.add`, `item.move`,
`thread.reply`, …) and one pure reducer. The daemon runs that reducer
authoritatively; the web app runs it against a replica; the CLI posts ops to
the same endpoint. Nothing else has ever been added in front of it.

What that buys, day one: **the web app and the terminal are the same board,
live.** Drag a card in the browser and `isocan ls` says where it went. Run
`isocan add hero.html` and the card appears under the person's cursor. Every
op carries its actor and its inverse, so **undo is per person**: ⌘Z takes back
what *you* did, never what a collaborator did a second ago.

The rule is enforced, not promised. A test in the repo checks that every
gesture in the app has a verb in the CLI (`isocan align`, `isocan distribute`,
`isocan mv --by`, `isocan react`, `isocan slides add` …). When a feature
lands on one surface without the other, CI says so.

> **Small one.** The help panel (`?`) is generated from the same list in
> `core` that the code answers to, and a test checks the letter keys against
> the handlers. A help panel describing a different app than the one it is in
> was judged worse than none.

## 2. Who you are

You are asked for a name at the door, once. It is stamped on every op, comment
and version, and it follows you: rename keeps your actor id, so your undo
stack and the comments addressed to you stay yours.

**Two parties share a machine.** `~/.isocan/identity.json` is the person's
name; an agent claims its own actor against the session id its harness
exports. So two agents in one directory are two people, and an agent can never
rename the human. Agents are named after the canvas rather than their vendor
("Claude" is wrong here), and the daemon hands out a name that starts with the
same letter as the harness, so three cursors can be told apart at a glance: a
C name is a Claude Code session, a G name is Gemini, and the fallbacks are
names hiding in the letters of *isocan* (Isaac, Kenny, Nico, Isao).

**Your colour** is derived from your actor id and worn everywhere at once:
cursor, face in the pile, comment pins, the outline on an item you are
holding, your Pen's default ink. Pick another and everyone sees you change
live. Since 31 August you can also wear an emoji instead of your initial,
picked from 578 marks, and it rides on your cursor.

Cursors carry names, so a busy canvas reads as people rather than arrows.
A parked agent wears a dashed ring in the facepile. A face badged with a count
takes you to the comment that person left; a live face takes you to their
cursor.

> **Small ones.** The emoji picker finds a country by its name or its two-
> letter code. A rename only offers itself when the name actually changed.
> Leaving is not forgetting: the door remembers every name this browser has
> worn, and coming back as one resumes that actor rather than a stranger
> sharing the name.

## 3. Things on the canvas

Items are files. Markdown, images, video, SVG, and HTML rendered live in a
sandboxed iframe. Drop them, paste them, or `isocan add` them. A name sits
above the item rather than inside a chrome bar, and stays hidden until you
point at it, so a canvas of sketches reads as the sketches. Double-click the
name (or `F2`) to rename in place, and **the file follows the title**: "Bass
tab v2" becomes `bass-tab-v2.png`.

**Versions are the 0.5D.** Editing never overwrites: it stacks a new version,
and the elevation plies under the card hint at the stack. `S` fans it out so
you can preview and promote any version. The count badge is chrome, holds its
size as you zoom, and steps aside when a comment pin is literally on it.

Resize from all four corners. Marquee-select several. Double-click to step
inside an HTML item and scroll it; `Enter` gives it the whole screen. ⌥-click
reaches the item underneath. ⇧F grows an item to the size its content wants
and settles the neighbours so nothing overlaps. ⇧D downloads the current
version under the filename it carries.

> **Small ones.** A new item asks for a spot rather than claiming one, so it
> lands clear of what is there; but a thing you *place* (a note typed beside
> another, a file dropped at the pointer, `--at`) stays exactly where you put
> it, like a real post-it. The "double-click to interact" hint hangs under the
> item, never across the document it describes.

## 4. Ink

Press `P` and draw, in your own colour. A moment after you lift the pen the
ink settles into an ordinary item: an SVG with no card, selectable, movable,
versioned, undoable. Strokes drawn in one breath land as one drawing. **Hold
`P`** and nothing settles until you let go, so a sketch made in passes (draw,
stop, pan, add an arrow) is one drawing however long you take. `isocan merge`
is the same thing as a verb, and `isocan add --drawing` puts an SVG down as
ink from the terminal.

**Ink over an item is an annotation, not a drawing on top.** It remembers the
item and the region it covers in fractions, so it survives a resize, paints
above its target and travels with it. A composer opens on the spot; posting
anchors the thread to the item, an agent parked on it wakes, reads the region
without parsing a stroke, rebuilds, and clears the mark.

> **Small ones.** Typing "please" in a composer no longer reaches for the Pen
> (the `P` shortcut once listened to text fields). ⌘Z while the ink is still
> wet takes back one stroke. Pointing at a drawing outlines the box you would
> grab, because the ink is the item and has no card to show you.

## 5. Words

`T`, click, type. A text node is chromeless, editable by anyone who
double-clicks it, and a real `.md` underneath, so it versions, `#Title`
points at it, and `isocan get` hands it back. Size is a ladder of how far out
it stays readable: S survives to 50% zoom, M to 25%, L to 12%, XL to 6%. So a
cluster gets an XL heading and stays legible in the whole-board view where
the notes beside it have become marks. Faces: sans, mono, serif, hand.

**A post-it is a text node wearing paper.** Pick yellow, pink, blue, green or
grey on the text bar (or `isocan text "…" --paper yellow`) and the words
become a square note. It is still a text node, so undo, versions, mentions
and agents all work on it unchanged, and the composer wears the paper while
you type.

> **Small ones.** Hover a swatch, a size or a face and the note you are typing
> previews it until the pointer leaves; a click keeps it. Changing a note's
> colour saves at once as its own undo step. A new note opens on the paper,
> size and face you chose last. The text tool keeps what you typed while you
> change your mind about the colour.

## 6. Talking

Comments are threads pinned to the canvas or anchored to an item, and pins
follow drags. ⇧C comments on the selection; ⇧C again reopens that same
thread rather than starting a second. Bodies render as markdown. `@Name`
addresses somebody and wakes a parked agent; typing `@` opens a picker of
everyone here, live sessions first. `#Title` links an item and becomes a chip
that flies the reader to it. Both render as chips in the composer.

**The Chat.** One thread per canvas is *main*: it docks as a panel on the left
instead of a pin, everything posted there wakes every agent with no mention
needed, and `#Title` references render as cards. Shut, the rail is a 48px
strip carrying what you have not read and which agents are working; ⌘J opens
it. Reply to asks made in the Chat in the Chat; keep critique of a thing on
the thing.

**Reactions.** Select an item and a row of marks appears beneath it. A mark
carries who left it, yours is outlined, and the dock on the right groups the
canvas by emoji, ordered by how many items wear each. Nobody defines what 👀
means; the team does, by using it. It replaced a favourites star, because a
star was one shared bit with nobody's name on it.

**Selection travels with the message.** What you have selected shows as chips
over the composer and posts as item ids, so "make these two match" tells an
agent which two. A comment can be rewritten by its author and only its
author, so an agent posts one working note and keeps it current; the canvas
then says "edited · 4m", measured from the timestamps. New comments announce
themselves with a toast; unread ones badge the pin, the author's face and the
tab title.

> **Small ones.** ⌘⏎ sends from any composer. Enter sends in a reply, ⇧⏎ makes
> a new line. Select the words of a comment and ⌘C gives you the words, not
> the item behind them. A card says what happened before the last thing when
> you point at it.

## 7. Finding your way

Pan, pinch, ⌘+ and ⌘− zoom the canvas and never the browser. `F` fits the
selection, ⇧1 fits everything, ⇧0 is actual size. `Z` is a Zoom tool: tap to
keep it, hold to borrow it and drag a region. Space borrows the Hand.

**Snapping.** Dragging shows a guide for every edge or centre the item has
settled onto, measured in screen pixels so it feels the same at any zoom;
hold ⇧ mid-drag to make it more magnetic. Where no line claims an axis, equal
spacing does: dropped between two neighbours, purple measure bars say the two
gaps match. Blue says aligned; purple says the gaps match.

**The edge radar.** Items that pan out of sight leave a bar flush along the
rim, where a ray from the middle of the screen would leave the window and as
long as the thing out there. Bars that overlap merge; hovering lists
everything the bar speaks for, nearest first, and any row takes you there.

**Walking.** ⌘ + an arrow moves the selection to the nearest item that way,
with a heavy penalty on sideways drift so a walk stays in its row. Bare arrows
nudge, ⇧ nudges ten. The minimap folds into its corner and remembers. ⌘K is a
launcher for anything the canvas can do, and the place to message your
emissary from anywhere. Light, dark and system themes since day two.

> **Small ones.** The cursor spotlight: the dot grid lights up where you point.
> The minimap answers "what is this?" like everything else. Selection chrome is
> measured in screen pixels, not world ones, so handles never shrink away.

## 8. Agents at work

An agent appears with `isocan session start` and its cursor is on the
canvas. **Presence narrates itself**: reads set a status ("reading the
comments…"), ops move the cursor to where they happened, and a long silence
shows honestly as "quiet 2m" unless the agent says what it is doing with
`session work --say`. It builds with `add` and `edit` (each edit stacks a
version), replies on the thread with `#Title` pointing at the work, and
**parks** on `isocan wait`, which blocks until a comment is *for it*: a
mention, anything in the Chat, or a thread it is already part of. Everything
else is ether.

**Slash commands** are work a message can ask for. `/format` tidies the whole
canvas in one undo (`grid` straightens, `smart` reads it), `/variation 3`
makes three takes on a screen and `isocan choose` folds the winner back onto
its source and trashes the siblings in one undoable gesture, `/design-system`
writes down what the canvas has decided, `/help` opens the key list, `/skill
find` installs a published skill, and a home can add its own.

**An agent is not a process.** Since 30 August an agent can be a record:
enrolled on a canvas, answerable when something arrives, running only then.
`isocan rc` is the person's long-running command that answers for enrolled
agents; `isocan agent add` is the same thing spoken by an agent. One name on
one machine can stand on many canvases as one actor. `isocan who` tells
answerable from running from gone, and an unanswered `/ask` pins the agent to
the top of the roster marked *asked* until somebody else replies.

**Personas** give an agent a lens, tools, a goal it is judged against as a
number and a command, and a memory that is the guards it wrote rather than
the notes it left. Seven of them review this repo on a schedule.

> **Small ones.** An agent that starts working does not vanish from the thread.
> "Somebody has this, and here is what they are doing" shows under the comment
> that asked. `isocan inbox` lists what is addressed to you across every
> canvas, with the command to reply to each.

## 9. The workbench

Press `W` and the canvas flips to the agent room: every agent with a live
session in one roster, its status in its own words and expandable to what it
is answering and what it last made; the Chat beside them; and one item on a
stage with its editor. It is a route (`/w`, `/w/<item>`), so `isocan open
--workbench` hands somebody the exact view, and Esc steps back out onto the
canvas exactly where you left it.

The workbench is a projection, not a product. It renders the same ops,
presence and threads through different chrome, adds zero op types, and never
shares layout, because one person's collapsed pane must not become another's.

**Edit text without touching HTML.** On a screen's preview, *Edit text*,
double-click any text, type, Enter. Save lands a new version; anything the
edit cannot place exactly is refused with a sentence rather than guessed at.

**Items can be files.** Bind a directory (`isocan use`, or paste a path into
FILES) and the workbench lists it. `isocan set --file` says where an item
belongs; `isocan save` writes it there. A mark on the item says whether the
file is written, missing or drifted, and drift is refused rather than
overwritten. `isocan get` hands back the *promoted* version, which is not
necessarily the newest; that is the whole point of promoting one.

## 10. Presenting

`Enter` opens the selection full screen. After a few still seconds every bar
fades away and the slide is the only thing on the screen; move the mouse and
they return; typing keeps them up. Bare arrows and a clicker's Page Up/Down
flip from item to item in reading order, rows top to bottom, left to right.
**Mark items as slides** (right-click → *Make this a slide*, or `isocan slides
add`) and the flip stops only at those; marked items wear 🎬 and an outline on
the canvas so you can see the deck without opening it. Slides either side are
rendered before you press the arrow, so there is no white flash.

**Share** sits beside the facepile: the pile is *who's here* and Share is *who
may be here*. The address is the whole invitation; whoever gets it lands on
the populated canvas with nothing installed. "Anyone with the link" is a
grant the canvas is born with, can be switched to view-only so an audience
sees the deck and changes nothing, and turning it off expels the people it
let in while keeping the ones invited by name. Only the canvas's maker can
change what the link allows.

> **Small ones.** Full screen no longer offers the editor: presenting is not
> editing. Viewers are not asked for a name. The full-screen arrows say which
> way, and how much is that way.

## 11. Time

The log *is* the canvas, so the past is always there to look at. `isocan
timeline` draws the history as a track: bars by significance rather than by
count, a tick under every bucket with a seam (something born, deleted,
versioned, a conversation started, the Chat moved). Forty moves are one
ripple. In the app it is the clock in the tool rail: the same track with a
playhead, and the canvas becomes what it was while you hold it. `isocan at
<seq>` prints the same past. **The past takes no writes**, from either
surface.

`isocan canvas list` says what each canvas last did, in words ("Di moved
something"); `isocan history` asks the same of a person across every canvas;
`isocan lens` shows what somebody has *made*, grouped, and `/lens` in the app
is the same view. It is a lens and not a canvas, because items belong to the
canvas they are on and a gathered view can only hold references.

`isocan whatsnew` is what a person got, day by day, in their words; the
developer changelog is a different document for a different reader, and days
with nothing a person would notice are not listed.

## 12. Thinking together

**Mind maps.** `isocan map new "Lake house"`, `map add "Booking" --to <node>`,
`map link` to move a branch. A node is a text node and an edge is a property,
so nothing new was invented: nodes version, the person drags any node
anywhere, and the lines follow. `map tidy` gives each depth a column and
centres parents on children, as one undoable move.

**Areas.** A titled sheet things are placed on. `isocan area new "Sketches"
--tint yellow --note "…"`, then `--in Sketches` on `text`, `add`, `mv`, `ls`
and `format`. Membership is geometry, read now: an item is in an area when
its centre is inside it, so dragging a thing out is all it takes, and dragging
the sheet by its name carries what is on it.

**The design sprint.** Type `/sprint` in the Chat and an agent facilitates.
It lays a board: one sheet per stretch of the week (Brief, Map, Experts &
HMW, Target, Demos, Sketches, Vote, Storyboard, Prototype, Test, Wrap), each
with a card saying what happens there. Calling a phase walks everyone's
camera to its sheet and puts the phase's one action on the clock chip. Votes
are reactions (🔴 heat, ⭐ straw poll, 🏆 the Decider's supervote), hidden
until the bell and never hidden from the record. The facilitator never
decides; one named person does.

## 13. Homes

A canvas lives where it was born. On a laptop that is the local daemon;
since 25 August it can be **isocan.io**, hosted, with nothing to install to
open one. One daemon can be the home of some canvases and a replica of others
at once, and `isocan status` says which. When the home is elsewhere every
write travels there and comes back; reads stay local and instant.

Getting another machine onto a canvas is one line: `isocan pass` mints a
single-use, fifteen-minute credential and prints the setup command to paste.
Your second machine arrives *as you*. A browser reached through `isocan open`
does the same, with the credential in a `#fragment` that never leaves the
browser. Proving an email address is not a login: there are no accounts.
It lets somebody invite you by name, and lets a second browser resume the
person the first one already is. Two identities that turn out to be one
person can be folded into one.

A canvas can **teleport** to another home with its whole history intact, and
`isocan export` writes a canvas, an item, or a whole home to a directory as a
real backup, with `--git` to commit and push it and `isocan import` to bring
it back with seqs and timestamps unchanged. A throwaway workspace can run
**direct**, with no daemon and no replica, speaking to the home itself.

> **Small ones.** A canvas that will not have you says `403 not-admitted`,
> which means ask whoever shared it. The CLI tells you when it is older than
> the home it is talking to, and can upgrade itself with a rollback. `isocan
> blobs` finds the picture a teammate cannot see and pushes it.

## 14. The small delights, collected

Because they are the point.

- The dot grid lights up under your cursor.
- Undo takes back what *you* did.
- The file follows the title when you rename an item.
- The version badge steps aside for a comment pin.
- Purple measure bars when the gaps match; blue guides when edges align.
- Edge radar bars that merge, and list what they speak for on hover.
- Hold `P` and a whole multi-pass sketch is one drawing.
- Hover a paper swatch and the note tries it on.
- 578 emoji, searchable by country code.
- An agent named after the canvas, starting with your harness's letter.
- "quiet 2m" under an agent that has gone silent, said honestly.
- `#Title` chips that fly you to the thing.
- Chrome that fades while you present, and comes back when you move.
- Slides that render before you press the arrow.
- A card that says what happened before the last thing.
- ⌘C on comment text gives you the words.
- The past you can scrub to, from either surface, and cannot write into.
- A daemon that says "stale" and a `restart` that fixes it.
- `isocan whatsnew` written for the person, not the maintainer.
- A canvas that introduces itself when you make it.

---

*The canvas half of this story is on `prj_sN8FgZuimi`: fifteen sheets,
one per chapter, in reading order, with the exhibits live on them.*
