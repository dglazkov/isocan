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
