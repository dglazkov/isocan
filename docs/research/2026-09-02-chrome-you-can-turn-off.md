---
status: designed
since: 2026-09-02
issue: 151
see: ui-refresh
note: designed 2 Sep — chrome a person can hide (undo/redo in the zoom cluster, the scrubber's rail glyph), as a local preference over a registry of controls, with three doors: right-click the control, a Settings sheet, and ⌘K as the door that never closes. Nothing built
---

# Chrome you can turn off

**2 September 2026.** A design question, thought through before anything is
built. As asked: *some users don't want the undo/redo arrows in the bottom
right zoom cluster; others don't want the history scrubber as an icon on the
right rail, and reach for it via ⌘K instead. What is the best way to manage
this? Right-click a control to hide it and right-click the area to add it
back? A Settings sheet with toggles? Both?*

The short version: **both doors, one registry, and a third door that never
closes.** A preference is a fact about a person and a browser, not about a
canvas, so it lives where the theme and the last text step already live —
local storage, never the wire. Every hideable control is an entry in one
list in code, with a name, a description, a default and the ⌘K command that
reaches the same thing; the right-click and the Settings sheet are two views
of that list; and hiding a control never removes a capability, because ⌘K
still names it. That last rule is what makes hiding safe enough to offer on
a right-click.

## What good looks like elsewhere, briefly

The tools people already know do this in two idioms. **Direct**: right-click
a toolbar and untick things (browsers, IDEs, Figma's "Show UI"), which is
fast and discoverable at the moment of irritation, and hard to undo because
the thing you would right-click is now gone — so every one of them pairs it
with a menu or a "Customize toolbar…" sheet where the hidden things are
listed. **Settled**: a Preferences pane with switches and a sentence each,
which is slow to reach and easy to search. Nobody ships only the first.
Chrome the person cannot see must be reachable by a door the person cannot
lose: a menu bar, a command palette, a keyboard shortcut. isocan has that
door already — ⌘K — and the design leans on it.

## The registry

One list, in `web/src/lib/chrome.ts`:

```
{ id: "zoom.undo",      name: "Undo and redo",   where: "zoom cluster", default: on,  command: "Undo" }
{ id: "rail.history",   name: "History",         where: "rail",         default: on,  command: "History" }
{ id: "rail.minimap",   name: "Minimap",         where: "corner",       default: on,  command: "Minimap" }
{ id: "radar.edges",    name: "Edge radar",      where: "canvas edges", default: on,  command: null }
…
```

Rules for what may be in it: a control may be hidden only if the thing it
does is reachable another way — the `command` column names the ⌘K action, or
the keyboard shortcut, and a test refuses an entry with neither. Hiding is
per control, not per group, so "undo/redo" is one entry and "the whole zoom
cluster" is not: the zoom number is how you know where you are, and there is
no other door to it.

## The three doors

**1. Right-click the control → "Hide undo and redo".** The moment of
irritation is the moment to act. The item menu already exists
(`menuentries.tsx`); a chrome menu is the same component over the registry
entry under the pointer. The menu says how to get it back: *"Hide undo and
redo — ⌘K still undoes; Settings brings it back"*. Nothing is hidden without
being told where the door is.

**2. Right-click the area → "Show…"** lists that area's hidden controls, so
the zoom cluster's empty left edge, or the rail's gap, is itself the way
back for somebody who remembers roughly where the thing was. And **Settings**
— under the identity menu beside Theme, and as a ⌘K command — lists every
entry with its sentence, a switch, and a *Show everything* at the bottom.
The sheet is the one place the whole list is visible, which is what makes
door 1 safe to use casually.

**3. ⌘K, always.** Every registry entry's action is a palette command; the
palette itself is not in the registry and cannot be hidden. A person who
hides the scrubber's glyph reaches history by typing it, which is what was
asked for; a person who hides everything still has a working app.

## Where it lives, and what it is not

- **Local, per browser**, in `uiStore` beside `lastTextStyle` and the theme:
  `hiddenChrome: string[]`, read from and written to local storage with the
  same try/catch the text step uses. Not a canvas fact and not an identity
  fact: the same person may want the rail bare on a laptop and full on a
  desk, and a canvas is not the place to record anybody's taste.
- **Not a capability.** A hidden control changes nothing an op can see; the
  read-only canvas (roles) is a different mechanism and stays one.
- **Not a layout editor.** No dragging controls between areas, no
  reordering. Hide and show, and the defaults, is the whole feature; the
  ui-refresh project already decided where things go.
- **Defaults are decided in one place** — the registry — and a new control
  is opt-in to the registry, so nothing becomes hideable by accident.

## Recommendation, in stages

1. The registry, the store field, and the two controls that were asked for:
   undo/redo in the zoom cluster and the History glyph on the rail; hidden
   by right-click, shown again from Settings under the identity menu.
2. Right-click the empty area to show that area's hidden controls.
3. The rest of the rail and the corners, one entry each, as people ask.
4. The test that keeps the door open: every registry entry names a ⌘K
   command or a shortcut, and the palette lists it.
