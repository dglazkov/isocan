---
status: designed
since: 2026-09-11
see: workbench, modules, multiuser, embed
note: registration seed — extends docs/research/2026-08-26-attaching-a-directory.md (#141) with daemon-held file watching, change operations in the oplog, and canvas collections; P1 deferred/backlog, not implemented
---

# Watched files and canvas collections

**11 September 2026.** Track registration (pa5). Thin on purpose: registers
the project in the roadmap and records its architectural boundaries. Status is
**P1 deferred / backlog** (Paul Kinlan directive); this registration activates
no implementation.

The thesis in one line: **a file change in a granted project directory mints an
operation into the oplog, visible to every surface and agent without polling or
side channels.**

---

## 1. What it extends: building on `#141`

This design directly extends
[`docs/research/2026-08-26-attaching-a-directory.md`](../../research/2026-08-26-attaching-a-directory.md)
(Issue #141, `status: partial`). The research note established:
- Steps 1–3 are built: paste-a-path, the daemon-side directory picker with jail
  discipline (`$HOME` bounds, no symlinks, loopback-only), and repo adoption
  via committed `.isocan/project.json` markers.
- The hosted case and live file synchronization remain unbuilt.

---

## 2. Core architectural boundaries

1. **A file change mints an `Operation`, not a side channel**:
   - When a watched file changes on disk, the watcher emits standard canvas
     operations (`item.add`, `item.addVersion`, `item.delete`) with
     content-addressed blob hashes.
   - The oplog is the sole publication channel. Every connected human, CLI
     listener, and autonomous agent (`isocan rc`) observes changes through the
     existing WebSocket feed; zero filesystem polling and zero secondary event
     buses are introduced.
   - Recording an operation in the oplog does **not** make arbitrary external
     byte edits undoable: `⌘Z` can revert canvas-level item references or restore
     pre-images from cached blobs, but cannot reverse destructive external
     filesystem changes made by third-party processes.

2. **The daemon-held tree carries the design**:
   - The primary architecture rests on a **daemon-held tree with a native
     filesystem watcher** (`node:fs/watch` / platform backend).
   - The local daemon is the sole entity with authoritative disk paths, git
     toplevel resolution, and filesystem lifecycle. It serves the CLI, the web
     canvas, and remote agents alike (preserving the Isomorphism Rule).

3. **Browser directory handles are a secondary, scoped grant path**:
   - Browser-held handles via the File System Access API (`showDirectoryPicker`)
     provide a client-side view for hosted canvases (where no local daemon is
     present).
   - **`FileSystemObserver` reality**: Verified against current specifications.
     `FileSystemObserver` is a proposed Web API enabled on Chromium desktop in
     M133. It emits `FileSystemChangeRecord` entries, but is restricted to
     desktop Chromium, requires explicit user gestures and permission re-grants
     across sessions, and **deliberately does not expose disk paths**
     (`File.prototype.path` does not exist). It cannot write to `dirs.json` and
     cannot replace the daemon's native binding.

4. **Cross-system authority & exposure model**:
   - The existing model serves a canvas's files locally from the home daemon to
     loopback peers.
   - Remote cross-system access is a deliberate security exposure: it requires
     explicit authenticated read/write capability grants, strict path jail
     enforcement (preventing symlink and `..` directory escapes), edit conflict
     reconciliation, and data minimization.

5. **Track D $\leftrightarrow$ Track E Interlock (Content Identity)**:
   - Diffs and transportable compute (Track E, `isocan-54k`) require stable,
     immutable content identities.
   - Canvas item versions have immutable identity today (`blobHash`).
   - Files residing in a granted filesystem directory do not have durable
     identities until Track D watches them, hashes changes, and commits version
     pre-images. Cross-project file diffing depends strictly on Track D.

---

## 3. What is owed

The full docset (journey, design, phases) and implementation when this deferred
backlog track is activated by the coordinator. Nothing is built.
