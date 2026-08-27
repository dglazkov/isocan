# Items backed by files

**27 August 2026.** A canvas holding ten screens sat beside a repo holding
one, and the files pane showed the repo — correctly, and confusingly. The gap
underneath: **`＋` carries a file from the disk onto the canvas, and nothing
carries an item back.** So a screen an agent writes lives on the canvas
forever unless a person copies it out by hand.

The ask, in Dion's framing, is not "sync the canvas to the repo". It is a
CHOICE, made per item, by whoever made it:

> "I want to see a view" — you don't want it backed by a file. But when you
> ask to create a new screen that is a new system, you may want it too.

So: a signal saying which items are backed, and a gesture that backs one —
available to a person and to an agent alike.

## Two facts, not one

The design turns on a distinction that the binding forces and that is easy to
miss: **where a file belongs is a canvas fact; whether it is written is a
fact about one machine.**

A binding lives in `~/.isocan/dirs.json` plus a marker in the directory. It
is per-machine by construction — the same canvas open on a laptop with no
checkout has no directory at all. So "this item is backed by a file" cannot
be one boolean. It is:

- **Intent** — *this item IS the file at `<path>`.* A canvas fact: it
  replicates, it travels to every machine, and a teammate who clones the repo
  learns it with the canvas. Stored as an item PROPERTY.
- **State** — *what that machine's disk currently says.* Derived, never
  stored, and different on every machine: `written` (the file is there and
  matches), `drifted` (there and different), `absent` (tracked, never written
  here), `unbound` (no directory on this machine at all).

That is git's tracked-and-modified, arrived at from the other direction, and
the decomposition is what makes the feature honest on a hosted canvas: intent
replicates, state simply says `unbound` where there is no disk.

## Zero new operations, again

The intent is a fact about an item that is not its content, and this product
already has exactly one vocabulary for that: item properties, written by
`item.update`'s `MetaPatch` — the same op `annotates`, `region`, `role` and
`parent` all ride. So:

```
properties.file = "src/views/start.html"   // relative to the bound root
```

`isocan set <item>` already writes properties, the web already sends
`item.update`, undo already inverts it, and the reducer already replays it.
The workbench's zero-new-ops result holds for this too, and for the same
reason: the vocabulary was general enough.

Relative to the ROOT, never absolute: an absolute path is one machine's
answer to a question the canvas is asking, and it would be wrong the moment
a teammate cloned the repo somewhere else.

## Writing is the new thing, and it is the dangerous one

`tree.ts` opens with "Nothing here writes." That stops being true, and this
is the largest step this product has taken toward a person's filesystem. It
gets the tree's rules and then more, because a bad READ leaks a listing and
a bad WRITE destroys work:

- **Owner-scoped, loopback, local-home** — the tree's gate exactly, no
  weaker. A canvas link must never reach a disk.
- **Jailed to the bound root**, checked on the RESOLVED path so `..` and a
  symlink spelling cannot walk out — `readBound`'s rule, applied to a
  destination rather than a source.
- **Never a dotfile or a dot-directory, at any segment.** `listable` already
  says what may be SEEN; the same answer decides what may be WRITTEN, so a
  path can never reach `.git/config`, `.env`, or `.ssh/`.
- **Never through a symlink.** Every existing segment is `lstat`ed; one link
  anywhere on the way refuses the write.
- **Refuses to overwrite drift.** If the file on disk differs from the item's
  last written bytes, somebody edited it outside the canvas, and a silent
  overwrite would eat their work. Refuse, name the drift, and let the person
  decide — the same instinct as the hunk-dance and as the picker refusing a
  directory already bound.
- **Creates parent directories only where every segment is listable**, so a
  path cannot conjure `.hidden/` on the way to its file.

## What a person and an agent each get

Symmetric, which is the whole product's rule:

| | person | agent |
| --- | --- | --- |
| mark an item as a file | a control on the item | `isocan set <item> --file <path>` |
| write it out | the same control | `isocan save <item>` |
| see the state | a mark on the item, and in the files pane | `isocan ls` / `isocan tree` |

And `＋` — which already carries a file onto the canvas — starts setting
`file` on the item it creates, because that item demonstrably IS that file.
That closes the round trip that was open in one direction.

## What this is NOT

- **Not sync.** Nothing watches, nothing writes on its own, nothing pulls.
  Every crossing is a gesture somebody made, which is the same line `＋`
  already draws between "on my disk" and "on the canvas".
- **Not git.** No staging, no commits, no branches. The file lands in the
  working tree and the person's own tools take it from there.
- **Not a requirement.** An untracked item is the default and stays perfectly
  useful — the throwaway view is the common case, not the degenerate one.

## Open

- **Reading back.** If the disk drifts, should the canvas be able to pull the
  file into a new version? It is the mirror of the write and probably wants
  the same gesture in reverse, but drift is rare enough that refusing loudly
  may be enough for now.
- **Renames.** Changing `file` re-points an item; it does not move the file
  on disk, and the old one stays where it was. Recorded so nobody assumes.
- **Several roots.** A canvas may be bound to several directories on one
  machine (worktrees, clones). The write goes to the FIRST, as the tree's
  read already does, and that is worth revisiting if anybody actually works
  that way.
