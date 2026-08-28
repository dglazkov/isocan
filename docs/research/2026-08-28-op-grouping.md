# One gesture, one undo — grouping in the oplog

**28 August 2026.** **Built the same day**, as recommended below and before
the mind map. `LogEntry.group` is the field; `UndoStacks.nextUndoGroup` and
`nextRedoGroup` are where a stack of seqs became a stack of gestures; paste,
a text edit and `isocan copy` are the three callers. The three plural ops
stayed plural — this was not a migration.

The question: **should the oplog be able to say that several operations were
one act?** Raised after hitting the same edge three times in a day, and
written up because the answer turned out to be evidenced rather than argued —
this codebase has already paid for the missing mechanism, three times, in
public.

## The evidence: three plural ops already exist

`packages/core/src/ops.ts` carries these, alongside the singular forms:

```
| { type: "items.move"; moves: Array<{ itemId: string; x: number; y: number }> }
| { type: "items.delete"; itemIds: string[] }
| { type: "items.restore"; itemIds: string[] }
```

Each is the same op as its singular twin with a list where the id was, and
each exists for one reason: **undo is per operation**, so a multi-item act had
to become a single operation or it became N undo steps. `daemon.test.ts` says
it out loud in a test name — *"a hundred-item move is one op and one undo
step"*.

That is grouping, implemented ad hoc, once per gesture. It works, and it costs
a permanent addition to the shared vocabulary every time a new gesture needs
it — a shape both surfaces, the reducer, the inverter and every replica must
know forever.

## The three that hit it today

- **A text node edit is two ops** — `item.addVersion` for the words, then
  `item.update` for the title, because the title of a note is its words. Two
  ⌘Z for one edit. Recorded in `web/src/lib/text.ts` at the time as the honest
  cost of having no compound op, with the note that inventing one op type to
  save one keypress would be the wrong trade.
- **Paste is N ops** — one `item.add` per item. Pasting eight things is eight
  undos.
- **An agent-built mind map is dozens** — the research in
  `docs/projects/mindmap/` names this as one of the two costs of putting a map
  on the canvas, and it is the one with no local answer.

None of the three can be fixed by a plural op without adding a fourth, fifth
and sixth. `items.add` would need a list of versions and placements; a text
edit's two ops are not even the same op type, so no plural form exists for it
at all.

## The shape: a label on the entry, not a new op

The mechanism that fits what is already here is **an optional group id on the
log entry**, beside `cause`:

```ts
export interface LogEntry {
  seq: number;
  envelope: OpEnvelope;
  inverse: Operation | null;
  cause?: { kind: "undo" | "redo"; targetSeq: number };
  undoneBy?: number;
  group?: string;          // ← the whole proposal
}
```

Everything that makes this cheap is already true:

- **The op vocabulary does not change.** No new type, no reducer change, no
  inverter change. `invertOperation` still inverts one op against the state it
  is about to be applied to, which is the property the whole undo design rests
  on.
- **`UndoStacks` already holds seqs**, per canvas and per actor. Grouping is
  pushing a set where it pushes one, and popping the set. Its own doc comment
  is already about walking YOUR ops backwards past other people's.
- **It rebuilds from the log**, exactly as `undoneBy` is "reconstructed from
  `cause` on load; never rewritten into the log file".
- **Old logs stay readable.** An entry with no `group` is a group of one,
  which is today's behaviour exactly.

Ops that are already plural stay plural. This is not a migration.

## Who decides a group, and the trap next to it

**The client decides.** A group is an intent — "paste these eight", "rename
this note and its title" — and the daemon cannot infer it. So the group id
travels with each op the way `opId` and `clientId` already do, which means
the CLI can group too: `isocan copy` writing eight items is one gesture on
somebody's screen and should be one undo there.

**Time-based coalescing is the trap.** Grouping ops from one actor within N
milliseconds is the cheap version and it is wrong: it guesses, it joins
unrelated fast ops, and it would behave differently on a slow machine.
Correctness that varies with the speed of the writer is not correctness.

**A group is a LABEL, not a transaction**, and conflating the two is the
second trap. If op five of eight fails, the four that landed are real: they
are on the canvas, everyone can see them, and undo must handle exactly that.
Atomicity would mean rolling back a distributed write across a replica and a
home — an enormously larger promise, and not one this feature needs. Say
plainly: a group means *undo these together*, and nothing about whether they
all arrived.

## What it does not solve

- **Nothing spanning canvases.** Undo stacks are per canvas, so a cross-canvas
  paste is one group on the target and nothing on the source. That is correct
  rather than a limitation — the source did not change.
- **Not a "transaction" anybody can rely on.** See above; it must not be
  documented as one, or somebody will.
- **Not partial undo.** Undoing part of a group is undoing a different act
  than the one that happened. If that is ever wanted, it is a separate ask
  with its own argument.

## Cost, honestly

Small, and concentrated in one place. `UndoStacks` learns about sets; the
entry gains an optional field; the protocol carries it; the three callers that
want it pass one. The risk is not size but **subtlety** — undo is the feature
where a wrong answer is a person losing work they cannot get back, and its
current design (inverses computed pre-apply, stale inverses accepted, invalid
ones skipped) is careful in ways that took time to arrive at. Any change here
earns its tests on interleaving: a group with somebody else's ops inside its
seq range, a group partly undone by a conflicting delete, a group replayed on
load.

## Recommendation

Worth doing, and worth doing **before** the mind map rather than after. The
map is the first feature where the absence is not a papercut but the main
interaction — an agent building thirty nodes from one sentence, and a person
who cannot take it back in one gesture.

Until then, three plural ops and a note in each affected file is the status
quo, and the note is now in three files.
