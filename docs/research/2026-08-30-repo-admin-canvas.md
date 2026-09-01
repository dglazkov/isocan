---
status: designed
since: 2026-08-30
see: on-demand
note: the read half is buildable today; the write half waits on on-demand's ACP wake, authoritative since 30 Aug
---
# A canvas that watches its own repository

**30 August 2026.** Research. Nothing built.

The question: *a canvas called "isocan Repo Admin" showing the guards, the
personas and the agents — and when code lands, an agent fires, tells you, runs
reviews.*

**Short answer: the read half is buildable today with no new mechanism, and it
is the half most likely to be built wrong.** The write half — the canvas
reaching out and something reaching in — is a different note.

---

## Why this is worth doing at all, and it is not the dashboard

isocan's whole argument is that shared state should be *visible* and *acted on
in one place*. The repository's own health is currently the least visible thing
about it: eight personas, eleven metrics, five workflows, 206 test files, 17
run pages and a 45-row roadmap, all readable only as markdown in a git tree by
somebody who knows where to look.

So the pull is real. **The trap is equally real**, and this week has been three
days of removing exactly it: a canvas that MIRRORS the repo is a second copy of
state, and a second copy goes stale in one place with nothing able to tell.
`docs/ROADMAP.md` exists because a hand-kept roadmap had already done that;
`2026-08-26-attaching-a-directory.md` held two contradictory verdicts dated the
same day.

**The rule that keeps this honest:** every panel is either *derived and
regenerated*, or *decided here and nowhere else*. Nothing in between. A panel
that is edited AND regenerated is the stale copy, arriving by a new route.

---

## What is already data

Everything the question asks to see is already machine-readable, and mostly by
commands built this week:

| Panel | Where it comes from | Cost |
| --- | --- | --- |
| The eight personas, goals, and what held | `isocan --json persona ls` | free |
| The eleven metrics and their baselines | `scripts/measure.mjs --list` | free |
| Last night's runs and their findings | `isocan --json persona runs <name>` | free |
| The roadmap: 6 built, 22 open | `docs/ROADMAP.md`, itself derived | free |
| Guards | 206 test files — but see below | **not free** |
| CI and the nightlies | `gh run list` | free |

**"Guards" is the one that does not exist as data**, and it is the panel the
question most wants. This codebase's distinctive habit is a test that remembers
a bug and explains it — `oneblock`, `tokens`, `railspan`, `floats`, the doorway
guard, the ratchets. There is no marker distinguishing those from an ordinary
behavioural test, so "show me the guards" cannot be answered by counting files.

That is a finding rather than an obstacle: **if guards are worth seeing, they
are worth marking.** A one-line convention — a tag in the describe block, or a
`@guard` in the docblock naming what it remembers — would make the panel
possible and would also make the guards greppable for the people who keep
rediscovering them. It costs a convention and buys a lens.

---

## The read half, buildable today

`isocan add <file>` puts a page on a canvas, and `item.addVersion` writes a new
version of an existing item — which `isocan design set` already uses, for
exactly the reason this needs it: *"a version, never a replacement: the style
you are moving away from is the thing you will want to compare against
tomorrow."*

So a script can render the panels as self-contained HTML, add each once, and
push a new version on every run. The canvas's own version stack then becomes
the history of the repo's health, for free, with no store to keep and nothing
to reconcile.

**One gap in the CLI, and it is small.** `isocan add` only ever creates a new
item; nothing exposes `item.addVersion` for an arbitrary item. Without it a
regenerating dashboard mints a new item per run, which is the silting the night
shift's budget rule exists to prevent — forty panels by Friday. The verb is one
command over an operation that already exists.

**Rendering, not screenshotting.** A panel should be a page that reads its own
numbers, not an image of one. isocan already serves item content and already
renders HTML items; a panel that is an `<img>` is a fact nobody can select,
search or diff.

---

## The write half is where it stops being a dashboard

The question's second half — *an agent fires when code lands, tells you, runs
reviews* — is the interesting one, and it needs something that does not exist.

**What exists as of today:** `.github/workflows/review.yml` fires on every push
and takes every persona's numbers. When one moves the wrong way it comments on
the commit. That is already "an agent fires and tells you" — it just tells
GitHub, because GitHub is the only place it can reach.

**What it cannot do is tell the canvas.** CI has no isocan daemon, no badge,
and no route in. Every honest version of this panel stops at the same sentence,
and so does the agent-wake question. **Three doors, one hinge**, and the hinge
now has an authoritative design: the ACP address hook of
[`on-demand/design.md`](../projects/on-demand/design.md) (decided 2026-08-30;
phase 12 and its dispatch shape retired the same day).

### The one thing that must be decided ON the canvas

If the canvas only ever displays, it is a dashboard and will be looked at twice.
The fact that does not exist anywhere else — and therefore the fact worth
putting there — is **the outcome of a finding**: accepted, rejected, or
unanswered.

That column exists today in the run pages, and today it is edited by hand in
markdown. Moving the *deciding* onto the canvas gives the panel a reason to be
open, and gives the trust battery its first real reading, which is the thing
`docs/projects/evals/plan.md` measured as missing: nine fan-outs and two
choices.

**And it is the one thing that must not be regenerated.** A panel that redraws
outcomes from the markdown, while people click outcomes on the canvas, is two
sources for one fact — the bug this whole note is written around.

---

## What would make this fail

- **A mirror.** Every panel derived and regenerated except one, and that one
  decided here and nowhere else. If a second panel ever becomes editable, this
  has failed and the failure will be silent.
- **A canvas nobody opens.** The read half is easy and worth little on its own:
  the numbers are already one command away for anybody in a terminal. It earns
  its place when something arrives on it that was not going to arrive anywhere
  else — which is the write half, which is why building the read half first is
  a risk rather than a milestone.
- **Silting.** A new item per run rather than a new version. Named above
  because it is the single most likely way this goes wrong in week two.
- **Guards that are only a number.** "206 test files" is not a lens. The panel
  is worth something only if a guard can say what it remembers, which needs the
  convention above.

---

## Recommendation

1. **Mark the guards.** A convention naming what each remembers. Useful
   immediately, independent of any canvas, and the prerequisite for the panel
   the question most wants.
2. **`isocan add --to <item>`** — a new version of an existing item, over an
   operation that already exists. One command, and the thing that makes any
   regenerating panel possible without silting.
3. **Then the read panels**, generated, versioned, and explicitly a projection.
4. **The write half only after the next note**, because until something can
   reach a canvas from outside, "an agent fires and tells you" tells GitHub —
   and a dashboard that cannot be told anything is a dashboard.

## Sources

- Personas, metrics, runs, roadmap: this repository, counted 30 Aug 2026.
- `item.addVersion` used as "a version, never a replacement":
  `packages/cli/src/main.ts`, in `design set`.
- Review on push, and what it can and cannot reach:
  `.github/workflows/review.yml`.
- The stale-copy failures this note is written to avoid:
  `docs/research/2026-08-26-attaching-a-directory.md` and the note at the top
  of `docs/ROADMAP.md`.
- Nine fan-outs and two choices: `docs/projects/evals/plan.md`.
