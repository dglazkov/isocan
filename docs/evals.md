# Evals, and how the skills and prompts get better

**Written 2 September 2026.** How isocan finds out whether it is any good at
the thing it exists for, what that machinery is today, and how it turns what
it finds into better skills, prompts and guides — without a person having to
remember to. [`projects/evals/plan.md`](projects/evals/plan.md) is the staged
plan this grew from and the record of what each stage measured;
[`research/2026-08-24-the-night-shift.md`](research/2026-08-24-the-night-shift.md)
is the argument for the loop; [`reviews/lessons.md`](reviews/lessons.md) is
the catalogue of what went wrong and what now catches it. This page is the
map for a reader who has not read those.

## The one idea

**Measure before you opine, and turn every lesson into a guard.** Most eval
programmes start by picking a metric and asking a model to judge prose. Ours
does not have to: a canvas's outputs are files with contrast ratios and DOMs,
its history is a replayable log in which every undo is a labelled rejection
and every version choice a labelled preference, and its requests are comments
with the names of who was asked. The programme is built to spend that
advantage first and to reach for a judge last — and everything it learns is
kept as a test that runs, not a note that gets skimmed.

## What runs today

| Thing | Where | What it answers | When |
| --- | --- | --- | --- |
| **The request corpus** | `isocan evals`, `core/evals.ts` | What people ask agents for, and what happened next — answered, cancelled, silent; the ops each ask produced; preference pairs harvested from version choices. Every row says which of three joins produced it: `anchor` and `reference` are facts, `window` is a labelled guess. | On demand, local, no score |
| **Deterministic graders** | `scripts/grade.mjs`, `grade-night.mjs` | Eight checks on a real screen at 390/768/1440: renders, contrast against what is painted, stretched images, sideways scroll, unnamed controls, target size, alt text, the greppable slop tells. Counts, never a weighted score. | Nightly (`grade.yml`, 08:23 UTC) → a dated page in `docs/grades/`, as a pull request |
| **Golden tasks** | `evals/golden/v1/`, `scripts/golden.mjs`, `scripts/lib/golden.mjs` | Twenty tasks weighted by what people actually ask — revise, create, restyle, repair, then one each of the rest. A synthetic fixture, an ask, and checks a machine can make: what the file says, in what order, what stayed untouched, plus the screen checks by name. `--task`/`--dir` grade an attempt; `--selftest` requires every answer to pass and every fixture to fail. Versioned. | On demand; the browser-free selftest on every push (`test/golden.test.ts`) |
| **The graders' own test** | `grade.mjs --selftest`, `test/fixtures/deliberately-bad.html` | Whether the grader still sees anything — a page built to fail every failable check must fail them all. Gates every nightly run. | Before every grade |
| **Personas with numbers** | `.agents/personas/*.md`, `scripts/persona-run.mjs`, `scripts/measure.mjs` | Eight standing lenses, each with a goal that is `(number, bound, the command that produces it)` and a measured baseline — largest chunk, contrast failures, unused exports, eslint errors. Two bounds are ratchets. A run takes the numbers, writes a page, changes nothing, and may not touch the persona. | Nightly (`persona.yml`, 08:43 UTC) → `docs/reviews/<date>-<persona>.md`, as a pull request |
| **Journeys** | `scripts/journeys.mjs`, `journeys.yml` | Whether the app still works when a browser drives it — the checks the suite structurally cannot make. | Weekly |
| **The suite as a guard rail** | `vitest`, ~3,000 tests | Not evals, but where evals' findings end up: every entry in `lessons.md` names the test that would have caught it. Several are structural — the agent guide must name every CLI verb; a feature must reach both surfaces; a coordinate placement must say `chosen` or say why not; every `see:` must name a project. | Every push; CI moves `green` only when it passes |
| **The changelog and the board** | `changelog.yml`, `scripts/canvas-board.mjs` | The day's record, written by a bot as a pull request; the repo's own numbers as panels on a canvas. | Nightly; on commit |

Three rules hold all of it together, and each was paid for:

- **A grader that reports zeros when it breaks is worse than no grader,
  because it is believed.** The first grader scored a stretched image 8/8
  because its probe threw and every reading fell to empty (lesson #8). Hence
  the selftest as a gate, and the persona runner exiting non-zero for exactly
  one reason — an instrument that would not run.
- **A bot writes a pull request, never to main and never to a canvas.** Every
  nightly opens a PR with a dated page. A person merges it. The night shift's
  discipline is that nothing lands unread.
- **Nothing leaves the machine.** The corpus, the graders, the runs — all
  local. The plan's last stage says what could ever be shared (a category, an
  outcome, a score; never content, text, titles or screenshots), and it is a
  choice a person makes, not a default they discover.

## What the numbers said

Measured, not assumed, and dated — and then read, which changed them.

**1 Sep 2026**, across 21 canvases at one home, the corpus said **384 asks —
259 answered, 31 cancelled, 94 silent**: one ask in four gets no answer.
**3 Sep**, every row at that home was read and labelled by hand
([the note](research/2026-09-03-what-people-ask-agents-for.md)), and both
halves of that headline turned out to be artefacts of a join. **73% of the
rows were agents' own prose** — one bot's build notifications were a third of
the corpus by themselves — and the silent rows were their receipts, correctly
unanswered. Of the **98 asks people made, 95% were answered, 4% went silent,
1 was cancelled.** The 31 cancels were one `/cancel` in the Chat scored
against every earlier ask by that person; fixed, with a test built from the
measured shape.

What people ask for: **revise 21%, create 18%, orchestrate 13%**, then
question, arrange, social, restyle, document, critique, repair, variation,
converge. Editing beats making two to one. One ask in eight is a person
pointing an agent at a comment rather than asking anything. Diverge and
converge together are 6% — real, and the base rate the preference-pair
harvest has to grow from. **11 preference pairs**, up from 2 on 23 Aug: the
human-labelled comparison data every judge needs is real, and two orders of
magnitude short of a calibration set. The reading that matters for product:
nothing generates preference pairs until divergence is something people use,
and people stack versions and choose twice — so the morning ritual below is
not a nicety, it is where the labels come from.

And the lesson, in the form the catalogue gives it: a caveat on a number is
not a correction to it. The corpus said its broadcast count was an upper
bound; it was believed anyway. Hand-labelling was not a preliminary to
measurement, it was the measurement's audit.

## How a finding becomes a better skill or prompt

The skills and prompts are in the repository, as files a test can read: the
slash commands agents run (`core/commands.ts` — `/sprint`, `/ask`,
`/variation`…), the guide every agent reads first
(`cli/src/agent-guide.md`), the collab skill that points at it
(`.agents/skills/isocan-collab/SKILL.md`), and the personas' own prose. So
improving a prompt is a commit, and a commit can carry a guard. The loop
that exists today, with a real example from each step:

1. **Something is measured or observed.** A run's page says a number moved;
   `isocan evals` says a class of ask goes silent; a person reports "the text
   tool is flaky" with three flows; a journey fails.
2. **The finding is written where the next reader will meet it.** A lesson in
   `lessons.md` with its shape; a finding row on a persona page, `unanswered`
   until a person writes `accepted` or `rejected`; a "what was built" section
   in the research note that owns the feature.
3. **The prompt changes, and the change is pinned.** The `/sprint` skill's
   setup step now lays the board before it asks anything, and
   `web/test/walk.test.ts` reads the skill's text and fails if that sentence
   goes. The agent guide gained `isocan area` and `--in`, and
   `cli/test/surface.test.ts` refuses a CLI verb the guide does not name. A
   prompt that drifts back fails a test, which is the only kind of prompt
   improvement that survives the next model.
4. **A recurring finding becomes a guard, and the prose goes.** `reviews/README.md`
   says it in one line: *a finding that keeps reappearing across runs is a
   finding that needs a test, not a third mention.* A persona's memory is the
   guards it wrote, not the notes it left — prose is the staging area.
5. **A change to a skill that claims to help says which number it moves.** The
   night-shift rule, in one sentence: an overnight change may be called an
   improvement only if it names, before the work starts, a number already
   being measured, and moves it the right way without moving another the
   wrong way. Anything that cannot be said that way is a provocation — a
   sibling on the canvas with `parent=` set, for a person to choose or ignore
   — and never lands on its own.

## How we want it to work

The plan's stages 3 to 5, and the night shift, in the order to build them.
Each is useful alone.

**Golden tasks, seeded from failures.** A task is a starting canvas (a
synthetic fixture), an ask in plain words, and a grader. Two sources, in
priority: the ask taxonomy the corpus produces, weighted by real frequency;
and `lessons.md`, where every entry is a candidate task. Weighted toward
design for software — the empty state, the error that says what failed, the
screen at 390px, the design that matches the system already on the canvas —
because that is most of what happens here. Versioned, so a comparison across
weeks means something.

**Skill lift, not vibes.** For each skill, three numbers and never one: does
it fire when it should and stay quiet when it should not; does it help — the
same task with and without the skill, same fixture, same model, the delta;
and what it costs in tokens and turns. Run again when the skill or the model
changes, because lift is not a property of the skill alone. A skill authored
in a project ends by proposing the task that proves it does something; a
skill with no eval is a claim.

**Autoraters, calibrated or not shipped.** For what measurement cannot reach
— hierarchy, whether the copy says anything, whether a design is good rather
than unembarrassing. Calibrated against the preference pairs the version
stack records, with the agreement published beside every score; a panel of
the review personas' distinct lenses rather than one judge repeated; judges
that cite the selector, the value, the line; adversarial by default.

**The morning ritual, and the trust battery.** The night shift's product is
what a person does at six in the morning, and it has to be cheaper than
reading: three measured changes with their numbers, three provocations to
choose from, a keystroke each. Every keep or revert is a labelled pair, which
is how the calibration set gets built without a labelling budget. The accept
rate, per lane, per agent, per kind of work, is the number that widens or
narrows what tomorrow night may do unasked — the trust battery of
[the vision](research/2026-08-24-the-night-shift.md), measured.

**The loop's own guards.** Three properties every step keeps: a bot proposes
and a person lands; a run may not edit its own goal; a result nobody can
reproduce is not a result. And the property that makes the rest safe to
automate — every lesson the loop learns is a test in the suite, so the loop
cannot forget what it paid for.

## The next four things, in order

1. ~~**Label two hundred asks by hand** from `isocan evals`, into categories the
   data suggests, and publish the distribution.~~ **Done 3 Sep 2026** — every
   row at one home (414; 98 of them asks people made), fifteen kinds, the
   distribution in [the note](research/2026-09-03-what-people-ask-agents-for.md),
   and a classifier calibrated against the labels (84%) shipped in
   `isocan evals corpus` with that number attached.
2. ~~**Twenty golden tasks** from the lessons and the top categories — revise
   first, then create, then a restyle against a `DESIGN.md` — each with a
   deterministic grader where one exists, run by the same `grade.mjs`
   machinery, versioned.~~ **Done 3 Sep 2026** — `evals/golden/v1/`, six
   revise, five create, two restyle, three repair, one each of arrange,
   document, variation, converge; file checks of its own, screen checks
   borrowed from `grade.mjs` by name; a selftest that runs both directions.
3. **Lift for the two skills people actually use** — `isocan-collab` and
   `/sprint` — with and without, on the same fixtures, three numbers each.
4. **The converge lane, one item wide**: one measured change per night, landed
   as a version with its before-and-after attached, kept or reverted by a
   keystroke in the morning. The accept rate starts the battery.
