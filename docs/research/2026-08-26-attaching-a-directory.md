# Attaching a directory without the CLI

**26 August 2026.** The workbench's files pane, on an unbound canvas, says:

> no directory is bound to this canvas on this machine (isocan use \<canvas\>)

A dead end that names a terminal. The ask: **a non-CLI way to do what `isocan
use` does** — and, since it comes up in the same breath, what "local" and
"remote" each mean here, and whether a *repo* can be the thing you point at.

Sorted, as the WYSIWYG note was, by the one fact that decides the shape and
is not what anybody expects going in: **the File System Access API cannot do
this job, and the reason is definitional rather than a gap.**

## What binding actually is

`isocan use <ref>` makes exactly two writes (`cli/src/binding.ts`):

1. **The marker** — `<root>/.isocan/project.json`, holding the canvas id, its
   title, and the home it lives at. *Authoritative, and it travels with the
   directory*: it is committed to git, so a teammate who clones the repo
   already has the canvas identity in their working tree.
2. **The roster row** — `~/.isocan/dirs.json`, an absolute path → canvas id.
   *A per-machine cache*, healed lazily, never trusted over the marker.

And `bindableRoot` walks up to the **git toplevel** before binding, so a
binding is already repo-shaped: run it in a subdirectory and it binds the
repo.

The read side (`server/src/tree.ts`, `treeGate` in `http.ts`) then demands all
of: a loopback-bound daemon, a loopback peer, the canvas's home being *this*
daemon, and a `dirs.json` row **verified against the marker on disk**.

So "bind a directory" means: *write a marker there, and record its absolute
path on this machine.* Both halves matter, and the second is the one the
browser cannot supply.

## The physics, measured

Probed in this app's own browser, today, rather than assumed:

| what | answer |
| --- | --- |
| `'showDirectoryPicker' in window` | **yes** (Chromium; `127.0.0.1` is a secure context) |
| `FileSystemHandle.prototype` | `kind`, `name`, `isSameEntry`, `queryPermission`, `remove`, `requestPermission` |
| `FileSystemDirectoryHandle.prototype` | `getDirectoryHandle`, `getFileHandle`, `removeEntry`, `resolve`, `entries`, `keys`, `values` |
| `File.prototype.path` | **absent** (that is Electron, not the web) |
| `DataTransferItem.getAsFileSystemHandle` | yes — dropping a folder also yields a handle |

**There is no path on a handle, and there is no API that returns one.**
`resolve()` sounds like the exception and is not: it returns a path *relative
to an ancestor handle you already hold*, never a location on disk. This is
the API working as designed — the grant is "you may read inside this
directory", deliberately not "you may learn where it is."

Two consequences follow immediately:

- **A directory picked in the browser cannot be written into `dirs.json`,**
  so it cannot become a binding the daemon, the CLI, or any agent can see.
  Whatever the File System Access API gives us, it is not `isocan use`.
- **The daemon is the only party that can name a directory** — it is the one
  with a filesystem. Any real binding has to be made *there*.

And the API's reach is narrow besides: `showDirectoryPicker` is Chromium
desktop only — Firefox and Safari implement only the origin-private file
system and skip the local-disk pickers entirely, and no mobile browser has
it.

## Local and remote are different questions

They are already different in the code, which is worth saying plainly because
it constrains every option below.

`treeGate` refuses outright when `homes.homeOf(canvasId) !== null` — when the
canvas lives somewhere else:

> this canvas's files live with its home daemon, on its owner's machine — the
> tree is served only there, only locally

So today: **a hosted canvas has no file tree for anybody.** Not for the
viewer, and not for the owner sitting at the machine that holds the repo. The
rule is "the tree belongs to the canvas's home", and a hosted home is a Cloud
Run container with no working copy.

That is the split, and it means the remote question is not "how do we bind a
directory remotely" — there is no directory at the remote end. It is: *what
should a person with the repo on their own disk see, when the canvas they are
looking at lives at isocan.io?* See the open questions.

## The field

### A. A picker served by the daemon

The daemon lists directories (starting at `$HOME`), the app renders them, you
navigate and choose, and the daemon performs the exact two writes `isocan
use` performs. One binding path, two surfaces — the shape every other verb in
this product already has.

**Critique.** It is the only option that produces a *real* binding: the CLI
sees it, agents see it, the files pane lights up, and nothing about the
security posture changes because the binding it creates is the same one. It
works in every browser. The cost is honest and is not small: it adds a route
that **enumerates directories the canvas is not bound to**, which is strictly
wider than anything `tree.ts` serves today. It would need that module's
rigor, and probably narrower: directory names only (never file contents),
never dotfiles, `$HOME` and below only, symlinks not followed, loopback and
local-home gated like everything else. `binding.ts` would move from
`packages/cli` into `packages/server`, where the CLI already imports `paths`
and `stalenessOf` from — the dependency already points that way.

### B. Paste a path

A field. You paste `/Users/dalmaer/code/isocan`; the daemon validates it,
writes the marker, records the row, and says what it bound.

**Critique.** The smallest possible surface — the daemon enumerates *nothing*
and only ever confirms a path the person already knew. It works in every
browser, needs no picker, and the gesture is one keystroke for anyone with a
terminal (`pwd`) or a Finder window (⌘⌥C copies the path). It is not
*elegant*, and it is the fastest route to killing the dead-end message. Its
real weakness is discovery: it helps a person who knows the path and abandons
one who does not.

### C. The File System Access API

`showDirectoryPicker()`, the handle persisted in IndexedDB, files read through
it in the browser.

**Critique for the stated ask: it cannot do it.** No path, so no roster row,
so no binding — the daemon, the CLI and every agent stay blind to it, which
is most of what binding is *for*. What it can do is a different and real
thing: **give a canvas a file tree from the viewer's own machine when no
daemon can supply one** — the hosted case, where it is the only mechanism
that exists at all. Sharply bounded: Chromium desktop only, per-browser,
per-viewer, permission re-asked on later visits, and invisible to everybody
else on the canvas. Worth building for the hosted story; worth *not* building
as the answer to "bind a directory", where it would produce a second kind of
binding that only one browser can see. Two kinds of binding is two answers to
"where do this canvas's files live", which is the shape of bug this codebase
keeps writing comments about.

*(One tempting hybrid, recorded so nobody rediscovers it as a shortcut: a
read-write handle CAN write `.isocan/project.json` into the chosen directory,
and the marker is the authoritative half. That makes the directory
self-identifying without telling the daemon anything — a latent bind that
becomes real the moment any CLI command runs there. Clever, and too clever to
lead with: the pane would say "bound" while the tree stayed empty.)*

### D. Point at a repo

Two readings, and they are very different sizes.

**(i) A remote repo as a source** — give a GitHub URL, the daemon clones or
fetches, the tree is served from that. A real project: credentials, refresh,
disk, and a change in what FILES *means* — no longer "the directory you are
working in" but "a snapshot of someone's HEAD", which the ＋ button's whole
premise (these are my files, I am crossing them onto the canvas) does not
survive intact.

**(ii) Adopting a repo that already carries a marker** — much smaller, and
the highest-value thing in this document. The marker is committed, so **a
teammate who clones a bound repo already has the binding in their tree**;
what they lack is the `dirs.json` row on their machine. So the feature is not
"point at a repo", it is *"this directory says it belongs to canvas X — bind
it here?"* — offered wherever a daemon can see a marker it has no row for.
That is how a whole team gets bound without each person learning a CLI verb,
and it reuses `readMarker` plus `recordDir` with nothing new invented.

## Recommendation

**B, then A, with D(ii) folded in — and C built separately, for the hosted
case, and never called binding.**

1. **Replace the dead end with an affordance.** The pane's message should
   offer the two things a person can actually do rather than name a command
   they must leave to run. Paste-a-path (B) is the whole of step one, and it
   deletes the string that prompted this note.
2. **Then the daemon-side picker (A)**, with `tree.ts`'s jail discipline
   applied to a listing that is deliberately thinner than the tree's:
   directory names, under `$HOME`, no dotfiles, no symlinks, loopback only.
3. **Adoption (D-ii) rides along with both**: when the chosen or pasted
   directory already holds a marker, the flow is "this repo already belongs to
   *Acme Board* — bind it here?" rather than an overwrite. That single case is
   the team story.
4. **The File System Access API is its own feature, for hosted canvases**,
   named as what it is: *this browser's view of a folder on this machine.*
   Not a binding, not shared, and not offered where a real binding is
   possible.

The reasoning in one paragraph: binding is a fact about a machine — an
absolute path recorded beside a marker on disk — and the browser is
constitutionally unable to state that fact, by a design decision in the
platform rather than an oversight. So the browser's job here is to *ask*, and
the daemon's job is to *do*, which is the arrangement every other verb in
this product already uses. The File System Access API is not a way to bind; it
is a way to have files at all when there is no daemon to ask, which is a real
gap and a different feature.

## Open questions, for the build

- **Should a local daemon serve the tree for a canvas whose home is
  elsewhere?** Today it refuses, and the refusal is about the tree belonging
  to the canvas's home. But when the canvas lives at isocan.io and the repo is
  on my laptop, the daemon that could answer is mine, the browser asking is
  mine, and the loopback gate is already the thing making it private. Relaxing
  this to "the OWNER's own machine may serve its own disk to its own browser,
  hosted canvas or not" is the single change that would make attaching a
  directory work for hosted canvases — and it needs the security review that
  the original tree gate got, because "the canvas's home" is currently doing
  load-bearing work in that predicate.
- **How wide may a picker list?** `$HOME` and below is the obvious bound; the
  alternative is listing only directories that already hold markers plus
  whatever the person navigates to. The narrower rule is worth considering
  precisely because the wider one is the first directory-enumeration surface
  this daemon has ever had.
- **What happens when a directory is bound to a different canvas already?**
  The CLI overwrites. A picker should probably refuse and say so — the
  gesture is cheaper there, so the mistake is cheaper to make.
- **Where does the binding UI live?** The files pane is where the absence is
  felt, but the canvas list is where somebody would go to set a project up.
  Probably both, from one component.

## Sources

- `isocan use`, `writeMarker`, `recordDir`, `bindableRoot`: read in
  `packages/cli/src/binding.ts` and `packages/cli/src/main.ts`, this session.
  The gate: `treeGate` in `packages/server/src/http.ts`, `boundDirs` in
  `packages/server/src/tree.ts`.
- Handle surface (no path, `resolve()` semantics), `showDirectoryPicker`
  presence, absent `File.path`, `getAsFileSystemHandle`: **measured in this
  app's browser**, this session.
- Browser support: [MDN — `showDirectoryPicker()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) · [MDN — `FileSystemDirectoryHandle`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle) · [Chrome for Developers — File System Access](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) · [Cloud Four — The Many, Confusing File System APIs](https://cloudfour.com/thinks/the-many-confusing-file-system-apis/)
