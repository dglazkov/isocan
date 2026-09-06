---
status: partial
since: 2026-09-06
see: extensions
note: stages 1 and 2 built 6 Sep — a declarative tool as an item with `role=tool`, `does` limited to a slash command that exists, a closed icon set, reserved labels, and the capability list printed before `--yes`; `isocan tool list/add` and the rail render from ONE reader in core. Stages 3 (declarative panels), 4 (extension actors — which has no subject to attribute until a panel ACTS, checked 6 Sep) and 5 (hosted panels; its content-origin gate cleared 6 Sep) not built
---
# Extending the canvas from inside it

People and agents can make things *on* a canvas. This is about letting them
make things *of* it: a new entry in the tool rail, a panel down the side, a
view that did not ship with the product.

The whole design turns on one sentence, so it goes first.

## The rule

> **An extension may only ask for what a person could ask for.**

Not "an extension runs in a sandbox". Sandboxes are a mitigation; this is a
model. Every isocan mutation is an `Operation` applied by one reducer, and
every operation is attributed to an actor. If an extension is an actor whose
requests go through the same door as everybody else's, then the worst it can do
is what a collaborator could do — which is a thing we already know how to see,
attribute, undo and revoke.

Everything below is an application of that sentence.

## An extension is an item

Not a new kind of object. `role=design-system` already makes an item mean
something to the app; `role=tool` and `role=panel` are the same move.

That is not a saving of effort, it is what the extension *gets*:

- **Versions**, so a panel has a history and a bad one rolls back with `S`.
- **Undo**, per actor, so installing one is one keystroke from undone.
- **Comments**, so a panel is a thing people can argue about in place.
- **Trash and restore**, with the same rules as anything else.
- **The CLI**, free: `isocan add rail.json --prop role=tool`.
- **Lineage**, so an extension made from another says so.

And the part that is actually new: **a canvas carries its own UI**. Open
somebody's canvas and the rail has their tool on it, because the tool is on the
canvas. Nothing had to be installed.

Home-wide extensions keep the split commands already use: a slash command lives
in `~/.isocan/commands` and applies everywhere; an item lives on one canvas.
Both, for the same reasons they exist for commands.

## Three tiers, and most things stop at the first

### 1. A declarative tool — no code at all

The overwhelmingly common want is *a button that does a thing I already have a
name for*.

```json
{ "kind": "tool", "label": "Tidy", "icon": "broom", "does": "/format" }
```

isocan renders that with its own component, its own tokens, its own focus
ring — so it cannot be off-brand, cannot be inaccessible, and cannot do
anything the vocabulary does not permit. **Safe by construction rather than by
containment**, which is a different and better kind of safe.

`does` is a slash command or an `Operation`. Both are things a person can
already ask for, which is the rule holding.

Icons come from a **named set we ship**. Not arbitrary SVG: an icon is a place
somebody would otherwise paint anything at all, including a convincing copy of
a control that already exists.

### 2. A declarative panel — described, not drawn

A panel that lists items, filters them, and acts on one is a shape, not a
program:

```json
{ "kind": "panel", "side": "left", "title": "Unreviewed",
  "rows": { "from": "items", "where": "not starred", "show": ["title", "updatedAt"] },
  "row-does": "/design-audit" }
```

The risk here is real and worth naming: **a declarative vocabulary grows until
it is a bad programming language**. The guard is a rule about additions, not
about size — a field is added when two real extensions need it, never because
one might.

### 3. A hosted panel — a page, on the content origin

When the shape genuinely is not describable, the panel is HTML in a sandboxed
frame served from a **[content origin](../atlas/content-origin.md)** — an origin that
holds no cookie, no badge and no API.

That proposal was written for two other reasons (letting an interactive item
keep state, and measuring a page). This is the third, and it is the one that
makes it load-bearing rather than nice: **without a content origin there is no
safe tier 3 at all**, because a panel on the app's origin can read the badge
cookie and act as the user.

The panel talks to isocan over `postMessage`, and the API it gets is narrow,
versioned, and made of operations — never a handle to internal state.

## An extension is an actor

This is the part that costs least and buys most, because it is already built.

Give an extension its own actor and a **grant**, exactly as a person gets one.
Then, with no new machinery:

- **Everything it does is attributed.** The oplog already carries an actor per
  op. "What did that panel change?" is `isocan activity <extension>`.
- **Undo is per actor**, so undoing an extension's work never touches yours,
  and yours never silently reverts its.
- **Revocation already means something.** `grants.ts` tombstones a grant and
  phase 9 re-runs the door test against every badge whose provenance names it.
  Turning an extension off expels it, rather than merely stopping the next one.
- **Presence shows it.** An extension doing work has a cursor and a status, the
  same as an agent. A panel quietly rewriting items is visible while it happens.

The permission model is therefore not new: it is the identity desk, pointed at
software instead of people.

## It must look like an extension

An extension's surface wears **its own name and colour**, the way a cursor
does. Not decoration — a panel that looks exactly like isocan is a place to put
a convincing "sign in to continue".

Two rules follow. An extension paints inside its slot and never over the
canvas, the top bar or another extension. And it may not use the identity
colours of people on the canvas, because that is somebody's face.

## What this must never become

- **No app-origin JavaScript.** No `eval`, no injected script, no "trusted"
  extension that skips the frame. There is no such thing as a trusted
  extension; there are only extensions whose author you trust today.
- **No new `Operation` per extension.** The vocabulary is the contract between
  the two surfaces. An extension that needs a new op is proposing a product
  feature, and should be told so.
- **No reading past the canvas it is on.** A grant is per canvas already.
- **No install without reading.** `isocan command add --from` prints the whole
  thing and installs nothing until `--yes`, because a command's body is
  instructions to every future agent. An extension is code with a seat at the
  table; it gets at least the same ceremony, and its declared capabilities are
  part of what gets printed.

## Both surfaces

A rail button is a web affordance, which looks like a violation and is not: the
*intent* is "make this action reachable", and the action is a command the CLI
can already run by name. The manifest is an item, so the CLI creates, lists,
edits and removes extensions like anything else. Nothing exists only in the web
app — the button is one surface's way of offering what the other surface offers
by typing.

## Stages

1. **Declarative tools.** ✅ **Built 6 Sep.** Manifest, named icons, `does`
   limited to existing commands. No new ops, no frames, no actors — the rail
   becomes editable and most of the want is met.

   `core/extensions.ts` is the one reader — `readToolExtension` answers with a
   tool or a **sentence naming the field**, and both surfaces call it, so a
   manifest the terminal refuses is one the rail refuses for the same reason.
   The rule is enforced where it is stated: `does` must name a command this
   canvas actually has, the icon must come from the set we ship (a closed set
   is a security decision — an icon is a place anything at all could be
   painted, including a copy of a control that already exists), and the label
   may not be one of the app's own tools, compared with case and punctuation
   flattened because a check that only catches the exact string catches nobody
   trying. `isocan tool list` / `tool add`; the rail draws them below a divider,
   with the tool's own name under the glyph. Pressing one calls `postToMain` —
   the same door the composer uses — which is the design's sentence made
   literal, and a test forbids the rail sending an operation of its own.

   **No new op, route or store**, and the CLI test proves it the honest way: it
   asserts `isocan ls` sees a tool as an ordinary item with `role=tool`, and
   removes one with `rm` rather than a verb of its own.

2. **The capability list**, printed on install, even though tier 1 needs almost
   none. The habit has to exist before the tier that depends on it.
   ✅ **Built 6 Sep, with stage 1** and for exactly the stated reason.
   `toolCapabilities` is **derived, never declared** — a manifest that stated
   its own capabilities could understate them — and `tool add` prints it and
   adds nothing until `--yes`, the gate `command add --from` already has.
3. **Declarative panels**, once two real tools have asked for the same shape.
4. **Extension actors and grants**, which is mostly wiring the identity desk to
   a non-human subject.

   **It has no subject yet, and that is a finding rather than a delay.**
   Checked on 6 Sep with stages 1 and 2 built: a tier-1 tool does not *act*, it
   *asks*. Pressing one posts the slash command the person would have typed,
   under that person's actor, and the acting is done by whatever agent picks
   the comment up — which is already attributed, already undoable per actor,
   already revocable. Giving the tool its own actor there would make the log
   say the Tidy button asked for something, when what happened is that a person
   asked for it with one click instead of eight keystrokes. That is a worse
   record, not a better one.

   The subject appears at tier 2 and 3, where a panel acts on its own — and
   tier 3 is where it becomes load-bearing, because a hosted panel is somebody
   else's code. So this stage's real predecessor is **a panel that acts**, not
   the calendar. Building the desk wiring first would be machinery with nothing
   to attribute, tested only against a fixture, which is the thing this design
   forbids two paragraphs above about panel fields: *added when two real
   extensions need it, never because one might.*

   What stages 1 and 2 did settle, and what stage 4 inherits: the manifest, the
   one reader, the capability list, and the rule that the ask goes through the
   same door a person's message goes through. An extension actor is a change of
   WHO is at that door, not a second door.
5. **Hosted panels**, after the content origin lands. Not before.
   *(The content origin landed on prod 6 Sep, so this gate is clear — the two
   in front of it are not.)*

## Open

- **How does a rail with forty buttons not happen?** `/skill`'s own body says a
  canvas whose menu is forty commands nobody chose is worse than one with
  eight, and that rule is easier to state than to enforce. Probably: the rail
  shows what this canvas uses, and the rest lives behind ⌘K.
- **What is `where` in a panel query, exactly?** The honest answer is that it
  should start as almost nothing — starred, kind, unreviewed — and grow only on
  evidence. `isocan ls` already has `--kind`, `--filter` and `--starred`, and
  reusing that vocabulary is better than inventing a second one.
- **Does an extension get its own storage?** Probably its own item, so state is
  a thing you can see, version and delete. Worth resisting a hidden key-value
  store for as long as possible.
- **What happens to a canvas whose extension is gone?** The item is still
  there, so the manifest is still there; the rail should say a tool is
  unavailable rather than silently dropping it.
