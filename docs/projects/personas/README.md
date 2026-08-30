---
status: partial
since: 2026-08-30
see: personas
note: what exists today; design.md is the argument
---
# Personas

**A persona is a named role an agent takes on:** a lens, the tools for it, a
goal it is judged against, and a memory of what it already found. Percy the
performance analyst. Darren who watches the design tokens.

The point is not fancier agents. It is that **the useful unit of agent work is
a standing role, not a request** — and this repo had been doing it by hand for
a week without giving it a name. [`design.md`](design.md) is the argument;
this page is what exists.

## What a persona is, on disk

One file: `.agents/personas/<name>.md`. Front matter the machine reads, prose
the model reads.

```markdown
---
name: performance
description: Whether the app still feels fast after a change.
model: opus
tools: Read, Write, Edit, Glob, Grep, Bash
goal:
  - name: largest built JavaScript chunk
    at most: 700000
    measured by: node scripts/measure.mjs bundle-bytes
    baseline: 673076, 2026-08-29, 6b1afaf
runs: docs/reviews/
trigger:
  cron: 43 8 * * *
---

You are responsible for whether this still feels fast…
```

**`.agents/` and not `.claude/`**, with a relative symlink from
`.claude/agents/<name>.md` into it. One copy, several doorways — the same
arrangement the isocan skill already uses. Claude Code sees them as subagents;
any other harness reads the file directly.

## The seven, and the rule that decided them

| Persona | The lens | Its number |
| --- | --- | --- |
| `accessibility` | Usable by somebody not using it the way you are | contrast, names, targets, alt |
| `architect` | The op vocabulary, boundaries, the isomorphism | core's runtime deps, op types |
| `copy` | Labels, errors, tooltips, empty states | greppable copy tells |
| `design-auditor` | Tokens, both themes, the tells of a generated interface | grader checks, colour literals |
| `market-researcher` | What else exists and what to take from it | **none, and it says so** |
| `performance` | Whether it still feels fast | largest built chunk |
| `qa-tester` | Whether the tests mean anything | eslint errors |

**The gate is not "would this lens be useful" — it is *a persona needs a
standing number nobody else is watching*.** `security` and `docs` were
considered and refused on exactly that: both are real concerns, neither has a
number of its own, and both are already named in the architect's charter.

`market-researcher` has no goal and warns about it in `isocan persona ls`. A
lens that cannot state a number is worth keeping and worth being honest about;
it is not worth a made-up metric.

## A goal is `(number, bound, the command that produces it)`

Never an aspiration. "Keep the design accessible" is not a goal; "zero contrast
failures at 390, 768 and 1440, measured by `grade.mjs`" is one.

`scripts/measure.mjs` is where those commands live — nine metrics, each
printing a single number on stdout. **Every one declares a way to break it**,
and `--selftest` breaks each on purpose and fails if the number does not move.
A metric with no mutation is *refused*, not skipped.

That rule is not fastidiousness. Four instruments were found this week
reporting healthy while broken — a CI selftest spawning a macOS Chrome path on
a Linux runner under `continue-on-error`; a nightly printing "0 failing checks"
three lines above the failures it had measured; an event-loop monitor calling a
1500 ms stall `0ms`, twice, for two different reasons; and a grader that waited
two seconds instead of waiting for the page. **Every one looked like a working
instrument.** So: no persona may declare a goal whose measuring command has not
been shown to fail on something broken.

## Using them

```sh
isocan persona ls                 # every persona, its goals, and what is wrong
isocan persona show performance   # one in full, including the command
isocan persona runs qa-tester     # what its runs found, and what was decided
node scripts/persona-run.mjs --all   # take the numbers now, write the pages
```

In a Claude Code session they are subagents: ask for the `accessibility` or
`copy` agent by name.

## Runs

`.github/workflows/persona.yml` runs all of them nightly at **08:43 UTC** and
opens a pull request. It needs **no setup and no token** — it authenticates
with GitHub's built-in per-run `GITHUB_TOKEN`.

A run writes a dated page under `docs/reviews/` and **changes nothing else**:
not the code, not the personas, not a canvas. Three rules, each with a test:

- **A run may not edit its own persona.** A runner that can change its goal can
  pass by lowering the bar. Enforced by comparing every persona file before and
  after.
- **A broken instrument is never a zero.** A command that fails, or prints
  something that is not a number, is reported as *instrument broken*.
- **A missed goal is news; a broken instrument is a failure.** The page is the
  report, and a run that goes red every morning trains everybody to stop
  looking.

Each run's Findings table has an **Outcome** column — `accepted`, `rejected`,
or `unanswered`. That is the only thing a run wants from a person. Nothing
computes a score from it yet, deliberately: an accept rate over five findings
is noise, and a trust score that governs autonomy before it means anything is a
way to lose trust in trust.

## What is not built

**Step 6 — the canvas as source of truth.** Deliberately gated rather than
merely undone: its condition is *a second person editing a persona*. Files are
what a harness reads with no daemon, no badge and no network, so making the
canvas authoritative earlier buys nothing and costs a distributed system. The
two debts to that future are already paid — one file per persona, and front
matter that keeps keys it does not understand.

The stronger reason to move is **agents signing up for work**
([research](../../research/2026-08-29-one-agent-many-canvases.md)): a persona
several agents can wear needs somewhere both can read that is not one laptop's
disk.
