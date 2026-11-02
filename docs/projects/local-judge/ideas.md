# The judge in the tab — use cases, ranked

Each idea below is a bounded decision: a question with a fixed set of answers,
a place the answer would appear, and a disposition a person or an existing
guard owns. They are ranked by **what already exists to measure them against**,
because a use case with no labels and no baseline is a demo, not an
experiment.

For every idea: **the question**, **what it replaces or competes with**,
**where its labels come from**, and **what it may never do**.

| # | Idea | Question type | Labels already exist? | Baseline to beat |
| --- | --- | --- | --- | --- |
| 1 | The Chat intent router | choice | yes — evals' hand-labelled asks | `categoriseAsk` (regex + command map) |
| 2 | The voice fast path, locally | choice ×4 + yes/no | yes — the OPFS shadow log | Jev on the home, same questions |
| 3 | Find by meaning | retrieval | partly — build a small set | substring / fuzzy subsequence |
| 4 | Clarify before spending | yes/no + choice | from 1 | sending it and paying |
| 5 | Wireframe round 1, locally | yes/no per screen | yes — `isocan judge corpus` | Jev's P(yes), ECE 0.39 |
| 6 | Who should take this? | choice over agents | thin — mentions that followed | nothing (no suggestion today) |
| 7 | File it where it belongs | choice over areas/groups | moves people made after placing | auto-placement |
| 8 | Probably the same thing | similarity | merges and deletes | nothing |
| 9 | One thing, two names | similarity over UI strings | the hand-kept `NAME_FAMILIES` | the hand-kept list |
| 10 | What needs me first | ordinal score | what a person opened first | chronological digest |

---

## 1. The Chat intent router *(start here)*

**The question.** Given the Chat line and the structured state (selection,
role, which modules are present), which act is this: `wire` (new screens),
`edit-selection`, `variation`, `find`, `ask-agent`, `clarify`,
`just-a-comment`? These are the test plan's six routes translated into
isocan's own commands.

**Why it's first.** It is the cleanest version of the experiment, and isocan
already has both a rules baseline and labels for it. `categoriseAsk`
(`core/src/evals.ts`) sorts every ask into fifteen categories by slash command
and regex, "calibrated against hand labels and reported with its agreement
rather than trusted" — it agrees with them on **84%**
([what people ask agents for](../../research/2026-09-03-what-people-ask-agents-for.md)).
That is approach A in the test plan, already built and already scored, and
the hand-labelled asks are the labelled set. The router's seven routes are
mostly a coarser cut of the same fifteen categories, but not entirely: none
of the fifteen reaches `find` or `clarify` (phase 1 found this), so those two
routes need labels of their own.

**Where it appears.** A suggestion line under the composer (Scene 1): the
command it would become, or a clarifying chip when it is unsure. Today a slash
command is only comment text that an agent later reads; most people never
learn `/variation` exists.

**May never.** Send, rewrite or reroute the comment. Taking the suggestion is
the person's own edit to their own text.

## 2. The voice fast path, locally

**The question.** Exactly the fast path's five: `action`, `subject`,
`relation`, `target`, `simple` (`talk/src/fastpath.ts`), over the utterance
plus `canvasSnapshotText`.

**Why it's second.** It has the best evaluation data in the repo for free.
Every spoken turn in shadow mode already records what the fast path guessed,
what the live model did, and whether the person undid it within ten seconds or
said "undo" — per browser, in OPFS. Running `local` beside Jev on the same
turns is a paired comparison with real labels and no new collection. And
latency matters most here: Scene 3 is only worth anything if the act lands
before the person finishes speaking.

**The catch.** `subject` and `target` are choices over item titles, up to 255.
That is retrieval as much as classification, which plays to the model's
strength, and is also where a zero-shot decision layer is most likely to need
idea 3's index.

**May never.** Act on any verb without its own measured threshold. Today only
`move` has one (p ≥ 0.63, 63 of 66 agreeing); `local` earns its own, by the
same rule, before it acts on anything.

## 3. Find by meaning

**The question.** Retrieval, not choice: embed every item's title and text
once (the model's document formatting), embed the query (its query
formatting), return the nearest. These are different embedding tasks and
must not share formatting with the classifier.

**Where it appears.** ⌘K gains *On this canvas* (Scene 2) — today it does not
search items at all. Voice `find_items` and the fast path's `subject` can use
the same index.

**Why it matters.** It is the one use case the model is *directly* built for,
and it answers Loop's finding with something a person can try. It also works
offline, which nothing else here does.

**What to measure.** Is the right item in the top five, against a set of
queries written by people who did not write the titles, compared with
`fuzzyMatch` on the same queries.

**May never.** Send the index anywhere. It is built per browser, from items
this person can read, is stored in OPFS, and can be forgotten.

## 4. Clarify before spending

**The question.** Is this ask specific enough to act on (yes/no), and if not,
which of the plausible readings should be offered (choice)?

**Why.** `/wire`, a summoned agent and a design competition all spend money
on the owner's key ([keys](../keys/phases.md)). *Make it better* sent to an
agent costs a full turn to produce something that answers a guess. A local
judge that recognises the vague ask and turns it into three chips costs
nothing. It is idea 1's `clarify` route, made worth a phase of its own by the
money it saves.

**May never.** Block the send. The person can always send it as written.

## 5. Wireframe round 1, locally

**The question.** For each screen round 1 considers: does this request need
it? The question Jev answers today, whose answers the
[judge](../judge/design.md) project is turning into a calibration corpus.

**Why.** It is the one place isocan already acts on a judge's probability
(sure → kept, unsure → drawn *maybe*, low → not drawn), and `isocan judge
corpus` already folds a person's keeps and removals into labelled rows. The
same rows can score `local` against Jev, both on accuracy and on the
reliability curve — Jev is overconfident by about 0.4 on archetype questions,
so the bar for "better calibrated" is not high.

**The catch.** The corpus concludes at about 470 rows and grows only as fast
as people use `/wire`. This idea waits on the judge project, not the other way
round.

## 6. Who should take this?

**The question.** For a main-thread comment with no mention: which enrolled
agent (by its own description as the criterion), or nobody?

**Where it appears.** A chip under the comment, for its author only: *Ask
@Auditor?* (Scene 4).

**Why it's careful.** The wake rule in `core/src/inbox.ts` is deterministic on
purpose — mentions and thread membership, nothing that classifies meaning —
and stays so. The judge proposes a mention; only the person's tap adds it.

**May never.** Wake anyone.

## 7. File it where it belongs

**The question.** A card is dropped onto a board with areas (a sprint's
phases, a design competition's lanes, a person's own groups): which area or
group, or none?

**Why.** The judge design's own picture — "position carries the probability"
— needs a judge cheap enough to run on every drop. A local one is.

**May never.** Move it without an accepted act. The proposal is a ghost
outline; accepting it is one `transform`, one undo.

## 8. Probably the same thing

**The question.** Of the items on this canvas, which pairs say nearly the same
thing? Nearest neighbours above a similarity measured on real duplicates.

**Why.** Long canvases accrete repeats: two notes from two people, a screen
and its forgotten copy. Surfaced as a quiet badge, never acted on.

**May never.** Merge or delete. *Say two things are probably the same; delete
neither* is a row of the judge design's own table.

## 9. One thing, two names

**The question.** Across the app's own UI strings, which pairs name the same
concept differently (*Trash* and *Bin*)?

**Why.** [copy-edit](../copy-edit/phases.md)'s `NAME_FAMILIES` is a hand-kept
list, and `UNCHECKED_TELLS` names rules a pattern cannot judge. Similarity
over strings can *propose* new families for a person to add to the list. It
runs on the repo, not on a canvas, so it is the lowest-risk privacy case and
the least user-visible.

**May never.** Edit the list; it proposes rows.

## 10. What needs me first

**The question.** An ordinal score: how relevant is each new thing in my
prior-visit digest to what I was working on?

**Why.** The digest is chronological. Sorting it is exactly what the judge
design allows — *sort a queue by likely relevance; never drop the tail*.

**May never.** Hide anything. Everything stays in the digest; only the order
moves.

---

## Not on this list, on purpose

- **Anything that executes.** Every idea ends in a suggestion that a person's
  act turns into an existing op.
- **Multi-step planning.** The model card says it is weak at complex tasks; a
  planner is an LLM's job, and isocan has those.
- **Policy compliance.** Permissions, roles and admissions are known facts;
  the model is never asked to infer them.
- **Screenshots, at first.** EmbeddingGemma 2 has a text-plus-vision
  configuration, and the test plan says add images only where they should
  change the answer. A later comparison — text vs text + retrieved context vs
  text + screenshot — once text routing has a number.
