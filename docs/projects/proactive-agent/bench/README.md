# A proactive agent — the night bench (phase 11)

**Status, 14 Oct 2026: built, rehearsed with a scripted lead, not run for
real.** The real night spends model turns on the lead's harness and the judge
spends calls on a text key; both wait on Dion's yes. No text-model key resolves
on this machine today (`resolveTextKey` finds none), so `judge.mjs --yes` would
stop before its first call, as it is written to.

## What it is

One night of the proactive agent, end to end, on a synthetic canvas, with
every proposal recorded; then a judge asked, per proposal, whether a designer
would keep it.

| File | What |
|---|---|
| `night.mjs` | builds an Acme Bakery canvas on a **scratch daemon** (temp `ISOCAN_HOME`, a free port, owned by `scripts/lib/daemon.mjs` and taken down with the script; never isocan.io, never port 4441), enrols **Kit** through `isocan rc add` and names it lead, then walks the night from a terminal: `goodnight start` → Kit's opener → one steer naming Checkout → `goodnight plan` ("That's the plan") → the night → Kit's `goodnight done` → `goodnight review`. Writes `night-results.json` |
| `judge.mjs` | one cheapest-tier call per proposal with a take: "would a designer keep this, given its source, its cite and its why?" → `keep`/`delete` and one line. Writes `judge.json` |
| `night-results.json` | written by a real night: the lead (harness, model), the conversation, the note, the brief, the morning review (JSON and text), every proposal (source title and text, take text, cites resolved to the words they point at, why, kind: `sure`, `hunch`, `failed`, `promised`), every original edited (`edit`, with the text before), and which screens were untouched |
| `judge.json` | written by the judge: a verdict and a line per proposal, what was skipped and why, the keep rate the design-auditor persona reads |

The fixture is five phone screens (Menu, Basket with an empty state, Checkout
with the pickup slot below the total, Order history, Profile), a menu variation
chosen today (so *settled today* has something in it), and three comments: the
pickup slot people miss, an `/ask` about the empty basket (so *left open* has
something in it), and a doubt about the red. The person says three things:
`SAYS` in `night.mjs`.

## Running it

From this directory:

```sh
node night.mjs --plan            # the fixture, the flow, the harness it would use; free
node night.mjs --dry-run         # build the canvas on a scratch daemon, enrol Kit, stop before summoning it; free
node night.mjs --stand-in        # the whole flow, Kit played by packages/cli/test/fake-acp.mjs; free, writes to a temp file
node night.mjs --fixture <dir>   # the five screens as HTML, for the verify walk; free
node judge.mjs --plan            # the calls it would make (projected until a night exists); free
node judge.mjs --plan --night <file> --prompts   # ... and every prompt in full

# the real run, on Dion's yes, once:
node night.mjs --yes [--harness claude-code] [--model <id>] [--minutes 60] [--keep]
node judge.mjs --yes
node ../../../../scripts/measure.mjs proposal-keep-rate
```

`night.mjs` with no mode prints the plan and refuses (exit 2). `--keep` leaves
the scratch daemon up at the end and prints how to open the canvas, so a person
can walk the morning in a browser; Ctrl-C takes it down. A night that runs past
`--minutes` is recorded anyway, with `finished: false`.

`judge.mjs` prints its plan, then refuses with zero calls (exit 2) without a
`night-results.json`, without `--yes`, or without a key. It also refuses to
write `judge.json` from a stand-in night: that would be the script's keep rate.
The key is resolved as the Semantic Zoom bench resolves it, importing
`resolveTextKey` from `@isocan/core/keystore` through `tsx`
(`ISOCAN_TEXT_API_KEY`, else `keys.json` under `ISOCAN_KEYS_HOME`,
`ISOCAN_HOME` or `~/.isocan`), and is never printed, logged or written.

## What the rehearsal proved

`node night.mjs --stand-in` (14 Oct 2026, 42 s, exit 0) ran the real daemon,
the real `isocan rc` and the real goodnight verbs, with the journeys' scripted
ACP agent as Kit and **no model**: three summonses (opener, restatement, the
night), a note with four lines, two Basket takes (one sure, one hunch), a
failed Order history regroup with its take, Checkout edited because it was
named, and one extra proposal on Profile citing the comment about the red.
The record read all five back with their cites resolved (`promise:<note>#n` to
the promised line, `comment:<id>` to the comment's words) and the four other
screens untouched; the morning review was due and its text listed the four
proposals sure-first, the failure's reason, *Left alone* and the edited
Checkout. `node judge.mjs --plan --night <that record>` planned 5 calls
(`sure` 1, `hunch` 2, `failed` 1, `edit` 1), and `--yes` stopped at "No
text-model key is configured. Nothing was called."

What the rehearsal cannot prove is the only thing the real run is for: what a
real lead proposes, and whether any of it is worth keeping.

## What it costs

- **The night:** the lead's harness, on whatever account it is logged in to
  (nothing here sees a key). With `claude-code` on this machine: about three
  to five turns (the opener, the restatement, then one long night turn that
  writes the note, fills four or five promises with HTML takes, and posts the
  brief). Expect the night turn to be the bulk: some tens of tool calls and a
  few hundred thousand input tokens, most of them cached. At the Sonnet 5.5
  list price the Semantic Zoom bench uses ($2 in / $10 out per million), that
  is in the order of **one to three dollars**; pinned to a larger model, more
  in proportion. The rc's own narration reports the harness's figure where the
  harness sends one.
- **The judge:** five to seven calls on `claude-haiku-5-5` ($0.10 / $0.50 per
  million), each about 1,000–2,000 tokens in and 100 out: **well under a
  cent.** Capped at 20 calls.

## A measure of real keeps and deletes: why not yet

Phase 1 left "kept and deleted proposals are not yet judge-corpus labels"
open. The canvas does record a person's verdicts — Keep is `choose`, so the
proposal's bytes become a version of its source and it goes to the trash; a
delete trashes it and leaves a comment carrying `deleted: <itemId>` — but
**nobody keeps or deletes anything on the bench's canvas**: it lives on a
scratch home that goes with the script, and no person is there. A measure of
real keeps would read a canvas a person used, which lives in a home this repo
does not read, and should not (the same reason Loop gets measures and not an
oplog digest). The route when it is wanted: `night.mjs --yes --keep`, Dion
walks the morning in the browser and keeps or deletes each proposal, and a
`labels` step reads the verdicts back from that home into
`night-labels.json` beside `judge.json`, so the judge's rate and the
person's can be compared on the same night. That comparison, not either
number alone, says whether the judge can be trusted.

## Bias to watch

The judge is a model's opinion of taste, from the screens' text with the tags
stripped: it never sees the layout. A proposal whose whole point is visual
(the pickup slot moved above the total) reads as a reordering of words. It is
a proxy for the person's Keep and Delete, which outrank it; the verify walk
(`docs/verify/2026-10-14-proactive-agent.md`) is where those are asked for.
