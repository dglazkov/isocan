---
status: unverified
since: 2026-10-14
never: "the proactive agent with a real model in front of a person: whether a proposal is ever unwelcome or in the way, whether the note a delete teaches feels right, the /goodnight conversation and its note, whether the morning review earns the return, whether Explain teaches, the brief card's said and pencil lines and the re-read's one question, whether ripple's read-back names the right decisions, whether the stuck question is kind, whether critics feel like a room, whether the walks feel honest about being simulations, and whether the design-word readings help or nag; every journey for proactive-agent phases 1–10 ran on a scripted agent"
needs: "a home you own with a scratch canvas, a standing agent that can answer on it (enrolled with `isocan rc add` and `isocan rc` running in a terminal, on a harness you are happy to spend on — `isocan harness` lists them), a desktop browser and a terminal with the isocan CLI, the Critique experiment on for step 11; about two hours over two sittings (an evening and the morning after), and real model turns on that harness — a few dollars on a frontier model"
---

# A proactive agent, with a real model and a person

**Status: `unverified`.**

**What you need:** a home you own (your local daemon is fine), a terminal with
`isocan` on the path, a desktop browser, and an agent harness you are happy to
spend on: `isocan harness` prints which ones this machine can run. The home
must be at or after the commit that closed proactive-agent phase 10 (14
October 2026). Every answer the agent gives in this walk is a real model turn
on that harness, billed to whatever account the harness is logged in to:
twenty or thirty turns in all, a few dollars on a frontier model. Give it two
sittings: steps 1 to 5 on an evening, step 6 the next morning, the rest
whenever.

**Why this page exists.** The proactive agent is an agent that speaks first:
it leaves work beside yours as **proposals** (dashed, hanging beneath what they
came from, each citing what prompted it and saying why in design words), works
overnight on what you agreed at `/goodnight` and reviews it with you in the
morning, explains how an item got here, reads your brief back, ripples a
change across screens, notices when it is guessing, wears critics' lenses,
walks a flow as other people, and offers the designer's word for a vague one.
Ten phases built it, and every one was proved by a journey in which the agent
was a script. **No journey can say whether any of it is welcome.** A proposal
that is correct and in the way is a failure; a morning review that is accurate
and not worth coming back for is a failure. Those are judgements, and they are
this walk. The bench (`docs/projects/proactive-agent/bench/`) puts one number
on the proposals, a model's guess at whether a designer would keep them; your
Keep and Delete outrank it.

**What to bring back.** For each step, the one-word answer it asks for, and
the sentence that made you say it. "Fine" is not an answer to a step that asks
whether something felt right: say what you would have changed.

**The one trap.** The agent answers only while `isocan rc` is running in a
terminal on your machine. If nothing happens for a minute after you ask, look
at that terminal first: it says when a summons arrives, when a turn starts and
ends, and why it did not.

---

## 1. Put down a canvas, and a lead

Make a new canvas in the app called **Acme Bakery walk** and copy its id from
the address bar (the part after `/p/`). In a terminal, in an empty directory
outside any repo:

```sh
export ISOCAN_CANVAS=<the id>
node <path to an isocan checkout>/docs/projects/proactive-agent/bench/night.mjs --fixture .
isocan add menu.html --title Menu --size 390x700 --at 0,0
isocan add basket.html --title Basket --size 390x700 --at 470,0
isocan add checkout.html --title Checkout --size 390x700 --at 940,0
isocan add history.html --title "Order history" --size 390x700 --at 1410,0
isocan add profile.html --title Profile --size 390x700 --at 1880,0
isocan comment add "Ravi says people miss the pickup slot: they only see it after the total." --item Checkout
isocan comment add "Not sure about the red on the buttons. It reads as an error to me." --item Menu
mkdir -p kit && isocan rc add Kit --dir kit
isocan canvas edit --prop proactive=Kit
```

Then, in a second terminal (leave it running for the whole walk):

```sh
export ISOCAN_CANVAS=<the id>
isocan rc
```

**You should see:** five phone screens in a row (Menu, Basket, Checkout, Order
history, Profile), two comments, and in the second terminal a line saying it is
answering on **Acme Bakery walk** with one agent enrolled.

**If a command is refused,** write down the command and the sentence it
printed.

## 2. A proposal arrives

In the Chat, type:

> @Kit people keep missing the pickup slot on Checkout. Don't change my screen; leave me something to look at.

**You should see:** within a couple of minutes, a copy of Checkout hanging
beneath it, framed in a dashed blue line and joined to it by a connector, with
a small ochre chip saying what prompted it (your comment, or Ravi's) and one
line of why in design words. A known design term in that line has a dotted
underline; pointing at it says what it means. Your own Checkout has not
changed.

**Answer:** was it **welcome**, **neutral** or **in the way**? Did it cover
anything of yours, at the zoom you normally work at and when zoomed out? Did
the why tell you something, or only restate what it did? Did the underlined
term teach you a word, or was it one you already use?

## 3. Keep one, delete one

Press **Keep** on that proposal. Then ask:

> @Kit one more idea for the Basket, a rough one.

When it arrives, select it and press ⌫ (or the **Delete** button). If the
toast offers a place for a reason, type one, e.g. *"a sign-up step is a gate"*.

**You should see:** Keep makes the proposal the next version of Checkout, and
the dashed copy is gone (one ⌘Z brings both back). The delete takes the
proposal away at once, with no dialog. A moment later the Chat says *"Noted:
…"*, and a note titled **What your deletes taught** on the canvas gains one
line, a rule a later proposal can be held to.

**Answer:** does the note's line say what you meant by deleting it, or
something you would not sign? Is a line in the Chat after every delete
**right**, **too much**, or **too little**? Would you edit or clear the taste
note, and did that feel like yours to do?

## 4. `/goodnight`

At the end of your session, type `/goodnight` in the Chat, with a few words
about your day if you like (*"long day, the basket still bugs me"*).

**You should see:** Kit opening a conversation: what you settled today, what is
left open, and two or three things it could try overnight, each with why. Steer
it once: drop one, add one, and name **Checkout** for a rework (*"rework the
checkout screen too, pickup first"*). It restates the plan each time. Nothing is
written on the canvas until you press **That's the plan** (or say so). Then a
**goodnight note** appears near your work: *Settled today*, *Left open*,
*Tonight I will* (ticked lines, each with a budget), *Will not touch*, and
*Ready by*. Under each screen a ticked line concerns hangs an empty dashed
frame. If you are not going to wait overnight, ask Kit for a ready-by half an
hour away before you say that's the plan.

Untick one line on the note.

**You should see:** its empty frame goes; the line stays on the note as an
offer, not a promise.

**Answer:** did the conversation feel like handing over to a colleague, or like
filling in a form? Was anything on *Will not touch* missing that you would have
wanted there? Did the note promise more than you agreed, or anything you did not
say?

## 5. Leave

Close the tab. Leave `isocan rc` running.

**You should see:** in the rc's terminal, a turn that runs for a while and
ends. Do not look at the canvas until after the ready-by time.

## 6. The morning review

Come back after the ready-by time and open the canvas.

**You should see:** a **While you were away** panel leading with Kit's brief:
one plain line first if the night failed or made nothing; then its words; at
most five proposals, sure ones first, then hunches, then any promise that did
not work, each with its reason; then **Left alone** (what it saw and did not act
on, and why); then Checkout, the one original you named, with **the version
before** one click away. Every empty frame is filled or says why not. Your
other screens are exactly as you left them.

**Answer, the most important on this page:** did the morning **earn the
return**? Would you open the canvas first thing for this, or would you skim
it? Was any proposal one you kept on sight, and any you deleted on sight? Say
which, and why. Was a failure said plainly, or dressed up? Did *Left alone*
make you trust it more, or read as filler?

## 7. Explain

Right-click Checkout (or select it and open its menu) and choose **Explain**.

**You should see:** a panel beside the canvas: *How it got here* (a handful of
named moves, not every version, each with who and the reason given at the
time), *The roads not taken* (the proposal you deleted, if it was on this
screen), *What has moved around it since*, and *Speak design* (a phrase you
typed beside how a designer would say it). The depth switch changes how much
it says. Escape closes it and leaves your view and selection as they were.

Press **Critique**.

**You should see:** Kit answers in the Chat with what is working, one risk and
one thing to try, and the thing to try arrives as a proposal beneath Checkout.

**Answer:** did Explain **teach** you something about your own screen that you
could repeat to Ravi? Was any move named wrongly, or any reason attributed to
the wrong person? Would you press **Copy as rationale** for someone outside the
team?

## 8. The brief, as a card

In the Chat:

> @Kit start a design brief for this canvas: a pre-order app for a neighbourhood bakery's regulars, who order weekly. Infer what you need and say what you inferred.

**You should see:** a card on the canvas: **Making**, **For**, **Should feel**,
**Never**, **Constraints**, **Right now**. Lines you said have a solid rule;
lines Kit inferred have a pencil rule with **Right** and **Wrong** beside them
(enter the card to see them). Press **Right** on one inferred line: it turns
solid. Now change **For** to *"regulars, and weekend first-timers"*.

**You should see:** nothing on the canvas changes. The card sorts your screens:
*still holds*, *assumed the old line*, *matters more now*, and Kit asks you
**one** question (something like *"As well as regulars, or instead?"*).

**Answer:** could you tell a said line from a pencil one without being told?
Were Kit's inferences ones you would have written, or ones you had to correct?
Was the re-read's question **the** question, or one you would not have asked
yourself?

## 9. Changes ripple

Open Menu and make three edits of your own, a few seconds apart (a colour, a
heading size, the order of two rows), then stop and wait a minute.

**You should see:** a row of small ticks in the canvas's top bar, one per
screen. Kit reads your edits back in the Chat as at most three **decisions**
(*"a quieter accent; a tighter type scale"*), may name one good move you made,
and shows the other screens as they would look after those decisions, as
proposals with the changed regions outlined: **would change**, **already in
sync**, or **disagrees, your call**, with one line arguing any exception.
Nothing changes until you choose. Keep one preview.

**Answer:** did the read-back name **the decisions you actually made**, in
words you would use? Did it see a decision you had not noticed you made? Were
any of the previews wrong about what "the same change" means on that screen?

## 10. Stuck

Ask Kit for a new header on Menu (*"@Kit a new header for Menu"*), and undo the
result with ⌘Z. Ask again, shorter (*"again"*), and undo. Once more (*"no"*),
and undo. Then ask a fourth time.

**You should see:** instead of a fourth header, Kit says it has been guessing,
names one to three things it noticed in what you kept and undid, and asks with
four pairs (density, brand expression, layout, tone of voice), each *now* and
*instead*, with its own guess highlighted, and two ways out: *show me extremes*
and *name a product that gets it right*. Answer it.

**Answer:** was the question **kind**? Did any line make you feel graded or
blamed? Were its observations true of what you did? Did the take after your
answer land closer?

## 11. Critics in the room

Open the menu under your name and, under **Experiments**, tick **Critique**.
Then:

```sh
isocan critic add reductionist
isocan critic add brand-voice
isocan critique Menu
```

**You should see:** two critic cards on the canvas; pins on Menu in each
critic's colour; and in the Chat one synthesis from Kit, not six forwarded
notes: where they **agree**, where they **split**, and any **blocker**. On a
split, **Build both** asks for two proposals, each tagged with the critic it
answers. Then run `isocan share --check`: a desk check prints (contrast, touch
targets, words against the Voice, screens behind the design system) and
nothing is changed.

**Answer:** did it feel like **a room** (two points of view and somebody
summing up) or like one voice in two colours? Was a split left to you, or
quietly decided? Would the desk check have stopped you sharing something you
should not have?

## 12. Walk it as someone else

Select Checkout, press ⌘K and choose **Walk it as someone else**, or run:

```sh
isocan walk Checkout --task "order a loaf for Saturday" --as one-handed --as low-vision --as first-time
```

**You should see:** a panel that says first, plainly, that these are
simulations and do not replace testing with people. One lane per walker: the
screens as that walker meets them (a thumb-reach overlay; the screens blurred
and washed out for low vision), stumbles pinned where they happen, each lane
ending *made it*, *stumbled* or *gave up*. Where two walkers stumble on one
screen, Kit names it and proposes one fix.

**Answer:** did the walk feel **honest**? Did the simulation notice read as
true or as a disclaimer? Did any walker read as a caricature? Was the shared
stumble one you would fix?

## 13. Say it like a designer

In the Chat, type, without sending: *"make the header pop more, it feels
cramped"*.

**You should see:** a dotted underline under **pop** and **cramped** and
nothing else. Pointing at *pop* shows three readings (more contrast, more
scale, more colour); pick one. The card offers the sentence a designer would
say; **Tab** takes it, **Enter** sends your own words unchanged. Send it either
way. Then type a few precise asks over the rest of the session (*"move the
total above the button"*) and notice whether anything is underlined. Type
`/vocabulary` to see the design words you now use.

**Answer:** did the readings **help or nag**? Did the pause to pick feel like
friction? Did anything precise get underlined? Did `/vocabulary` read as a
record of your words, or as a score?

---

## What this walk does not cover

- **A keep rate as a number.** The bench (`docs/projects/proactive-agent/bench/`)
  runs one night on a synthetic canvas and asks a model whether a designer
  would keep each proposal; the design-auditor persona owns that number (`node
  scripts/measure.mjs proposal-keep-rate`). This walk is your own keep and
  delete, which the number only guesses at.
- **Two people's nights on one canvas.** Each person's `/goodnight` is their
  own, and one person's promises never touch what another named; the tests
  hold that, and nobody has tried it with a colleague.
- **The phone.** The morning review leads the phone's digest too; this walk is
  desktop only.
- **A week away.** The cap of five does not grow with time away; nobody has
  come back after more than one night.
