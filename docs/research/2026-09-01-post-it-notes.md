---
status: built
since: 2026-09-01
see: ui-refresh
note: built 1 Sep — `properties.paper` on a text node, a swatch row on the Text tool and `isocan text --paper`; option A as recommended, no new op and no new kind
---

# The post-it, and which of three things it is

**1 September 2026.** Research, and then built the same day — option A, as recommended below.

The question, as asked: *sometimes I reach for the T text tool and it is all I
need, and other times I really want a digital post-it. Is a post-it a style
that belongs to the T tool, or another tool on the rail? Or is it a comment
you put on the canvas and want expanded, rather than collapsed to a badge?*

Three real options, and the codebase has already answered most of it.

## What a text node actually is

`textnode.ts` is unusually explicit about its own design, and it decides this
question more than anything else does:

> Deliberately NOT a new op type, and not a new kind of thing in the model — a
> text node is an ordinary `item.add` whose version blob is markdown… What
> makes it a text NODE rather than a note somebody uploaded is the same signal
> a drawing uses: `properties.kind`. That is what tells both clients to draw
> it chromeless… and it is a property so that stripping it leaves an ordinary,
> still-valid markdown item rather than something broken.

So the established move for "a new sort of thing on the canvas" here is not a
new op and not a new kind. It is **the same item, wearing a property**. The
Pen did it with an SVG; the mini-browser did it with a `text/uri-list`.

## Option A — paper, as a facet of the text node

`properties.paper = yellow` on a `kind=text` item. The T tool grows a small
row of papers; the first swatch is *no paper*, which is today's plain text.

Everything the vocabulary promises comes free, because nothing new was
invented: undo is `item.delete`, re-wording is `item.addVersion` so every
draft is kept, `isocan ls` lists it, `isocan get` hands back a real `.md`,
`#Title` points at it, an agent can `wait` on it, GC keeps the blob alive.
A client that predates the feature renders it as what it is — a markdown note
— rather than as something broken. That last property is the whole reason the
kind marker is a property in the first place, and it applies unchanged here.

## Option B — a new kind, and a tool on the rail

The rail is doors-to-kinds, so a new door implies a new kind of thing. A
post-it is not one: it is the same thing a text node is — words placed on the
canvas — drawn differently.

The cost is not the tool, it is everything that follows a kind: an `itemKind`
entry, an icon, filters, a CLI flag, a second creation path, and eventually
somebody asking why their post-it does not version the way their text node
does. Two doors to one object is two code paths that must agree forever.

## Option C — a comment, rendered expanded

This is the sharpest of the three questions, because the shapes really do
rhyme: a `CommentThread` already carries world coordinates, already sits on
the canvas, and already collapses to a badge. Expand one and it looks like a
sticky note.

It is still the wrong home, for one reason: **a comment is addressed.** It has
an author, a thread, unread state, `@`-mentions, and it reaches agents — the
comment system is the channel *to people*. A sticky note is not a message. It
belongs to the canvas, the way a label does.

Build post-its as comments and every note acquires an inbox, an author badge,
and a "has anybody replied" state nobody asked for. And comments collapse to
badges *because* a canvas of open threads is unreadable — within a day
somebody would want the post-its collapsed, at which point they are badges
again and the feature has undone itself.

**There is a real feature hiding in option C, and it is a different one:**
*keep this thread open on the canvas* — a thread pinned expanded rather than
badged. Worth its own note. It is not a post-it.

## Recommendation

**Option A.** The difference between a text node and a post-it is real, but it
is presentational: text on the canvas is a *caption* that belongs to the
space; a post-it is an *object* with edges, colour and a shadow, which reads
as something you could pick up and move. A style facet is exactly the shape
for "same thing, different presentation".

Three decisions worth making deliberately rather than drifting into:

**Fixed size, not auto-grow.** A physical post-it's constraint is what makes it
useful: it will not hold an essay, so it holds an idea. Default to a square,
let a drag override it. A note that grows to fit is a text node with a
background.

**Papers carry no meaning.** Resist colour-as-taxonomy. The moment yellow means
"todo" the canvas has a vocabulary nobody wrote down and everybody disagrees
about. They are paper.

**The palette is the problem the slide border just solved.** `--warn`,
`--accent`, `--good` and `--danger` are spoken for, and seven more hues belong
to PEOPLE (`IDENTITY_COLORS`), whose outlines land on items during remote
selection. Papers are *backgrounds* rather than marks, so desaturated tints
read as a different register and have room — but each needs tuning per theme,
because a yellow that works on `#ffffff` is wrong on `#0e0f12`.

## What it would take

* `core`: a `PAPER_PROP`, the allowed values, and a helper both surfaces read —
  the same shape as `slidePatch`/`isSlide`.
* `web`: a paper row on the Text tool, and a `.textnode` background/shadow
  variant driven by tokens in both themes.
* `cli`: `isocan text "…" --paper yellow`, shipped at the same time. A style
  the app can set and the CLI cannot is a habit rather than a rule, which is
  the one law this project actually has.

No new op, no reducer change, no migration: an item without the property is a
plain text node, which is what every existing one already is.
