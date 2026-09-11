---
status: partial
since: 2026-09-09
issue: 156
see: modules, extensions, workbench
note: five gaps reported from outside by romannurik, who built a sticker module against the real API. They are symptoms of one asymmetry — the module API can read from five places and write from exactly one, the palette action — and of one absent capability, because no operation carries bytes. The web half also has no host object, where the CLI half has `CliHost` and an explicit rule for promoting helpers into it. Recommends a `WebHost` with two members (`send`, `putBlob`), an `overlays` slot, a drop-mime registry, and notes that the canvas inspector needs no API change at all. Four of the five built the same day (bf0db60a, 9634e9d2) — `WebHost` with `send` (the door test inside it) and `putBlob`, the overlays slot against a named edge, and the drop-mime registry, with stickers rewritten on them behind Settings → Experiments. Residue — the canvas inspector mount is not built (inspectors still mount only in the workbench, though bf0db60a's message says otherwise), `putBlob` has no size bound, and the shape still has one module behind it.
---

# What a sticker module found

**9 September 2026.** Research. Nothing built when written.

**Where this stands, 11 Sep 2026: four of the five phases built, 9 Sep**
(bf0db60a "A module can write from where a person is looking", 9634e9d2 "An
overlay slot with nowhere to be") — `WebHost` with `send` and `putBlob`
(`packages/web/src/lib/modulehost.ts`, which settled the second open question
by putting `canEditNow()` inside `send`), the overlays slot, and the drop
registry (`moduleDropFor`, read by `CanvasViewport`'s drop handler). **Phase 3,
the canvas inspector mount, is not built**: `moduleInspectorsFor` is still
called only from `Workbench.tsx`, and `modules/authoring.md` says so, although
bf0db60a's message lists it as done. Still open from the list at the end: a
size bound for `putBlob`, and whether the shape holds for a second module by a
second author.

[@romannurik built a sticker item type](https://github.com/dglazkov/isocan/issues/156#issuecomment-5603055567)
against the module API — an on-canvas renderer, a workbench panel that drags
stickers onto the canvas, and a floating inspector to change one — and listed
five things he had to change in core to do it. He was explicit that it is not
a feature request. It is better than a feature request: it is the first report
from somebody building a module who did not also design the module system, and
every one of the five is real.

This note is what they turn out to be when you follow each back to its cause.
**They are not five gaps. They are two**, and one of the five needs no API
change at all.

## The finding: the API can read from five places and write from one

`ModuleAction.run` returns `readonly Operation[]`, and it is **the only place
in the module API that returns an operation.** Grep says so — one occurrence,
in one interface.

Everything else a module can mount is read-only by construction:

| Slot | What it is handed | Can it write? |
| --- | --- | --- |
| `underlays` | `{ canvas, drag }` | no |
| `renderers` | `{ canvasId, blobHash, mimeType, filename, entered, url, readText }` | no |
| `inspectors` | `{ canvasId, item, readText }` | no |
| `pages` | `{ canvasId, canvas }` | no |
| `actions` | `{ canvas, selection }` | **yes** — returns ops |

Four of those five are components a person looks at and interacts with. The
one that can write is a palette entry with no UI of its own.

That asymmetry was invisible while the modules were a mind map (an underlay), a
Mermaid renderer and a documents inspector, because none of those had to change
anything from inside the component. A sticker tray does — dragging a sticker
onto the canvas IS a write, made from a panel. So the first module with an
interactive surface hit the wall immediately, and hit it twice.

**It also contradicts a rule the design already states.** Under *What a module
may not add*: **"a hidden store — module state is an item, visible and
versioned."** A module is required to keep its state in items, and four of the
five places it can put UI cannot write an item. The rule and the API disagree,
and the API is the half that is wrong.

## The second finding: no operation carries bytes

`item.add` and `item.addVersion` both take a `NewVersion`, which carries a
`blobHash`. A blob is minted through a separate channel — `uploadBlob` — which
is not an operation and is not reachable from a module.

So a module can express **every** canvas change as ops except the ones that
need new content, which is exactly what a node-type module spends its life
doing. That is one cause with two symptoms, and it is why the report contains
two function-shaped asks rather than one:

- **`dropFile`** — placing a sticker needs an item with bytes in it.
- **`addVersion` in `InspectorFacts`** — changing a sticker needs a new version
  with different bytes.

Worth being precise about the second, because the report's wording invites the
wrong fix: **`item.addVersion` already exists and a module may already return
it.** Nothing needs adding to the vocabulary. What stops an inspector using it
is the first finding (an inspector has no way to return an op) and this one
(it could not produce the hash even if it could).

## The answer already exists, on the other surface

The CLI half of a module is handed **`CliHost`** — the program, `run`, `ctxOf`,
`resolveCanvas`, `resolveItem`, `sendOp`, `printJson`, `sizeFor`,
`placementFor`, `truncate` — with a rule written beside it:

> A module that wants a helper not listed here is asking for one to be
> promoted, which is a review question and not a private import.

That is exactly the situation the report describes, and exactly the process it
followed. The web half has no equivalent: it passes facts as props and has no
promotion path at all, so a module author who needs a helper has two choices —
reach into a zustand store, which the design forbids and which he correctly
refused to do, or file what he filed.

**The asymmetry is the bug.** The CLI half has a named, documented, reviewable
place for this; the web half has a wall.

## What to do

### 1. `WebHost`, mirroring `CliHost` — two members

Handed to every module component alongside its facts.

```ts
export interface WebHost {
  /** The same door `ModuleAction.run` returns into: echoed, undoable,
   *  grouped, and visible to the terminal as the same op. */
  send: (ops: readonly Operation[], group?: string) => Promise<void>;
  /** The one thing an operation cannot say. Returns the hash an
   *  `item.add` or `item.addVersion` then names. */
  putBlob: (bytes: Blob, mimeType: string, filename: string) => Promise<{ blobHash: string; size: number }>;
}
```

Two members close both function-shaped asks, and they close them **without
granting any new authority**: the writes are the same ops the palette already
sends, so they stay echoed, undoable and legible to the CLI. Nothing here lets
a module do something a person could not already do with a file and a verb,
which is #156's own test.

**Deliberately not `dropFile(file, at)`**, which is what the report asked for
and what a smaller version of this would ship. It bundles three decisions —
mint the bytes, choose the placement, send the op — and hands all three to the
shell, so a module cannot add an item with its own properties, title or size,
and cannot group two writes into one undo. `putBlob` + ops composes; `dropFile`
does one case and blocks the rest. The extra call is worth the composition.

### 2. An `overlays` slot

Screen-space, above the viewport, for a tray or a dock. It is the sixth slot
of the kind the design already anticipated — *"panel, page, inspector, tool:
each lands when a module asks"* — and a module has now asked.

**This is the one with real risk, and it is worth saying before it lands.**
`underlays` is safe because it is under everything, in world space, where a
module can only draw beneath the work. An overlay is the app's own chrome
space, and N modules mounting floating panels into it is how a shell turns
into a mess — the same failure the rail's and the dock's fixed lists exist to
prevent. It should land with a named region and a stated stacking order rather
than free positioning, or the second module to use it will overlap the first.

### 3. A drop-mime registry

The drop handler reads `e.dataTransfer.files` and `text/uri-list`, both
hard-coded, with no way for a module to claim a drag.

The shape is one the module system already uses: a module claims **mimes** for
its kinds, and a drag carries mimes. So a module declares the drag mimes it
accepts and is offered the data, returning ops (and, with `putBlob`, content) —
the same contract as everything else rather than a second one.

### 4. The canvas inspector needs no API change

`moduleInspectorsFor(kind)` already exists and `InspectorFacts` already carries
everything an inspector needs — `canvasId`, `item`, `readText` — all of which
the canvas has when an item is selected. Only `Workbench.tsx` mounts it.

So this is a **shell** change, not a module API change: mount the slot in a
second place. Worth separating out, because it is the cheapest of the five and
it does not need any of the review the others do.

The report's own argument for it is the strongest one and is about a feature
that has not been built yet: *"inspectors will be necessary for sandboxes,
there's a lot to configure and a lot of state to represent."* #156 puts
sandboxes last and behind three gates; an inspector that can be seen beside the
thing it configures is the shape that work will want.

## Decisions

**D1. The module API's write channel is the asymmetry to fix, not the five
symptoms.** One `WebHost` with `send` closes more than four separate helpers
would, and closes the ones nobody has hit yet.

**D2. Ops stay the unit of change.** A module writes by producing operations
the shell sends, never by calling a function that mutates. `putBlob` is the one
exception and it is not a mutation — it mints bytes and returns a hash, and the
change is still an op naming it.

**D3. `putBlob`, not `dropFile`.** Composition over convenience: the module
keeps title, size, properties and grouping.

**D4. Nothing here adds an operation, a protocol message or a route.** #156's
line holds: a module may only add what a person could already do with a file
and a verb.

**D5. The web half gets a host object because the CLI half has one.** The
promotion rule comes with it — a module wanting more is a review question, not
a private import — so the next report like this one has somewhere to land.

**D6. Overlays land with a region and a stacking order**, or they land as the
next thing somebody has to un-design.

## Phases

1. **`WebHost` with `send`.** Unblocks inspectors, pages and overlays writing
   at all, using ops that already exist. Nothing new in the vocabulary.
2. **`putBlob`.** The content half. Together with (1) this is every gap in the
   report except the slot itself.
3. **The canvas inspector mount.** Shell only; no API surface.
4. **`overlays`,** with its region rule.
5. **The drop registry.** Last because it is the only one whose shape is still
   a guess — one module has wanted it once, and the mime-claim design should be
   checked against a second case before it is fixed.

## What this leaves open

- **Whether an overlay should be allowed to mount without a person asking.** A
  renderer draws when its mime appears, which is invited. A tray that appears
  because a module is installed is chrome nobody chose. The rail's own entries
  are hideable (`lib/hideable.ts`); an overlay probably owes the same.
- **What `send` does about permission.** `ModuleAction` is offered from a
  palette a reader can open, and `canEditNow()` gates the writes today at the
  call site. A host `send` needs that test inside it rather than trusting five
  call sites to remember — this is the door argument, one layer in.
- **Whether `putBlob` needs a size bound.** `GROUND_MAX` caps a picture at 2MB
  because everybody on the canvas downloads it forever. A module minting blobs
  has the same property and no such rule.
- **Nothing here has been measured.** No module has been written against the
  proposed shape, and the report is one module by one author. The right next
  move is probably to hand him the branch rather than to declare the API
  finished.
