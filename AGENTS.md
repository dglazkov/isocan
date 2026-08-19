# Working in this repo as an agent

isocan is an isomorphic canvas: a daemon owns the state, and the web app and
the `isocan` CLI are equal clients over one operation vocabulary. `README.md`
is the orientation; `isocan --help` is the command reference, and it is
written for you.

## The skill

If you are here to **collaborate on a canvas** — address comments, build or
edit items, park on `isocan wait` — read
[`.agents/skills/isocan-collab/SKILL.md`](.agents/skills/isocan-collab/SKILL.md)
first. It is an [Agent Skill](https://agentskills.io/specification): most
harnesses discover it themselves under `.agents/skills/`, and Claude Code
reaches the same file through the committed symlink at
`.claude/skills/isocan-collab`. One file, many doorways — please keep it that
way rather than copying it into a new harness's directory.

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
3. **Skill** — `.agents/skills/isocan-collab/SKILL.md` is what an agent reads
   before it acts. A verb nobody is told about does not exist. `npm test`
   fails if a command is missing from the quick reference there.
4. **Shared helpers in core** — if the web app and the CLI both compute
   something (a filename from a title, what kind an item is, where "aligned"
   is), the computation belongs in `@isocan/core`, not in one client.
5. **README** — the feature list is the product's own description of itself.
6. **Tests** — pure logic goes in `packages/*/test`. Interaction that only a
   browser can prove (a drag, a hover) is verified by driving a real browser
   and SAYING SO in the report, not by asserting nothing.

The forcing function is `packages/cli/test/surface.test.ts`: it reads the
commands the CLI actually registers and fails when one is missing from the
skill's quick reference. Adding a verb without telling agents about it breaks
the build.
