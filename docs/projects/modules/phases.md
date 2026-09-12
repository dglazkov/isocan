# Modules — the walk

Each phase ends with something a person can remove and watch disappear.
Ordered by what settles the most with the least: the registries before any
loader, because a loader with nothing to load into is a loader.

**Where we are:** phases 1–4.5 built 4–9 September 2026. Phase 5's three gates
were read on 12 September: two clear, the third clear for the agent-side
sandbox and still shut for the browser-frame one — so phase 5 walks its
agent-side half and the frame half stays gated behind extensions stages 3–4.
See [the gate check](#the-gate-check-12-september-2026).

## Phase 1 — the registries, and the mind map as the first internal module ✅

*Built 4 Sep 2026.*

- `core/modules.ts`: `registerModule`, `modules()`, and the two readers core
  itself needs — `moduleContextPieces(canvas)` for `isocan context` and the
  Context view, `moduleEdges(canvas)` for the JSON Canvas export. Core
  imports no module.
- `packages/modules/mindmap/`: `core.ts` (the graph functions that were
  `core/mindmap.ts`, plus the `mindmap` record), `web.tsx` (the lines, as an
  underlay fed the canvas and the drag as props), `cli.ts` (the `map` family,
  registered through `CliHost`), `agent-guide.md` (the section that was in
  the base guide), and its tests.
- The two lists: `packages/web/src/modules.ts`, `packages/cli/src/modules.ts`.
- The web shell's first slot: `ModuleUnderlays`, inside `.world` before the
  items. The CLI's host object, and the guide printed with every loaded
  module's section after the base.
- `surface.test.ts` reads verbs and guides from modules as well as `main.ts`.
  `test/modules.test.ts` holds a module's name to its directory and the two
  lists.
- Root `workspaces` gains `packages/modules/*`; the workspace loader resolves
  `@isocan/<module>/<entry>` by path for git installs; vitest and eslint
  include the modules directory.

**Acceptance, run by hand on 4 Sep and recorded:** with the mind map's
directory moved out and its two list entries emptied, `tsc` was clean for
the web app and the CLI, `npm run build` passed, `isocan --help` had no
`map` and `--agent-help` no "Mind maps" section, and 999 tests across core,
the palette and the surface guard passed. Put back, the full suite is 3,401
green. The panel count from the research note is unchanged, on purpose:
this phase adds slots, not panels.

## Phase 2 — Mermaid, the first node-type module ✅

*Built 4 Sep 2026.*

`packages/modules/mermaid/`: kind `diagram`, mime `text/vnd.mermaid`,
extensions `mmd` and `mermaid`, icon borrowed from `drawing`. This is the
phase that paid the union cost, in one commit: `ItemKind` is now
`BuiltinKind | (string & {})`, `itemKind()` asks the registry before its own
mime tests (and after the property-marked kinds, so a module names files and
not text nodes), `itemKinds()` puts module kinds before `other`, and the web
app's `kindLabel` / `kindNoun` / `iconKindFor` fall back to what the module
declared — the closed records keep their exhaustiveness over the built-ins.
`isocan ls --kind` reads the live list; both mime tables (`cli/mime.ts`,
`web/lib/mime.ts`) ask the registry for extensions first. The renderer is the
second web slot: `WebModule.renderers`, keyed by mime, asked ahead of the
built-in chain in `VersionContent` and handed `RendererFacts` (identity,
`url`, `readText`) rather than a blob path. The Mermaid library sits behind
a `React.lazy` boundary in `diagram.tsx`, rendered with `securityLevel:
"strict"`, themed by the page's three theme states. `isocan add flow.mmd`
needs no verb; the module's guide section says how the kind is used.

**Acceptance:** with the module registered a `.mmd` is a diagram in
`itemKind`, the kind list and both mime tables; unregistered, the same file
is a document. The guard tests hold the renderer to the slot and the library
to the far side of the boundary. What stays a hand check until phase 3's
runtime removal: the picture on a card at isocan.io once this promotes.

## Phase 3 — runtime loading, for self-hosted homes ✅

*Built 5 Sep 2026.*

`isocan module add <dir>` / `rm` / `ls`. `~/.isocan/modules/<slug>/` holds a
built module: `manifest.json`, `agent-guide.md`, `dist/web.js` (+ chunks),
`dist/cli.js`. `add` prints the manifest — name, version, engines, every
kind, key and half — and installs nothing until `--yes`; the engines check
(`>=a.b.c`, `^a.b.c`, `*`) refuses with a sentence naming both versions, at
add and again at every load. The daemon reads the directory per request: the
loaded manifests ride `/api/serving` (the fetch the shell already makes) and
each module's files are served under `/modules/<slug>/` — typed from the
static map, `no-cache`, `nosniff`, path-guarded to the module's real
directory. The shell registers every manifest's record first (kinds known
before any code runs), sets `globalThis.isocan` — the app's own React, JSX
runtime and core — and `import()`s each web half; `addModule` bumps a
generation the underlay slot, the renderer chain and the palette read. The
CLI does the same before it parses argv, through the same `CliHost` a
build-time module gets. `scripts/module-build.mjs <name>` makes the layout
with esbuild: platform imports rewritten to host reads, the web half
code-split so a lazy boundary stays lazy on the wire, the manifest written
from the package and the core record's default export.

**A git spec too, since phase 4:** `module add github:owner/repo#ref` (or
any URL git clones) is a shallow clone into a temporary directory in front
of the same code that reads a directory, the built module at the root or in
`build/`.

**Acceptance, run by hand on 5 Sep.** Mermaid taken out of both build-time
lists, the app rebuilt without it (no diagram chunks in `dist/`), a daemon
run from that tree on a scratch home. `isocan module ls`: the mind map only.
`module add <built mermaid>` printed the manifest and refused until `--yes`;
after it, `module ls` said `@isocan/mermaid 0.1.0 loaded`, `--agent-help`
printed the Diagrams section, `isocan add flow.mmd` landed a **diagram**
(the kind came from the manifest before any code ran — the first build's
CLI half was refused as CommonJS, and the kind still held), and the app
drew both diagrams from `/modules/mermaid/dist/web.js` with the host
object set and two SVGs on the cards. `module rm mermaid`: `ls --kind
diagram` refused the kind, the guide lost its section, the served path
answered 404, and the page showed both items as files — `flow.mmd
(text/vnd.mermaid)` — with the oplog untouched. Two things the proof found
and fixed on the spot: a `.js` CLI half under a home directory is
CommonJS to Node (built as `.mjs` now), and a web half with only a named
export loads nothing (default exports, and a guard).

## Phase 4 — documents: the inspector slot, the page slot, module commands ✅

*Built 5 Sep 2026.*

Three slots the earlier phases had no customer for, and the module that
asked for them. **Inspectors** (`WebModule.inspectors`, keyed by kind) mount
beside the workbench's stage for the open item's kind, handed the item and
its bytes on request. **Pages** (`WebModule.pages`) are cover routes of
their own at `/p/<canvas>/x/<segment>` — the same kind of thing the
workbench and the deck view are — mounted inside the canvas page with the
shell's own bar, reachable from ⌘K ("Open Documents") and from `isocan open
--page <segment>`; a segment nobody owns says so rather than showing a blank
cover. **Commands** (`CoreModule.commands`) are slash commands laid UNDER
the built-ins and the home's own on both surfaces, source `module` — the
daemon registers no module, so each surface lays them under whatever list
it holds.

`packages/modules/documents` fills all three and adds no kind, key or op: a
document is a markdown or text item brought as prose (not a caption, a note
or the design system). The **Outline** inspector reads headings and size;
the **Documents** page lists every document, newest edit first, opening on
the stage; `/outline` and `/summarize` are what an agent carries out;
`isocan docs ls` and `docs outline <item>` are the verbs they carry it out
with.

**Deferred on purpose:** the prose editor. The WYSIWYG note placed TipTap
and ProseMirror as the right layer for a markdown lens, and the renderer
slot from phase 2 is where it would go — but a markdown round trip through
a rich editor is its own project, with its own losses to measure, and
nothing in this phase's slots depends on it. The document still edits where
every text item does.

**Loose ends closed in the same PR:** `module add` takes a git spec
(`github:owner/repo#ref`, or any URL git clones — the built module at the
root or in `build/`), a shallow clone in front of the same code that reads a
directory, proved against a local bare repository in the test. Left open: a
card that names the module a file came from when the module is absent —
the mime does not carry the name, and inventing a registry of departed
modules is a second copy of a fact.

## Phase 4.5 — writing from a component, and saying how early this is ✅

*Built 9 Sep 2026, from [#156's field report](https://github.com/dglazkov/isocan/issues/156#issuecomment-5603055567).*

@romannurik built a sticker item type against the real API and listed five
things he had to change in core to do it. Followed back to their causes they
were two, and one of the five needed no API change at all.

**The API could read from five places and write from one.**
`ModuleAction.run` returning `readonly Operation[]` was the only occurrence of
that type in the whole module API — underlays, renderers, inspectors and pages
were read-only by construction, and four of those five are components a person
interacts with. That was invisible while the modules were a mind map, a
renderer and an outline, none of which changes anything from inside a
component; it stopped being invisible the moment somebody built a tray you
drag things out of. It also contradicted this design's own rule that **module
state is an item, visible and versioned** — most of the places a module could
put UI could not write an item.

**And no operation carries bytes.** `item.add` and `item.addVersion` both name
a `blobHash`, minted through a channel that is not an op, so a module could
express every canvas change except the ones needing new content. One cause,
two symptoms, which is why the report asked for both a `dropFile` and an
`addVersion`.

`WebHost` is the answer and the web twin of `CliHost`, which has existed since
modules did — the asymmetry was the bug. Two members: `send`, the door the
palette already used, and `putBlob`. Handed to overlays, inspectors and pages;
underlays and renderers draw and are not, and the day one needs it that is a
review question rather than a private import.

**Deliberately not the helpers that were asked for.** `dropFile` and
`addVersion` each bundle mint-place-send, so a module cannot set its own title,
group two writes into one undo, or want a version instead of an item without a
second helper — which is how a per-slot helper list starts. The stickers
rewrite is the evidence: it names its items ("Fire", not "fire.sticker"), drops
in one undo, and changes a sticker in place with an op that already existed.

**Two new slots and one that was not a slot at all.** `overlays` is screen
space against a named EDGE — the shell owns where that edge is, because two
modules positioning themselves is how a canvas ends up with two trays on top of
each other. `drops` lets a module claim a dragged mime, the way it already
claims mimes for kinds; native OS file drops stay the shell's. The canvas
inspector needed no API change — `moduleInspectorsFor` and `InspectorFacts`
already carried everything, and only `Workbench.tsx` mounted it.

**Versioning, because runtime modules make this real.** `MODULE_API_VERSION`
is decoupled from the app's and bumped 0.1.0 → 0.2.0, which is the first
refusal the engines check has ever produced: it was pinned to the root
package's 0.1.0, so the number it compared against was a constant. `PROPOSED`
names `overlays`, `drops` and `host`; a manifest using one is refused unless
the person adding it passes `--proposed`, and an unknown proposal is refused by
name. VS Code's two-surface bargain in the shape this can afford. See
[`design.md`](design.md#versioning-two-surfaces-one-of-them-frozen).

**`@isocan/stickers` ships behind Settings → Experiments**, off, fetched only
when switched on — five emoji, a tray, an inspector, `isocan sticker drop`. It
is deliberately not a useful feature: it is the smallest real module that needs
all three proposed slots, and it is how we will notice when one of them is
wrong.

**Two bugs the work found in itself.** The experiment gate was a plain import
gated at render, which gates the drawing and not the download — measured, it
cost every first visit 6,227 bytes including everybody who never switched it
on. And the overlay slot shipped with no CSS at all: the tray was in the DOM,
in its region, `position: static`, a 1280×178 block nobody could see, past
lint, typecheck, 3,936 tests and two byte checks. Neither was findable without
building the built thing and looking at it.

## Phase 5 — sandboxes

Gated, and the gates are named: the content origin, extension actors, and the
compute-consent question agent-custody left open. Not before all three.

**Where the three stand, 6 Sep 2026.** The **content origin** is cleared: it
went live on prod that morning, with short-lived signed URLs over
`(canvasId, blobHash, expiry)` from a second registrable domain that holds no
cookie, badge or API. **Extension actors** is not a matter of somebody getting
to it — extensions stages 1 and 2 built the same day, and building them showed
the stage has no subject: a tier-1 tool asks rather than acts, so the actor to
attribute is the person who pressed it, and the thing that would need one is a
panel that acts on its own (extensions stage 3). **Compute consent** is
untouched. So the gate that moved is one of three, and the one behind it moved
its own dependency into view rather than closer.

**Compute consent, 11 Sep 2026 — no longer untouched, not yet cleared.** It
has two halves, and both moved the same day
([what the rc hands over](../../research/2026-09-10-what-the-rc-hands-over.md)).
*What a turn can reach*: `isocan rc --sandbox` fences every adapter in a
sandbox whose policy is derived from the enrolment, and permissions are
answered by kind rather than auto-allowed — built, and opt-in rather than the
default (decided 11 Sep). *Who may start a turn*: owner-only summons by default
was decided 11 Sep and is being built separately. Neither is a module sandbox
— this gate asks whose machine runs a module's compute and on whose say-so,
and the rc work answers that for an agent's turn — but it is the same question
one layer over, and the answer this gate will want is now visible.

### The gate check, 12 September 2026

Read against what the gates were actually written to mean, rather than against
their names. **Two of the three are clear, the third is clear for one of
phase 5's two shapes and genuinely shut for the other** — so phase 5 starts,
on the half the gate does not bind, and the other half re-queues where it
belongs.

**The content origin — CLEAR.** Unchanged since 6 Sep: live on prod, short-
lived signed reads over `(canvasId, blobHash, expiry)` from a second
registrable domain holding no cookie, badge or API. It is a prerequisite of
the browser-frame shape only; nothing on the agent-side shape touches it.

**Compute consent — CLEAR, and narrower than its name.** The gate is not a
principle, it is a *named question in a named document*: the
[research note's §7](../../research/2026-09-04-modules.md) says "the
compute-consent question
[agent-custody](../agent-custody/design.md) left open", and
[`docs/projects/README.md`](../README.md) glosses which question that is, in
those words: agent-custody's *"whose ask a parked rc honors (compute
consent)"*. That question is answered.
[agent-custody's Open section](../agent-custody/design.md) now strikes it
through: **answered 11 Sep 2026 — its owner's.** Owner-only summons was
decided (D2) and built the same day; only the owner's word widens it
(`writtenBy` on the enrolment), the refusal carries the owner's own buttons
(#272), and the rc announces its policy with its hold. The reach half, which
the gate did not name but which a sandbox plainly wants, is `isocan rc
--sandbox` — and it brought the posture phase 5 should copy verbatim:
*asked for and not buildable is a refusal, never a quiet unfenced run.*

The paragraph above this one read the gate wider — "whose machine runs a
**module's** compute and on whose say-so" — and that reading has an answer
too, in this phase's own shape rather than in a decision still owed. A module
runs no compute of its own: `isocan sandbox run` is a verb a person or an
agent types, on the machine they typed it on, and the typing is the consent.
The one place that argument does not reach is a **hosted** home running
modules on somebody else's behalf, and that is already a separate open
question in [`design.md`](design.md) ("who runs modules on isocan.io", the
same decision as running `release` unattended) — not a gate this phase can
close, and not one it opens either, because the hosted home loads no runtime
module.

**Extension actors — SHUT for the frame, CLEAR for the verb.** The gate's
own gloss in the research note is *"who stamps a sandbox's writes"*, and
phase 5 has two shapes with two different answers:

- **The sandbox node in a frame** — HTML and JavaScript running in the
  viewer's browser on the content origin. That is extensions **tier 3**, it
  acts on its own, and it is somebody else's code: it needs a subject, and
  the gate holds. It is shut twice over, because tier 3 is unbuilt and
  [extensions stage 4](../extensions/design.md) says its own real predecessor
  is a panel that ACTS (stage 3), also unbuilt. The
  [workbench exfiltration finding](../../research/2026-09-04-modules.md) rides
  with it: the served CSP must say `connect-src <content-origin>` before the
  first frame renders.
- **The sandbox an agent runs where the agent is** — `isocan sandbox run`,
  the way `isocan edit` opens `$EDITOR` on the agent's machine. Nothing acts
  on its own here. A person or an agent typed a verb; the version it posts is
  stamped with the actor who typed it — an actor that already exists, is
  already attributed, already undoable per actor and already revocable. This
  is stage 4's own finding applied without changing a word: *a tier-1 tool
  does not act, it asks*, and giving the asker a second actor would make the
  log say the button asked for something when a person did.

So the gate was a dependency on the **declarative and hosted panel work**, not
on sandboxes as a category. Named precisely: it binds the shape whose writer
is code somebody else wrote, and does not bind the shape whose writer is
whoever typed the verb.

**The verdict.** Phase 5 walks its agent-side half now. The browser-frame half
is **not** built around: it stays gated, behind extensions stages 3 and 4 and
the CSP line, and the module built here deliberately has no frame, no
`postMessage` surface and no route.

## Phase 5 — sandboxes, the agent-side half

*Started 12 Sep 2026, after the gate check above.*

**The sentence.** *A sandbox is a program that lives on the canvas as a file
and runs on the machine that typed the verb, fenced, with what it printed
posted back as a version.* isocan still never runs compute — the
[architecture](../../architecture.md)'s given — and this does not change that:
the home orders the ops, and the program runs where a person already trusts
their own shell.

**The trust line this must not blur, stated where it can be checked.** A
**module** is trusted like the CLI you installed; an **extension** — and
anything that arrives *on a canvas* — is trusted like a collaborator. A
sandbox module sits exactly on that seam, because the module is ours and the
bytes it runs are a collaborator's. So: the module is loaded as the app, and
**the program is never**. The fence is not the module's to build, weaken or
skip — it asks the CLI's host for it, gets the app's own fence or a refusal,
and has no other way to start a process.
