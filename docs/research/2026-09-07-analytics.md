---
status: designed
since: 2026-09-07
issue: 200
see: evals, personas
note: not to be built yet — the finding is that isocan already has three measurement systems and an event stream, and the honest first question is what none of them can answer
---

# Analytics: what the oplog cannot already tell us

**7 September 2026.** Research. Nothing built, and asked for explicitly on the
condition that nothing is.

## The thing to notice before choosing a vendor

**This project already measures itself in three ways, and already records
every action anybody takes.**

- **The oplog.** Every operation carries `seq`, its envelope (op, actor,
  timestamp), its inverse, and its undo/redo cause. `isocan recap` and
  `evals corpus` already fold it. This is an event stream with a schema, one
  per canvas, and it predates any analytics decision.
- **The personas.** Nine standing numbers with declared bounds, run nightly,
  with a queue that can now fail (#197 phase 3).
- **The evals corpus.** `scripts/calibrate.mjs` and `scripts/lift.mjs` already
  measure the thing most products would *want* analytics for — whether the
  agent collaboration works, hand-labelled, with κ agreement reported.

So the first question is not "which analytics" but **"what do we want to know
that the oplog cannot answer?"** That question has real answers, and naming
them is most of the design:

**Things the oplog knows already:** what was created, moved, versioned, said,
undone; by whom; when; on which canvas; and in what order. Retention,
frequency, session shape, which ops are common, which features are used, what
gets undone immediately after being done — all of it, exactly, with no new
plumbing.

**Things it structurally cannot know:**

1. **Anything that is not an operation.** Opening a panel, hovering the
   minimap, abandoning the Add sidebar, reading a thread without replying,
   zooming out and closing the tab. Most *failure* is silence, and silence
   writes no ops. This is the real gap.
2. **Anyone who never made it in.** A person who hits the door and leaves is
   invisible; there is no canvas for them to appear in.
3. **What happened before the daemon.** Install, `setup`, and every reason
   somebody bounced off before a canvas existed.
4. **Whether it felt fast.** Now partly covered by `idle-at-rest`, but frames
   and time-to-first-paint on real machines are not in any oplog.

Category 1 is the strongest case for building anything, and it is worth
noticing that it is precisely the category the 6 September freezes lived in:
tabs burning a core for two days, and the only reason anybody knew was that
Dion looked at Chrome's Task Manager himself.

## The constraint most products do not have

**Usage happens on two surfaces, and this project's entire thesis is that they
are equal.** A web-only analytics install would systematically under-count
exactly the population isocan is built for — agents and CLI users — and would
then be quoted in decisions. That is not a gap to fill later; a measurement
that is wrong in a known direction is worse than none, and this repo has three
lessons on instruments that report healthy while blind (`lessons.md` #8, #13,
#14).

Anything built here has to answer for the CLI on day one, or say out loud in
its own output which half it can see.

## Privacy, stated plainly rather than as a checkbox

Canvases hold people's work. A canvas id in an event payload is a pointer to
private content, item titles are content, and thread ids identify
conversations. Whatever is built should be able to state, in one sentence
somebody can check, what leaves the machine — and the daemon being *local* for
most users means events would have to be deliberately sent somewhere they
currently never go. That is a change in what this software is, not just a
feature, and it deserves being decided rather than defaulted into.

## The shape worth considering, if it is ever built

1. **Fold the oplog first.** Whatever question prompts this, try answering it
   from `isocan recap` / `evals corpus` before adding a pipeline. Several
   likely questions are already answerable today, at zero privacy cost.
2. **A named, small event vocabulary for category 1 only** — the things that
   are not operations — rather than a general "track everything" client. This
   project's op vocabulary is deliberately held at 33; an event vocabulary
   should be held with the same suspicion, and each event should name the
   decision it exists to inform.
3. **Both surfaces or neither**, per above.
4. **Self-hosted before third-party.** The daemon already speaks a protocol
   and already writes logs.

## Recommendation

Not now, and the reason is not caution. **The measurement culture here is
unusually strong and the gap is narrow** — one real category, largely about
what people do *before* and *instead of* acting. Building a general analytics
pipeline would add a fourth system that overlaps the three that exist, and the
thing that would actually pay is much smaller: a short list of non-op moments
worth knowing about, decided by naming the decisions they inform.

When somebody has a question they cannot answer, write the question down here
first. If the oplog can answer it, the answer was free.
