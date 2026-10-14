## Critics

A **critic** is a persona that lives on the canvas: a markdown card in the
persona format, marked `critic: true`, that points and explains and never
edits. Its card holds who it is (`agentName`, a principle, never a person),
a `credit` line saying who it is after and that it is not affiliated, its
`color`, a `budget` per critique, three numbered questions, and two headings
— *What it looks for first* and *How it ranks*.

- `isocan critic ls` — the roster this build offers, and the critics on this
  canvas with their questions and budget (`--json` for both). A card whose
  name breaks the rules is listed with what is wrong.
- `isocan critic add <critic>` — a roster critic onto the canvas, by id or
  name (`critic add inevitable`), its lens copied from its pack's
  `critique.md`. Refused, in words, when that critic is already here or its
  first word is another critic's (mentions resolve by first word).
- `isocan critic new "<name>"` — a skeleton to fill in. `--after "<person>"`
  credits who it is an homage to, and its name may not carry theirs;
  `--self` is for a critic you made of yourself.
- Editing is `isocan edit <card> critic.md` — the card is the critic, so the
  next critique reads what you wrote. `critic ls` re-reads it.

### Asking for a critique

- `isocan critique <item> --by <critic>` — asks one critic what it makes of a
  screen (`isocan critique "#Checkout" --by inevitable`). The first time on a
  canvas it enrols the critic on **your** runner, so your `isocan rc` must be
  parked there — without one it says so and enrols nothing. Every time, it
  re-reads the card and rewrites the critic's working directory from it, then
  opens one thread on the screen that @mentions the critic; the rc's ordinary
  wake does the rest. `@Inevitable what do you make of #Checkout?` in the Chat
  wakes an enrolled critic the same way.
- The critic is bounded per run (the thread that asked) by its card's
  `budget`: turns, counted by the rc, and dollars where the harness reports
  them. At a cap the rc stops it and says so in the thread in one line.
- `isocan critique notes <item>` — the critics' notes on a screen, read back:
  who, kind, question, where (fractions of the screen) and the move.

### Two critics, and the read

- `isocan critique <item> --by inevitable,frog` — asks two (or more) at once:
  each is enrolled and capped as above, and ONE thread on the screen mentions
  them all. Each works alone — its brief says read the screen, not the thread
  — and its done line is a record, so it wakes nobody. The **last** critic's
  done line mentions whoever asked, which is the one wake the read needs. A
  critic the rc stopped at its budget counts as done.
- `/critique #Checkout with Inevitable and Form Follows Emotion` in the Chat is
  the same ask through a parked agent (`isocan command show critique`). That
  agent is the **lead**: it runs `critique --by`, ends its turn, and is woken
  by the last done line to write the reply.
- `isocan critique read <thread|item>` — the fold: **agree** (two or more
  critics, one kind, pins within 0.15 of the screen of each other, moves not
  opposed), **split** (in one region, one critic's *working* or "Leave it."
  against another's change, or one's *remove/cut* against another's
  *add/enlarge/replace … with* — read from the move's verb) and **blocker** (every blocker), each citing its
  notes, and the rest *on their own*. `--json` for the groups. It says when a
  critic is still working, and refuses a critic that is.
- `isocan critique read <thread> --post --say "<your words>"` — the one reply,
  posted once every critic is done: your words, naming each tension in design
  words (reduction against warmth), then the fold's grouping. Do not average a
  split or pick a side. Without `--say` it posts the fold alone — say so if
  that is what you did. The reply is a record: it does not wake the critics.
- `isocan critique both <note>+<note> [--to <agent>]` — on a split
  (the ref `critique read` prints beside it), asks an agent that may edit —
  the lead by default — in the request thread for two variations of the
  screen, one answering each note: `isocan add … --prop parent=<screen> --prop
  critique.answers=<note>`, /variation's procedure for two. A critic is never
  the builder. If you are asked, build exactly the two, leave the screen as
  it is, `isocan format`, and reply once.
- `isocan critic release <critic>` — lifts the critic's ceiling (below) on
  this canvas, so the same agent may edit here again. Only whoever set it can;
  `isocan rc remove <name>` lifts it too, with the standing. The next `critique`
  caps it again.

**A critic is capped at notes.** Asking caps the critic's standing on that
canvas, and the home holds it whatever the critic's instructions say: from
the critic, the canvas accepts a thread pinned to an item (`critique note`,
`comment add --item`), a reply in a thread (`critique done`, `comment reply`)
and a reaction (`react`, with or without `--at`) — and refuses everything
else, an edit, a move, a new item, a free-standing thread, an undo, with
`beyond-ceiling` and a sentence, writing nothing. It cannot lift its own
ceiling. If you are a critic and want something changed, the note saying what
to change is the whole of your power. A capped critic is also woken only by a
mention of it — never by the Chat, a reply in a thread it was asked in, or a
change — and its inbox says the same (core's routing rule, so `wait`, the rc
and the web agree).

### When you are the critic

Your card is in your `AGENTS.md`. Read the screen (`isocan get <item>`), not
the threads, and answer only with these two:

- `isocan critique note <item> --at <fx,fy> --kind working|risk|blocker
  --question <n> "<what you see, then one move>"` — a note pinned at a point
  on the screen, as fractions of its size (0,0 top-left, 1,1 bottom-right).
  The verb writes the first line itself (`**Risk** · question 2 · *…*`); a
  note's text never names its own kind. *Working* is a finding too: say
  "Leave it."
- `isocan critique done <item>` — your last act: says in the request thread
  how many notes you left, of what kind. Then end your turn.

`isocan comment add <text> --item <item> --at <fx,fy>` pins an ordinary
thread at a point on an item the same way (without `--at`, `--item` hangs it
off the item's corner).

In the app the cards draw as critic cards behind **Settings → Experiments →
Critique**, and as plain markdown without it. A critic's pins wear its
colour, because `critique` gives the critic's actor the card's colour.
