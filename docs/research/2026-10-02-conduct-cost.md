---
status: noted
since: 2026-10-02
see: practice
note: "An audit of the /conduct skill's cost from one session's 32 subagent transcripts (1–2 Oct 2026). The verify-yourself core earns its keep; the waste was 53 whole-suite runs inside builders (2.8 hours, a quarter of all subagent wall time) that the conductor's deep run repeated anyway, briefs that pasted what agents already read, a status-script path on another person's machine, and two builders in one checkout breaking each other's measurements. The skill now has builders test by file, one deep run per verification, briefs that point instead of paste, and an explicit staging list."
---

# What /conduct costs, and where it went

**2 October 2026.** Dion: *"Someone said that it is very inefficient and
wastes tokens and takes extra time and I want to make sure."*

The question is measurable. A conducted session leaves a transcript per
subagent, so each command's wall time can be read from the gap between a
tool call and its result. This note reads all 32 subagent transcripts of one
conducted session (1–2 Oct 2026). That session ran:

- 22 builders across the keys, copy-edit, groups-by-hand, pets and practice phases;
- surveys;
- re-sends after verification.

## What the time went into

Measured with `node scripts/subagent-time.mjs <the session's tasks dir>`:

| Command kind | Wall time | Calls |
|---|---|---|
| Whole suite (`npm test`) | **166 min** | 53 runs, 2–6 per builder, avg 3.1 min |
| Everything else (edits, git, scripts) | 57 min | 1,418 |
| `npm run typecheck` | 55 min | 56 |
| Targeted `vitest run <files>` | 25 min | 156 |
| `npm run build` | 18 min | 88 |
| Journeys (`--only`) | 16 min | 55 |
| Reading (`cat`, `sed`, `grep`, `git log`) | 10 min | 725 |
| Deep lane | 7 min | 4 |

The total was 658 minutes of summed subagent wall time. The whole suite is
the largest single item, and with typecheck it is about a third of all subagent time, and none of its runs was the gate. After each
verification the conductor ran `npm run test:deep`, which contains
everything `npm test` runs, so every builder-side whole-suite run was repeated.
Two builders running at once doubled each run's cost: 3 minutes a run
against about 1.5 alone. Load also produced flakes (daemon connect
timeouts, journey retries), and a builder or the conductor then spent time
proving those were not theirs.

## What earns its keep

Verification that does not take the builder's word for it caught real
defects in this session:

- an unused-exports overage;
- a web toggle never driven in a browser (added to the `model-keys` journey and walked);
- a billing hazard: stored keys handed to every summoned agent, which would have moved Claude Code from a person's login to per-call API billing; sent back as opt-in;
- a journey assertion that measured the wrong moment.

None of these would have been found by the builder's own green suite.

## Where the skill itself wasted

1. **Builders ran the whole suite.** The skill told the conductor to run
   `npm test` *and* AGENTS.md said deep before push. Builders copied the
   habit, and nothing told them the conductor would repeat it.
2. **Briefs pasted what agents already read.** The skill asked for the
   phase, the journeys, the design parts and AGENTS.md's house rules
   "verbatim". `AGENTS.md` is already in every agent's context, and the
   builder reads the docs anyway. A skill-shaped brief carries about 1,100
   words of copies. The briefs written by pointer this session averaged
   about 720 words, and no builder reported missing context.
3. **The status script's path was on another machine**
   (`/Users/dimitriglazkov/…`), so the first call of every run on any
   other machine failed.
4. **Two builders in one checkout.** The export ratchet counted the
   neighbour's new exports. The bundle measured the neighbour's bytes (one
   builder rebuilt with its own changes reverted to prove the 30 bytes were
   not its). Two builds wrote one `dist`. Nothing in the skill said how to
   run builders side by side.
5. **Staging advice that lost files.** "Stage before the gates" met
   `git pull --autostash`, which hands staged changes back unstaged
   (`ccb593f5` shipped only its new files). Staging a filtered
   `git status` while a builder was live swept in its half-written script
   (`625fb9fa`).

## What changed in the skill

- **Builders test by file.** They run their own files, one typecheck at the end, and their journey alone after one build. They never run the whole suite, and they check that no other build or journey is running first.
- **The conductor runs the deep lane once,** detached, on the integrated tree, and re-runs a failure alone before calling it a flake. Two phases verified together share one run.
- **Briefs point instead of pasting.** Paths and headings, under 600 words, carrying only what the docs don't say: decisions, owners, neighbours and stop lines. Reports are capped at 600 words, and the proof is given as command, exit code and one line.
- **Order of operations.** Pull first, then `git add -N` new files so the ratchets see them, then gate. The commit is staged from an explicit list.
- **Parallel builders.** Each brief names the neighbour's paths and the reds to expect from them. Phases in the same package run one after the other.
- **The path is fixed,** and a paragraph on keeping the conductor's own context lean replaced a generic one.

Expected saving: most of the whole-suite and repeated-typecheck minutes
(about 3.5 hours across the session, less the one typecheck each builder keeps),
plus the flake chasing that load caused. The next conducted session runs
`scripts/subagent-time.mjs` over its own transcripts and either confirms
the saving or reports that it didn't hold.
