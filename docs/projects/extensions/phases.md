# Extensions — the walk

**18 September 2026.** The order of work for [design.md](design.md). Each
phase ends with **Trajectory**: only what the phase discovered that changes the
project's course. A phase that went as planned leaves it empty.

**Where we are: phases 1 and 2 CLOSED 6 Sep 2026 — a declarative tool is an
item with `role=tool`, read by one reader in core, and its capabilities are
printed before `--yes`. Phase 3 is next: the panel manifest and its one reader.
Phases 3, 4 and 6 are the design's stage 5 (hosted panels) cut into the three
acts it turned out to be, and phase 5 is the design's stage 4 (extension
actors), which moved behind them because that is where it finally has a
subject. Phase 7 is the design's stage 3 (declarative panels), moved to the
end: its gate is evidence, and the evidence has not arrived.** No phase needs
a person: no ⚑ step, no cloud resource, no second machine. The content origin
— the gate the design named for the hosted tier — went live on prod 6 Sep.

The rule for every phase, from the design and not negotiable here: **an
extension may only ask for what a person could ask for.** No app-origin
JavaScript, no new `Operation` per extension, no reading past the canvas it is
on, and no install without reading. A phase that would need any of those four
is the wrong phase.

## Phase 1 — Declarative tools

**Status: CLOSED.** 6 September 2026 — a tool is an item with `role=tool`,
`does` limited to a slash command that exists, a closed icon set and reserved
labels; `isocan tool list/add` and the rail render from one reader in core.

**Outcome:** `packages/core/src/extensions.ts` is the one reader.
`readToolExtension` answers with a tool or a **sentence naming the field**, and
both surfaces call it, so a manifest the terminal refuses is one the rail
refuses for the same reason. Pressing a tool calls `postToMain` — the same door
the composer uses.

**Proof:** the CLI test asserts `isocan ls` sees a tool as an ordinary item with
`role=tool` and removes one with `rm` rather than a verb of its own; a test
forbids the rail sending an operation of its own. No new op, route or store.

**Trajectory:** *nothing — the phase went as planned.*

## Phase 2 — The capability list

**Status: CLOSED.** 6 September 2026 — `toolCapabilities` is derived, never
declared, and `tool add` prints it and adds nothing until `--yes`.

**Outcome:** the ceremony `command add --from` already had, extended to
extensions, built with phase 1 and for the stated reason: the habit has to
exist before the tier that depends on it.

**Proof:** in the suite with phase 1's.

**Trajectory:** *nothing — the phase went as planned.*

## Phase 3 — The panel manifest, and one reader

**Status: NOT STARTED.**

**Outcome:** `role=panel` makes an item a panel the way `role=tool` makes one a
tool and `role=design-system` makes one a design system — no new kind, no new
op. A manifest names `title`, `side` and `src`, where `src` names a blob **on
this canvas**, and one reader in core — `readPanelExtension`, beside
`readToolExtension` in `packages/core/src/extensions.ts` — answers with a panel
or a sentence naming the field. Reserved titles follow the tool's reserved
labels and are compared with case and punctuation flattened, for the same
reason: a panel that looks exactly like isocan is a place to put a convincing
"sign in to continue". `panelCapabilities` is derived, never declared, and
`isocan panel list/add` prints it and adds nothing until `--yes`.

Nothing renders in this phase. That is deliberate and it is what makes the
phase worth having on its own: the manifest is readable, refusable and
removable before there is a frame to argue about, and a refusal that arrives
when the file is read beats one that arrives when the panel is already on
screen.

**Proof:** `isocan panel add` on a manifest naming a `src` that is not a blob on
this canvas refuses in a sentence naming `src`, and writes nothing; the same
manifest is refused by the app's reader with the same sentence, asserted
against the same function. A reserved title is refused with punctuation and
case flattened ("I S O C A N" and "isocan" are one attempt). `isocan panel add`
prints the capability list and adds nothing without `--yes`. `isocan ls` sees an
added panel as an ordinary item with `role=panel`, and `rm` removes it — no verb
of its own. The surface guard in `packages/cli/test/surface.test.ts` passes,
which means the new verbs are in the agent guide's quick reference. `npm test`
and `npm run typecheck` whole.

## Phase 4 — The frame on the content origin

**Status: NOT STARTED.**

**Outcome:** a panel renders in a dock slot as a sandboxed iframe whose `src` is
the content base plus the blob the manifest names — never the app origin, and
there is no "trusted" panel that skips the frame. It wears its own name and
colour the way a cursor does, paints inside its slot and never over the canvas,
the top bar or another panel, and may not use the identity colours of people on
the canvas, because that is somebody's face. The app's served CSP gains
`frame-src <content-origin>`; the content origin's own `CONTENT_CSP` is
unchanged, `connect-src 'none'` included, so a panel in this phase can render
and remember and cannot talk. A canvas whose panel blob is gone says the panel
is unavailable rather than silently dropping it.

**Proof:** a panel item renders a frame whose `src` origin is `contentBase()`
and never the app's, asserted in `packages/web/test/`; falsified by pointing the
manifest at an app-origin path, which must refuse. The served app CSP carries
`frame-src` naming the content base, asserted against the served header rather
than a constant. A panel's rendered surface carries its own name, and a test
forbids it taking a person's identity colour. A missing blob renders the
unavailable sentence. `CONTENT_CSP` is unchanged — asserted, because this phase
must not open the exfiltration channel that stage 3 of the content origin closed
by measurement. `npm test`, `npm run typecheck`, and the bundle budget.

## Phase 5 — The extension actor

**Status: NOT STARTED.**

**Outcome:** the design's stage 4, and it lands here rather than third because
here is where it first has a subject. A panel gets its own actor and a grant,
exactly as a person gets one — the identity desk pointed at software instead of
people, which is why this stage costs least and buys most. Everything the panel
does is attributed, so `isocan activity <extension>` answers "what did that
panel change?"; undo is per actor, so undoing a panel's work never touches
yours; revocation already means something, because `grants.ts` tombstones a
grant and the door test re-runs against every badge whose provenance names it;
and presence shows it, so a panel rewriting items is visible while it happens.

**Proof:** a panel's write is attributed to the panel's actor and not to the
person watching it; `isocan activity <extension>` lists exactly those ops. An
undo by the person does not revert the panel's ops and an undo by the panel does
not revert the person's. Revoking the panel's grant expels it — its next ask is
refused at the door, not merely unsent — asserted through the existing door
test rather than a new one. Presence carries the panel while it works.
`npm test` and `npm run typecheck` whole.

## Phase 6 — The narrow door

**Status: NOT STARTED.**

**Outcome:** the panel talks to isocan over `postMessage`, and the API it gets
is narrow, versioned, and made of operations — never a handle to internal
state. Every message is an `Operation` the vocabulary already has, stamped with
the panel's actor from phase 5 and sent through the same door a person's op
goes through, which is the design's one sentence made literal for the tier that
most needed it. A panel proposing a new op is proposing a product feature and
is told so.

**Proof:** a message naming an operation outside the vocabulary is refused and
nothing is written. A message naming an operation the panel's grant does not
permit is refused at the door, the same refusal a person with that grant would
get. The protocol carries its version and a message from an unknown version is
refused rather than guessed at. A test forbids the bridge handing the frame any
object other than the operation result — no store, no client, no badge.
Messages from any origin but the content origin are ignored. `npm test` and
`npm run typecheck` whole.

## Phase 7 — Declarative panels

**Status: NOT STARTED.**

**Outcome:** the design's tier 2 — a panel that lists items, filters them and
acts on one, described rather than drawn. It is last rather than third because
its gate is evidence and the evidence has not arrived: the design says a field
is added "when two real extensions need it, never because one might", and the
same rule governs the vocabulary as a whole. Nothing has asked for the rows
shape. What asked, twice, was the hosted tier.

When it is built, `where` starts as almost nothing — starred, kind, unreviewed
— and reuses `isocan ls`'s existing `--kind`, `--filter` and `--starred` rather
than inventing a second vocabulary.

**Proof:** to be written when the gate opens. A proof written now would be
written against the fixture that a speculative vocabulary always gets, which is
the failure this phase is ordered last to avoid.

**Formerly:** the design's **stage 3**, and third in the walk. Moved to the end
18 Sep 2026; the argument is in the Trajectory below and in design.md's Stages
section.

**Trajectory:**

- **2026-09-18** — Open: phase 7 waits on evidence, not on work — two real
  tools wanting the same declarative shape. Nothing else in this project waits
  on it, and a later phase must not quietly take it as a dependency.
