# Working in this repo as an agent

isocan is an isomorphic canvas: a daemon owns the state, and the web app and
the `isocan` CLI are equal clients over one operation vocabulary. `README.md`
is the orientation; `isocan --help` is the command reference, and it is
written for you.

## The guide, and the skill that points at it

If you are here to **collaborate on a canvas** — address comments, build or
edit items, park on `isocan wait` — run `isocan --agent-help` first. That is
the protocol in full, and it lives in
[`packages/cli/src/agent-guide.md`](packages/cli/src/agent-guide.md): shipped
with the CLI so an upgrade upgrades the instructions too (#75). Instructions
about using the CLI belong there, not in the skill.

The skill at
[`.agents/skills/isocan-collab/SKILL.md`](.agents/skills/isocan-collab/SKILL.md)
is the doorway: what isocan is, how to install the CLI if it is missing, and
"now go run `isocan --agent-help`". It is an
[Agent Skill](https://agentskills.io/specification): most harnesses discover
it themselves under `.agents/skills/`, and Claude Code reaches the same file
through the committed symlink at `.claude/skills/isocan-collab`. One file,
many doorways — please keep it that way rather than copying it into a new
harness's directory, and keep it short: a skill sits in a directory for
months, so anything it says about the CLI is a copy that ages.

## The multiuser build

The hosted/multiuser work has its own docs, read in this order:
[`docs/multiuser-journey.md`](docs/multiuser-journey.md) (the
experience, ground truth), [`docs/design/`](docs/design/) (the
mechanisms), [`docs/architecture.md`](docs/architecture.md) (the
physical map), and [`docs/phases.md`](docs/phases.md) (the walk — its
"where we are" line says which phase is next; start there).

## Changelog

`docs/changelog/` is a page per day: what changed and why, written from the
commit history. Add the day's entry when you finish a session's work — the
reasoning is the expensive part to recover later, and the diff is not.

A nightly workflow (`.github/workflows/changelog.yml`) covers the days nobody
remembers to. `scripts/changelog-day.mjs` gathers the day's commits with their
full messages into a draft; the model step turns that into an entry and adds
the index row; the result arrives as a pull request. It never touches a page
somebody already wrote. Writing the day yourself is still better — you were
there — and the workflow finds nothing to do when you have.

## Research

`docs/research/` holds findings that took longer to reach than they take to
read — format evaluations, ecosystem surveys, readiness assessments. Its index
says what each one found. Read the relevant one before re-deciding something it
already measured, and add to it when you learn something a month from now would
want.

## The standing reviews

Four personas in `.claude/agents/` watch what shipping tends to erode — a
market researcher, a design auditor, an architect, and a QA tester. Each reads
`docs/reviews/README.md` before it looks, so a run in October knows what a run
in August measured, and writes its findings back there as a dated page.

`docs/reviews/lessons.md` is the one to read even if you never run them: the
failure modes this codebase has actually produced, each with the guard that
now catches it. Add to it when a bug turns out to have a shape.

## Evals

`docs/evals.md` is the staged plan for finding out whether isocan is any good
at what it exists for. The short version, if you only read one thing: the
oplog already records more evaluation signal than most products collect on
purpose — undo is a labelled failure, and a version stack is a preference pair
a person produced for free. Measure what is measurable before asking a model's
opinion about anything.

## House rules

- `npm test` (vitest) and `npm run typecheck` before you call something done.
- Work on `main`; `release` is generated — CI releases every commit you push
  there — and it is the only branch anyone installs from
  (`github:dglazkov/isocan#release`). Never edit it by hand, and never
  advertise an install spec without the branch: from `main` npm installs an
  empty directory (#47). `npm run release` does it locally when you need one
  before CI gets there.
- Mutations are `Operation` values applied by one reducer — if a change makes
  the CLI and the web app able to disagree, it is the wrong change.
- Presence is honest: never claim work you did not do.
- Fixtures and examples are SYNTHETIC. Test against a real canvas all you
  like — it is the fastest way to find real bugs — but never carry its names
  into the repo. A screen title from the canvas you happened to be using ends
  up in a fixture, then in a shipped example, and the product starts looking
  like it was built for one customer. "Acme", "Test", a made-up title: always.

## Done means done on both surfaces

A feature that only a human can reach is half a feature: this is a canvas for
people AND agents, and an agent's hands are the CLI. Before calling feature
work finished, walk this list and say which lines you touched and which you
deliberately did not.

1. **Op vocabulary** — does the change need a new `Operation`, or an extension
   of one? One op per user-visible act, so it is one undo.
2. **CLI verb** — can an agent do this without a pointer? A gesture (drag,
   pinch, hover) does not need a verb, but the INTENT behind it usually does:
   dragging until edges line up became `isocan align`.
3. **Agent guide** — `packages/cli/src/agent-guide.md` (`isocan --agent-help`)
   is what an agent reads before it acts. A verb nobody is told about does not
   exist. `npm test` fails if a command is missing from the quick reference
   there.
4. **Shared helpers in core** — if the web app and the CLI both compute
   something (a filename from a title, what kind an item is, where "aligned"
   is), the computation belongs in `@isocan/core`, not in one client.
5. **README** — the feature list is the product's own description of itself.
6. **Tests** — pure logic goes in `packages/*/test`. Interaction that only a
   browser can prove (a drag, a hover) is verified by driving a real browser
   and SAYING SO in the report, not by asserting nothing.

The forcing function is `packages/cli/test/surface.test.ts`: it reads the
commands the CLI actually registers and fails when one is missing from the
agent guide's quick reference. Adding a verb without telling agents about it
breaks the build.
