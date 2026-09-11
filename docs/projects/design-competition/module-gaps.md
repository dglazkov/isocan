# What the module system has to grow

**11 September 2026.** The half of the ask that is about the platform: *"it
would be great to have as a module to test the module system — and extend it
to allow it to pull this off."* Each section below names a thing the
competition needs, shows what stops a module doing it today (with the file
that stops it), and proposes the smallest change **to the platform** — for
every module, not a private door for this one. Read
[`../modules/authoring.md`](../modules/authoring.md) first; everything here
is written against the API it describes, `MODULE_API_VERSION` 0.2.0.

The rule every proposal is held to is the module system's own:

> A module may only add what a person could already do with a file and a
> verb.

None of the six adds an operation, a protocol message or a server route. All
but the scoped design system go on the **proposed** list first
(`PROPOSED` in `core/modules.ts`), because each will have exactly one caller
the day it lands and the sticker module showed what one caller teaches: the
shape moves.

| # | Gap | Where it lands | New API | Proposed? |
| --- | --- | --- | --- | --- |
| 1 | [Assets](#1-assets) | build script, both loaders, one guard | a directory convention | yes: `assets` |
| 2 | [Contribution points](#2-contribution-points) | `core/modules.ts`, the manifest | `points`, `contributes`, `contributions()` | yes: `points` |
| 3 | [A dialog slot](#3-a-dialog-slot) | web shell, `SlashCommand` | `WebModule.dialogs`, `DialogFacts`, `opens` | yes: `dialogs` |
| 4 | [Scoped design system](#4-a-design-system-scoped-to-an-area) | `core/designsystem.ts`, `design` verbs | `designSystem(canvas, { at })` | no — core, not the module API |
| 5 | [Casting agents](#5-casting-agents) | `CliHost`, `WebHost`, the rc | `CliModule.templates`, `host.enrol` | yes: `templates` |
| 6 | [Curtain and `wait --in`](#6-smaller-a-curtain-that-is-not-the-sprints-and-wait---in) | `core/sprint.ts`, `wait` | `CoreModule.rounds` | yes: `rounds` |

`MODULE_API_VERSION` moves to 0.3.0 with the first of these to land.

## 1. Assets

**The need.** Nine fighter packs, each a `DESIGN.md`, an avatar SVG, a
`references.md` and a critique file. A module that ships *content*.

**What stops it.** At build time, nothing much: a build-time module's web half
can already `new URL("../assets/kare.svg", import.meta.url)` and Vite will
hash and copy it, and its CLI half already reads `../agent-guide.md` from
disk the same way. At **runtime**, `scripts/module-build.mjs` copies exactly
two things into the installable layout — `dist/` and `agent-guide.md`
(lines 86–132) — so a runtime module's pictures and markdown never reach
`~/.isocan/modules/<slug>/`. The daemon would serve them if they were there:
`/modules/:slug/*` already serves any file under the module's real directory,
path-guarded and typed from `STATIC_TYPES` (`server/http.ts` 1386). It is
one missing copy between a module that ships content and one that cannot.

**The proposal.** A directory convention and the one line that honours it:

- `packages/modules/<name>/assets/` holds anything the module ships that is
  not code. `module-build.mjs` copies it verbatim to `<out>/assets/`, and the
  manifest lists every file with its size — `isocan module add` prints the
  list before `--yes`, because a person should see what lands on their disk
  as well as what runs.
- **Reach it the same way on both surfaces, in both layouts**: `new
  URL("../assets/<file>", import.meta.url)`. The trick `agent-guide.md`
  already relies on — `src/` and `dist/` are both one level below the root —
  makes the same relative path resolve at build time (Vite rewrites it) and
  at runtime (the browser resolves it against `/modules/<slug>/dist/web.js`).
  No host member, no new route.
- **A size bound**, because everybody who loads the module downloads what it
  shows: `ASSET_MAX` per file and a total, refused at build and at add. The
  picture rule the ground already has (`GROUND_MAX_BYTES` in `core/theme.ts`,
  2 MB) is the precedent.
- `STATIC_TYPES` gains `.md` and `.json` (both served today as
  `application/octet-stream`), and `.svg` stays served with `nosniff` —
  avatars are drawn as `<img>`, never inlined, so an SVG cannot script the
  page.
- **A module's CSS** rides the same convention: `assets/styles.css`, linked by
  the shell when the module loads and removed when it unloads. The authoring
  guide says a runtime module's CSS "has no home yet"; this is its home. The
  token guards (`tokens.test.ts`, `scale.test.ts`) extend to read it.

**The guard.** `test/modules.test.ts` gains: every `new URL("../assets/…")` in
a module's source names a file that exists, and every file in `assets/` is
under the bound.

## 2. Contribution points

**The need.** Fighters come from more than one place: the nine the module
ships, a teammate's pack from a git spec, a studio's roster published as its
own package, and — later — a pack kept on a canvas. The module should read
*every* fighter from one list without knowing where each came from.

**What stops it.** Contribution runs one way. A module contributes to
**core's** registries (`kinds`, `contextPieces`, `edges`, `commands`) and
nothing can contribute to a **module's**. A second package that wanted to add
a fighter would have to import the competition module — which the guard
forbids (a module's name may not appear outside its own directory and the two
lists) — or edit its source.

**The proposal.** VS Code's extension points, in the shape this registry
already has:

```ts
interface CoreModule {
  // … existing fields
  /** Named lists this module reads, which other modules may add to. */
  points?: readonly ContributionPoint[];
  /** What this module adds to other modules' points, by point id. DATA:
   *  JSON-serialisable, so it can ride the manifest and be known before
   *  any code runs, the way `kinds` already are. */
  contributes?: Readonly<Record<string, readonly unknown[]>>;
}

interface ContributionPoint {
  id: string;                                   // "design-competition.fighters" — namespaced like property keys
  describe: string;                             // one line, printed by `module ls`
  validate: (value: unknown) => string[];       // problems; empty = accepted
}

/** Every accepted contribution to a point, in module order, each tagged with
 *  the module it came from. Rejected ones are listed by `module ls` with the
 *  validator's sentence. */
function contributions<T>(pointId: string): { module: string; value: T }[];
```

Three consequences worth the change on their own:

- **A data-only module.** A package whose whole content is `contributes` plus
  `assets` — no `web.js`, no `cli.mjs` — is a manifest and some files. That
  is a **third trust class** between an extension and a module: it runs no
  code, so adding one is closer to adding a file than installing a program.
  `module add` should say so ("data only — runs nothing") and may one day ask
  for less ceremony. A teammate's fighter pack is exactly this.
- **Removal still means removal.** A contribution to a point nobody declares is
  inert and listed as orphaned; a point whose contributors are gone is an
  empty list. Neither is an error.
- **No new route.** A data-only module under `~/.isocan/modules/` is served by
  the existing `/modules/<slug>/…` and announced by the existing
  `/api/serving` manifest list. The alternative — a fighters directory the
  competition module reads for itself — would need a route to reach the web
  picker, and a module may not add one.

**The guard.** A `contributes` key must name a point some module in the build
declares, or be listed as orphaned; a manifest's `contributes` must equal the
core record's (the existing "two copies and a test that they agree" rule).

## 3. A dialog slot

**The need.** The *choose your fighter* screen: a popup over the canvas,
opened by `/design-competition` or ⌘K, that closes when you press Fight.

**What stops it.** The seven slots are an underlay, a renderer, an action, an
inspector, a page, an overlay and a drop. **An overlay is an edge** — `left`
or `right`, stacked in module order, deliberately unpositionable. **A page is
a cover route** at `x/<segment>` — a place you go, not a thing that opens
over where you are. The shell has a `Modal` (`components/Modal.tsx`) and does
not hand it to modules. And a module's slash command cannot open anything on
the web: `SlashCommand.local` exists, but *"only built-ins can be local"*
(`core/commands.ts`), so `/design-competition` typed into the composer is
posted to the Chat for an agent to carry out.

**The proposal.** An eighth slot, and a way to reach it:

```ts
interface WebModule {
  // … existing slots
  dialogs?: readonly {
    id: string;                                 // "fighters"
    title: string;                              // the Modal's heading
    wide?: boolean;                             // the Modal's two widths; the shell owns both
    component: ComponentType<DialogFacts>;
  }[];
}

interface DialogFacts {
  canvasId: string;
  canvas: CanvasContents;
  selection: readonly string[];                 // so the picker can prefill "#Checkout"
  args: string;                                 // what followed the slash command, "" from ⌘K
  rcParked: boolean;                            // the AddAgent gate, as a fact
  host: WebHost & { close: () => void };
}
```

- **The shell owns the box**: one dialog at a time, mounted in the existing
  `Modal`, Esc and the backdrop close it, focus is trapped and returned. A
  module fills the inside and cannot position, stack or re-open itself —
  the overlay rule (*name a slot, never a position*) one step further.
- **Two doors in.** A `ModuleAction` may name a dialog instead of returning
  ops (`opens: "fighters"`), which puts *Start a design competition* in ⌘K.
  And a module's `SlashCommand` may name one too (`opens`), which makes it
  **local on the web and not on the terminal**: typed into the composer it
  opens the picker; read by an agent from the Chat it is still a skill with a
  body, carried out with `isocan competition new`. The same command, the right
  thing on each surface — which is what `local` already means for built-ins.
- **No CLI twin**, and none is needed: a dialog is a gesture, and its intent —
  start a competition — already has a verb.

**The risk, said before it lands**, as the overlay note did: a dialog is the
most intrusive thing a module could put on screen. It opens only from a door
a person used — a command they typed, a palette entry they chose — never on
load, never from a renderer, never from an op arriving.

## 4. A design system scoped to an area

**The need.** Three lanes, three philosophies, one canvas. *Kare Bot*'s
screen should be audited against Kare's tokens, and `isocan design --css`
run by *Kare Bot* should print them.

**What stops it — and what would break.** `designSystem(canvas)`
(`core/designsystem.ts`) returns *the* design system: of every item with the
design-system role, *"most recently updated wins: two are a mistake rather
than a feature."* Furnish three lanes with three `DESIGN.md` items and the
canvas's own design system is silently replaced by whichever lane was touched
last — every later `design --css`, every audit on screen arrival, every
`needsDesignSystem` nudge on the whole canvas reads *Rams Bot*'s orange dot.
That is not a missing feature; it is a bug the competition would ship on day
one.

**The proposal.** Core, not the module API — a design system scoped by
geometry, the way area membership already is:

```ts
/** The design system that governs a spot on the canvas: the one inside the
 *  smallest area containing it, else the canvas's own (a design system in
 *  no area). `at` omitted = the canvas's own, exactly today's answer. */
function designSystem(canvas: CanvasContents, opts?: { at?: { x: number; y: number } | Item }): Item | null;
```

- A design-system item **inside an area** governs that area and nothing else;
  one **in no area** is the canvas's, as today. The canvas-wide pick ignores
  scoped ones, which fixes the hijack.
- **It extends an order that already exists.** `governingDesign`
  (`core/memory.ts`, memory phase 1) already answers *which system governs
  here*: this canvas's own, else the first a linked canvas contributes. The
  area's system goes in front of that chain — **area → canvas → linked** — and
  `design check` keeps saying whose it used.
- `isocan design --css --in <area>` and `design check --in <area>` (the
  latter asked for by the sprint journey's Scene 4 and never built); the audit
  on screen arrival asks for the system at the screen's centre.
- It needs no property: `areaOf` already answers *which area is this in*.
  Moving a `DESIGN.md` out of a lane makes it the canvas's — which is correct,
  and visible, and one undo.
- The Context view shows a scoped system under its area's heading, so an agent
  reading `isocan context` in a lane sees the lane's.

This is useful without the competition — a canvas holding a marketing site
and an admin app has two design systems today and is told one is a mistake.

## 5. Casting agents

**The need.** Press Fight: three agents enrolled, each with a working
directory made from its pack, each woken by a brief in its lane; at the
result, each withdrawn.

**What stops it.**

- **The CLI half** can send `agent.enroll` through `sendOp`, but enrolment is
  not just an op: `isocan rc add` also writes the machine-local row
  (`~/.isocan/rc-agents.json`: canvas, actor, name, harness, **cwd**) the rc
  dispatches from. None of that is on `CliHost`.
- **The web half** cannot enrol at all. `AddAgent` does it by an *ask* that
  rides a parked rc's hold, which the rc completes (agent-custody) — not by
  sending the op — and that path is the shell's.
- **Nothing says what a new agent is.** An enrolment carries a name and
  routing rules; its only other input is a directory. `AddAgent.tsx`: persona
  templates *"deliberately absent (decided 2026-08-30): deferred until the
  personas machinery can say what a template defaults, rather than a picker
  that decorates without deciding."*

**The proposal.** A **template** is the thing that deferral was waiting for:
a named function, installed on the machine, that decides what a new agent's
working directory holds.

```ts
interface CliModule {
  // … existing fields
  templates?: readonly {
    id: string;                                        // "design-competition.fighter"
    describe: string;
    /** Make the agent's working directory. Runs on the machine the rc is on,
     *  in the module's own code — never code that arrived from a canvas. */
    prepare: (args: Record<string, string>, into: string) => Promise<{ harness?: string }>;
  }[];
}

interface CliHost {
  // … existing members
  enrol: (ctx: Ctx, canvasId: string, a: { name: string; template?: string; args?: Record<string, string>; harness?: string }) => Promise<{ actorId: string }>;
  withdraw: (ctx: Ctx, canvasId: string, actorId: string) => Promise<void>;
}

interface WebHost {
  // … send, putBlob
  /** Ask the parked rc to enrol. Refuses when no rc is parked (the fact the
   *  dialog was handed); resolves when the enrol op lands. */
  enrol: (a: { name: string; template?: string; args?: Record<string, string> }) => Promise<{ actorId: string }>;
}
```

- **The canvas names a template; the machine runs it.** The standing-agents
  rule — *what runs is configured locally and only locally; what arrives from
  the canvas is the signal, never the command* — holds because a web ask
  carries only a template **id** and string args. The rc honours ids from
  modules its operator installed and refuses the rest, by name. A template
  writes files; it does not run a harness, choose a model the enrolment did
  not, or start anything.
- **Promoted, not private.** `enrol` and `withdraw` are what `rc add` and
  `rc rm` already do, moved onto the hosts — the promotion rule `CliHost` was
  written with.
- **Consent stays where agent-custody left it.** Whose ask a parked rc honours
  is open; the default this proposal assumes is the one the 10 Sep rc note
  recommends — **the rc's owner only** — so Fight works for the person whose
  machine it is and is refused, with a sentence, for everyone else.
- **The brief is not in the template.** What to *do* arrives as a message on
  the canvas, which is how an rc wakes an agent already. Templates decide who
  an agent is; messages say what it is asked. Keeping the two apart is what
  keeps the ask visible.

The first templates beyond this one are obvious — a persona's emissary, a
sprint's facilitator — which is how you know it belongs to the platform.

## 6. Smaller: a curtain that is not the sprint's, and `wait --in`

**The curtain.** `hidesVotes(state, now)` (`core/sprint.ts`) is true while a
*sprint* vote phase's clock runs, and `wallFor` returns the *Vote sheet's*
contents; the web hides counts and bylines on exactly those items. A
competition's vote round is the same thing on a different area. Proposal: a
`rounds` contribution on `CoreModule` —
`rounds?: (canvas) => { area: Item; marks: string[]; until: string } | null`
— that core's curtain asks alongside the sprint's own, which becomes the
first caller rather than the only case. The curtain stays a lens: the record
is public, and the chip says *not shown while voting*.

**`wait --in <area>`.** `isocan wait` filters by item, op and thread
(`--item`, `--op`, `--all-ops`); the sprint journey asked for `--in` in Scene 4
and it was never built. A fighter parked on its lane needs it, and so does
every facilitated fan-out. It is geometry, like everything else about areas:
an entry wakes the waiter when its item's centre is in the area, or when it
is a thread anchored inside it.

## What this does not ask for

- **Panels and tools.** Still unbuilt, still a shell change; the competition
  needs neither.
- **A route.** Data-only modules are served by the route that exists.
- **Sandboxes.** Fighters are agents on the person's rc, not extensions
  running in a frame; the three sandbox gates are untouched.
- **A persona change.** A pack is not a persona (see
  [design.md](design.md#decided-against)); templates are how a persona will
  later become an agent, too.
