---
status: unverified
since: 2026-10-14
never: "Semantic Zoom with a real model: whether a summary seen from far away tells a note apart from its neighbours, whether one is ever wrong in a way that misleads, whether the band switches at the right zoom without flicker, whether an edit swaps summaries without a blank, whether a group's card and the washed members under it read well, and whether the app and `isocan summary` agree; every journey so far ran on a stub model"
needs: "a home you own with a text key (`isocan keys set anthropic` on that home, or ISOCAN_TEXT_API_KEY in its environment), a desktop browser with a mouse or trackpad, a terminal with the isocan CLI, a second browser or a private window, and forty minutes; it spends real model calls, about a cent"
---

# Semantic Zoom, with a real model

**Status: `unverified`.**

**What you need:** a home you own that holds a text-model key: on a local
daemon, run `isocan keys set anthropic` once and then `isocan restart`; on a
home in the cloud, its owner sets the key there. Without a key the experiment
shows nothing new at all, which looks exactly like it being broken. You also
need a desktop browser, a terminal with `isocan` on the path, a second browser
or a private window, and forty minutes. The home must be at or after commit
`6c174ba79` (14 October, Semantic Zoom phases 3 and 4). Every summary is a real
model call on the cheapest tier; the whole walk is well under a cent.

**Why this page exists.** Semantic Zoom is an experiment: zoomed out past
where words can be read, a long note, a group or an area shows a short summary
a model wrote, marked **≈**. Its journeys prove the plumbing on a stub model
that answers with canned words: the summary appears, an edit keeps the old
one with ↻ until the new one arrives with no empty frame, a drag between two
groups changes both, nothing appears with the experiment off. **No journey
can say whether a real summary is any good.** A summary that is faithful
but says the same thing for two different notes is useless; one that is
short and distinct but invents a date is worse than no summary. The bench
(`docs/projects/semantic-zoom/bench/`) puts a number on faithfulness for a
fixed fixture; this walk is the part only eyes can judge, on a canvas you
are looking at.

**The one trap.** Nothing is summarised while it is being edited: a note
changed in the last 30 seconds waits until it has been quiet for 30 seconds.
A summary that does not appear the moment you zoom out is usually that.
Count to forty before calling it broken.

---

## 1. Put down a canvas to look at

Make a new canvas in the app called **Acme semantic zoom** and copy its id
from the address bar (the part after `/p/`). In a terminal, in an empty
directory that is not inside any repo (so the CLI is not bound to some other
canvas), run:

```sh
export ISOCAN_CANVAS=<the id>
FIX=<path to an isocan checkout>/docs/projects/semantic-zoom/bench/fixture/canvas.json
note() { node -e 'const c=require(process.argv[1]); process.stdout.write(c.notes.find(n=>n.id===process.argv[2]).body)' "$FIX" "$1"; }
for id in n01 n05 n13 n19; do note $id | isocan text -f -; done
```

**You should see:** four text nodes on the canvas: **Notes** (Q4 launch
meeting notes), **Retro 7 Oct**, **Checkout: metrics** and **Weekly metrics**.
They are the bench's deliberately similar pairs: two meetings, and two sets
of numbers. Spread them out so that each has empty canvas around it.

**If a command is refused,** write down the command and the sentence it
printed.

## 2. Turn the experiment on

Open the menu under your name (the one holding **Controls**) and, under
**Experiments**, tick **Semantic Zoom**. Nothing else on screen should change
while you are zoomed in.

**You should see:** the canvas exactly as it was. The experiment only changes
what you see when words are too small to read.

**If anything moved, flashed or changed colour** when you ticked it, say what.

## 3. A long note, far away

Zoom out slowly until the words of **Notes** are grey lines. First the node
shows its title, **Notes**, at a size you can read. Keep zooming out a little
further and wait up to forty seconds.

**You should see:** in place of the title, a line or two starting with **≈**,
saying what the meeting was about and what matters in it (the slip, who owns
what). Do the same for the other three notes.

The question, for each pair, is one word: **could you tell them apart from
the summaries alone?** Cover the titles with a finger. Would you know which ≈
line is the launch notes and which is the retro, and which set of numbers is
checkout and which is the week?

**If two summaries could be swapped** without you noticing, write both down.
That is the finding this experiment most needs.

## 4. Is any summary wrong?

For each of the four, zoom in until the words come back, and read the note
against the summary you wrote down.

**You should see:** every name, number and date in the summary appearing in
the note as written. A summary leaves things out; it should never add
anything.

**Write down any claim the note does not make** (a date, a cause, an owner, a
number rounded into a different one, "decided" where the note says
"proposed"), and say whether it would have misled you if you had not checked.
A wrong detail you would have acted on is the most important thing this walk
can find.

## 5. The band switches at the right zoom

Pick **Notes**. Zoom in and out slowly across the point where the words stop
being readable, then across the point where the title gives way to the ≈
line. Then stop right at each edge and nudge the zoom back and forth a
little.

**You should see:** words while you can read them, never a summary. The
title, then the ≈ line, as the words become unreadable. At each edge it picks
one and stays; it does not flicker between two at a zoom you are holding
still.

**If you ever saw a summary where you could still read the words,** or if a
band flickered at a zoom you were holding, say which edge and roughly how far
out you were.

## 6. An edit

Zoom in on **Notes**, change "two weeks" to "three weeks", click away, and
zoom straight back out.

**You should see:** the old summary, still saying two weeks, with a small ↻
after it. About thirty seconds after your last keystroke, plus a moment for
the model, the line changes to the new summary, without the ↻. At no point is
the node empty, or showing only its title.

**If the node went blank** or fell back to the title even for a moment, say
so. If the new summary never came (wait a full minute), say that too, and run
`isocan summary Notes` in the terminal and copy what it prints.

## 7. A group

In the terminal:

```sh
isocan canvas group new "Checkout redesign"
for id in n13 n14; do note $id | isocan text -f - --in "Checkout redesign"; done
```

(If `--in` is refused, make the group in the app and drag the two notes into
its frame.) Delete the loose **Checkout: metrics** from step 1 first if you
want the canvas tidy; it does not matter. Zoom out until the notes inside the
group are unreadable.

**You should see:** under the group's title strip, inside its frame, a card
starting with **≈** that says what the group holds, at a size you can read
however far out you are. The card is never bigger than the frame.

**If no card appears** after forty seconds, or the card spills outside the
frame, say what zoom you were at.

## 8. A board of groups

```sh
isocan area new "To do"; isocan area new "Doing"; isocan area new "Done"
isocan text "SSO with Okta and Google" --in "To do"
isocan text "Audit log export" --in "To do"
isocan text "Billing migration" --in "Doing"
isocan text "Safari crash on image paste" --in "Doing"
isocan text "Copy fix: Invite teammate" --in "Done"
```

Lay the three side by side in the app if they landed on top of each other.
Zoom out until the cards are unreadable and wait for three cards with ≈.
Then zoom in, drag **Audit log export** from To do into Doing, zoom out again
and wait forty seconds.

**You should see:** three summaries that a person could tell apart, each
naming what is in its column. After the drag, To do's summary no longer
mentions the audit log and Doing's does. Both keep showing their old summary
with ↻ until the new one arrives; neither ever shows a summary that is
missing a card that is plainly there.

**If either summary still names a card that moved** a minute after the drag,
say which.

## 9. The frame washes its members while the card shows

Stay zoomed out on the board, with the three cards showing.

**You should see:** the cards inside each group faded to about 40% while the
summary card is drawn over them, so the summary reads first and the members
are still visibly there behind it. Hold ⌘ (Ctrl on Windows) and press on one
of the faded cards: it should still be the one that answers.

This one is a judgement, made when it was built and never looked at by
anybody else: **is 40% right?** Too faint and the board looks empty; too
strong and the summary card fights the cards beneath it.

**Say which way it is wrong, if it is,** and whether you could still find a
member you were looking for without zooming in.

## 10. Without the flag, nothing new

Open the same canvas in a second browser or a private window, signed in as
yourself or as somebody you have shared the canvas with. Leave **Semantic
Zoom** off there. Zoom out over the notes and the board.

**You should see:** the canvas as it was before this experiment: notes show
their titles at a readable size, groups show their title strips, and there is
no ≈ anywhere. Back in the first window, everything from steps 3 to 9 is
still there.

**If a ≈ appears anywhere in the window with the flag off,** that is a bug,
and the worst one this walk can find: it means somebody saw model text they
did not ask for. Say where.

## 11. The terminal says what the app shows

In the terminal:

```sh
isocan summary Notes
isocan summary "Checkout redesign"
isocan summary Doing
isocan ls --summaries
isocan summary --stats
```

**You should see:** each `summary` print the state `current` and the same
words the app shows after the ≈ for that thing, letter for letter. `ls
--summaries` lists the same states and makes nothing new. `--stats` shows the
calls this walk made, a few dozen at most.

**If the words differ** from the app's, or the state is `stale` or `missing`
for a thing whose ≈ line you can see, copy the output and say which thing.

## 12. Looking at pictures (only once Semantic Zoom phase 3b has shipped)

**Skip this step if the menu has no row called "Semantic Zoom: look at
pictures"** under Experiments, and say that you skipped it. When it is there:
add two screens (any two pictures of an app's interface) to **Checkout
redesign**, zoom out, and read the group's card. Then tick **Semantic Zoom:
look at pictures** and wait forty seconds.

**You should see:** with the row off, a card that mentions the screens only by
their titles. With it on, a new card that also says something the screens
visibly show, and nothing they do not. Untick it: the text-only card comes
back, no new model call needed. A text note's summary is the same with the row
on or off.

**If the picture summary describes something not in the pictures,** write
down what it claimed. If the row says your provider's model cannot take
images, copy its sentence.

---

## What this walk does not cover

- **Faithfulness as a number.** The bench's eval judges every summary on a
  fixed fixture, claim by claim, and the copy persona owns the count (`node
  scripts/measure.mjs summary-unfaithful`). This walk is the judgement on a
  canvas a person is looking at, which the number cannot make.
- **A canvas homed elsewhere.** Forwarding a summary to another home is wired
  and has never been exercised, by a test or a person.
- **A view-only visitor.** They may read summaries an editor's key paid for
  and never cause one; the server tests hold that, and no person has looked.
- **Cost at scale.** The hourly budget (60 a canvas) and the cost record are
  proved on a stub; a real forty-note canvas has not been timed.
