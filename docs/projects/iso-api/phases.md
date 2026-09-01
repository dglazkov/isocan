# The isomorphic API: implementation phases

[`design.md`](design.md) is the argument; [`journey.md`](journey.md) is the
acceptance suite — each phase below names the journey it closes, and a phase
that claims one closes only when the job plays for real. Each phase is a
discrete amount of work ending in a testable outcome, named up front.

**How the work runs is defined once, in
[`../multiuser/phases.md`](../multiuser/phases.md), and applies here
unchanged**: the conductor model, one subagent per phase, the conductor
verifying the named proof itself, the finding budget, and the Status line
that moves in the same change as "where we are".

**Phase citations name their project**: write `iso-api phase 2`, never a
bare "phase 2" — bare numbers in existing code mean the multiuser project.

---

**Where we are: phase 1 CLOSED, phase 2 next.** Journeys and design
written 31 Aug 2026; doors settled the same day (typed library with the
CLI atop it, release-branch distribution, the API stays a client of the
daemon). The seam exists as of 31 Aug: `@isocan/api` owns the Node
client, the CLI consumes it, and both boundary tests hold it.

The order below is dependency order, and it is also risk order: phase 1 is
pure movement and proves the seam exists where the design claims; phase 2
is where the journeys' requirements bite; everything after rides on those
two. The phases are deliberately unequal — 1 and 2 are the boulders, 3 and
4 the pebbles — because the honest split follows the proofs, not the
calendar: the board port stays inside phase 2 rather than becoming a phase
of its own, since a surface phase without it would need an invented
acceptance test, which is the anti-pattern journey.md exists to prevent.
Phase 1's hedge is not a split but the stated stop: if the `makeCtx` split
resists, the phase records it instead of pushing through.

**Deliberately open.** Postponed on purpose, so a later session decides
deliberately instead of improvising mid-task:

- **Whether park/rc is exported.** `parkClaim`, `rcHold` and kin move in
  phase 1 because the CLI needs them, but whether they appear on the
  public surface waits for [on-demand](../on-demand/design.md) to build
  `isocan rc` — exporting a shape that is still moving would hand
  consumers a breaking change as their first experience.
- **The harness-less identity.** What `connect()` does when the
  environment names no session: refuse (the CLI's rule — `--session` is
  explicit) or mint-and-warn. Phase 2 ships the refusal; the door stays
  open until a real consumer's friction argues otherwise.
- **The npm registry.** The release branch is the answer until somebody
  outside this repo's orbit hits a wall only a registry solves. A second
  release surface is a standing cost; it needs a demonstrated consumer,
  not a hunch.
- **The browser kernel and `window.isocan`.** Both unsolved twists stay
  unsolved (journey 1 names them; design.md's lockstep section points at
  them). The only obligation on these phases: keep the Node-only half
  (daemon lifecycle, `homes.json`, the marker walk) separable from the
  typed route surface, so neither twist is foreclosed.

---

## Phase 1 — The seam

**Status: CLOSED 2026-08-31.** The suite passed untouched (2727 tests; the
only edits were import paths and the fixture lists in finding 4), both
boundary tests fail when violated, and a release-shaped install still
yields a working CLI at the same package count (82 before and after).

**Work:** `packages/api` exists and the CLI consumes it. `client.ts`,
`identity.ts`, `direct.ts`, and the non-commander half of `ctx.ts` move;
the CLI keeps commander wiring, `output.ts`, help text, and `main.ts`'s
presentation, importing everything else. No new behavior, no new exports
to the world — this phase is movement, and its value is proving the
design's central claim: that the API and the CLI's middle layer are the
same code, separable along the line the design drew. Where `makeCtx`
resists the split, the resistance is a finding, not something to push
through silently.

Two structural assertions land with the move, in the house pattern
(`address.ts`'s grep test, `packaging.test.ts`'s boundary test):

- No file in `packages/cli` constructs a request to the daemon — no
  `fetch` of an `/api/` path outside `packages/api`.
- Within `packages/api`, the typed route surface does not import the
  Node-only half (`node:child_process`, daemon spawn, `homes.json`
  reads) — the separability the unsolved twists depend on, made a test
  rather than an intention.

**Outcome:** One Node client implementation, owned by `packages/api`,
consumed by the CLI; the suite green with no command behaving
differently.

**Proof:** The full suite passes untouched — the phase changes no
behavior, so any test that needs editing is itself a finding. Both grep
tests exist and fail when violated (shown by violating each once,
locally). `npm i -g` from a locally-built release tree still yields a
working CLI at the same package count as before the move.

**Findings:**

- **2026-08-31** — The split fell where the design drew it, with one
  refinement: `client.ts` split again into `routes.ts` (typed surface)
  and `client.ts` (daemon lifecycle), so the boundary test guards a file
  line, not a region of one file.
- **2026-08-31** — `--json` rides through the seam: `Ctx` carries the
  CLI's presentation flag because every command holds `Ctx`. Splitting
  it out is restructuring, not movement — left for phase 2's `connect()`.
- **2026-08-31** — The moved layer is not silent: staleness warnings,
  binding notes, and `requireIdentity`'s TTY prompt speak on stderr from
  inside the API package. Phase 2 must decide what `connect()` does with
  that voice.
- **2026-08-31** — Daemon lifecycle needs `shaOfRoot` ("which build am
  I") from the upgrade machinery; the two path helpers moved into the
  API rather than dragging `managed.ts` along.
- **2026-08-31** — `setup-npx.test.ts` and `restart.test.ts` each spell
  the workspace list by hand and both missed `api`; a hand-spelled list
  will miss the next package too.
- **2026-08-31** — `daemonBin()` now locates the CLI bin by a
  cross-package relative path (`../../cli/bin`), the same reach in
  checkout and install, but a path that moves if either package does.

---

## Phase 2 — `connect()`, proven by the board

**Status: not started.**

**Work:** The public surface, shaped by what [journey 1](journey.md)
forces rather than by what `DaemonClient` happens to expose:

- `connect()` → a **home handle**; the directory's canvas is the default
  reach, other canvases open by ref (`home.canvas(ref)`), across homes,
  with `direct.ts` underneath.
- **Identity as a parameter**: ambient resolution by default — the CLI's
  own rule — an explicit identity for a script that is its own actor. A
  harness-less environment is refused with a reason (see Deliberately
  open).
- **Content as values**: add and edit take strings and buffers with a
  mime type; a file path is a convenience atop that.
- **Ops return what they made**: the item with its version and
  `blobHash`, from the call that created it.
- **Errors as types**: `ApiError` with the wire code, distinguishing
  refused / unreachable / fenced the way the protocol already does.

**The port comes first, and it is the ground truth.** The phase opens by
rewriting `scripts/canvas-board.mjs` against the surface as journey 1
sketches it — before that surface exists — and then implements the
surface until the port runs. Where the port wants something the sketch
lacks, the surface bends; where the sketch offers something no line of
the port reaches for, that is evidence the surface is speculative, and
it waits. The result is one process, two canvases, its own identity, no
temp directory, no re-listing, running on the real board canvas.

One honest footnote to "one process": `persona ls` is not a daemon call —
it is the CLI walking `.agents/personas/` with core's `parsePersona`. The
ported board imports `parsePersona` and walks the directory itself; the
one-reader rule survives because core is the one reader.

**Outcome:** Journey 1 closes. A script that publishes derived panels is
one process and holds typed results, and the board is that script.

**Proof:** The ported board produces the same panels with the same
no-op-when-unchanged behavior, measured the way `publish()` already
measures: an unchanged run stacks no version. The diff and the two run
times (before/after, same machine, same panels) are recorded in this
phase's findings. `--dry-run`, `--only`, `--as-me` and `--layout` all
still work — the flags are the board's contract with its user, not the
CLI's.

**Findings:** none yet.

---

## Phase 3 — The log as an iterator, proven by the watcher

**Status: not started.**

**Work:** `canvas.tail({ since })` — an async iterator over the entry
stream, cursor with the caller, resuming across disconnects and daemon
restarts on the same seq-cursor gesture every replica uses. The park
machinery underneath is whatever `watchLog`/`getLog` already do; the
phase is the shape, not a new wire protocol.

Then the watcher [journey 2](journey.md) promises: `npm run board:watch`
becomes real — a script that tails the repo's canvas and re-runs the
board when something lands, holding no process but its own.

**Outcome:** Journey 2 closes. Reacting to a canvas does not mean
polling, and a watcher that dies resumes where it stopped.

**Proof:** The watcher refreshes panels on a real comment, keeps running
across an `isocan restart`, and its resume is measured, not assumed: kill
the watcher after entry N, restart it, and the first entry it yields is
N+1. A wake that is actually a dropped connection reported as one fails
this proof — the auto-upgrade project's standing lesson, inherited.

**Findings:** none yet.

---

## Phase 4 — Reachable and discovered

**Status: not started.**

One phase, two halves of one idea: the API can be gotten, and it can be
found. The install must work before the guide advertises it, and a single
phase enforces that ordering internally — the reason these were two
phases once, and are not now.

**Work, the reachable half (journey 4):** Distribution. The root manifest
gains an `exports` entry; the entry module is the bin's own trick —
register tsx and the workspace loader, re-export `packages/api`'s surface
— so `import { connect } from "isocan"` works from a plain `npm i
github:dglazkov/isocan#release`. Types arrive with the install (the
package is TypeScript source; the editor reads it directly).
`release.mjs` changes only if the release tree turns out not to carry
what the entry needs — and if it does, that is a finding, because the
design predicted otherwise.

**Work, the discovered half (journey 3, and #78's second comment):**
`agent-guide.md` gains a Scripting section: when to reach past the CLI (a
loop, a watcher, a batch), `connect()`, where the types are, and the
install line — which is the answer **everywhere outside this repository's
own workspace**. A readied directory is not an exception: `isocan setup`
installs the CLI globally and globals are not importable, so the guide
tells every agent the same thing, and journey 3's walk includes the
`npm i` its script needs. This is why the two halves are one phase:
the discovered half's instructions are the reachable half's install
line, verbatim.

**Outcome:** Journeys 3 and 4 close. "isocan has an API" is true the way
"isocan has a CLI" is true — one install line, no workspace, no checkout
— and an agent that knows only the CLI finds it through the door it
already uses.

**Proof, one per journey, both walked rather than asserted:**

- *The stranger's machine:* in an empty directory outside this
  repository, against the real release branch — the install line, a
  ten-line script, an op landing on a canvas at dev.isocan.io as the
  right actor, and the editor answering what `connect()` returns. The
  walk includes the admission beat: the machine is let in the way any
  machine is — a pass minted elsewhere, redeemed here — before the
  script runs, which is also the assertion that the API invents no new
  door. The workspace cannot fake this and must not: the proof directory
  has no path to workspace resolution. One predicted turn, so it reads
  as a turn and not a surprise: the editor half assumes tsserver will
  read `.ts` sources inside `node_modules`, which it often refuses
  without a `types` condition or `.d.ts` — if it refuses here, the
  lever is the release-time `d.ts` compile design.md already names.
- *The agent finds it,* Scene-6 style: an agent that has never been told
  the API exists, given a batch-shaped task in a readied directory, finds
  the API via `--agent-help`, writes the script, and the oplog shows one
  actor for its CLI ops and its scripted ops alike. The transcript is the
  record.

**Findings:** none yet.
