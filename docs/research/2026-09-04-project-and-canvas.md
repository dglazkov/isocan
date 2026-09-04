---
status: designed
since: 2026-09-04
issue: 135
see: switcher, roles, multiuser
note: designed 4 Sep — one word each: a CANVAS is the surface, a PROJECT is the directory that holds it (one today, several later), a SPACE is an access grouping. Counted 325 "project" against 4,690 "canvas" in source; every survivor is inventoried and sorted into keep (the wire, the marker), rename (code that names the surface), and reword (help text, README). Nothing renamed yet
---
# Project and canvas: one word each

**4 September 2026.** Asked as: *make sure we are consistent naming project
and canvas — a canvas exists in a project, and in the future maybe we have
multiple canvases.* This note measures where each word is used today, says
what each should mean, and lists every place that has to change, sorted by
what changing it costs.

## What was counted

Across `packages/*/src` on 4 September:

| Word | Occurrences | Where |
| --- | --- | --- |
| `canvas` | 4,690 | everywhere a person or an agent reads: the CLI's verbs (`isocan canvas list`), the guide (257 mentions), the README (114), every panel and dialog |
| `project` | 325 | almost all of it in three durable spellings and a handful of code names, listed below |

The product's word is **canvas**, and has been since the address question was
settled on 23 August (`address.ts`: keep `/p/`, correct the docs). Nobody
using isocan meets "project" except in `.isocan/project.json` and the phrase
"a project directory". So the inconsistency is not in what people read; it
is between what they read and what the code calls the same thing — and that
gap is about to matter, because the user's model is the right one and the
code half-has it.

## What each word should mean

- **Canvas.** The surface: items, threads, a viewport, presence, an oplog.
  The thing you are ON, the thing you switch between, the thing an agent is
  enrolled on. `--canvas <ref>` on every CLI verb.
- **Project.** The container: a directory (or repository) bound to a home,
  holding canvases. Today exactly one, which is why #60 could say *isocan
  project == directory/repo* and why the marker is `.isocan/project.json`.
  Tomorrow several — a design system and the four screens that use it, a
  sprint's scratch canvas beside its board — sharing one directory, one
  home and one set of agents.
- **Space.** An access grouping across projects (roles phase 4): a named set
  of canvases a group is let into. Not a container — a canvas is in exactly
  one project and any number of spaces. The two must not be merged: a space
  is who may enter, a project is where the files are.

The rule that follows: **"canvas" in every sentence a person or agent reads,
unless the sentence is about the directory.** "Project" in code only where
the thing named really is the container.

## Where "project" survives, and what to do with each

### Keep: the wire and the marker (they are the container, or they are durable)

| Where | Why it stays |
| --- | --- |
| `project.create` / `project.update` / `project.delete` (the ops) | An oplog replays forever; renaming an op type is a migration that buys nothing. And under the model above they are RIGHT: `project.create` makes the container, which makes its one canvas; `project.update` renames the container, whose title the canvas wears while there is one. When a second canvas arrives, the canvas gets its own record and these ops keep their meaning |
| `GET /api/projects`, `/api/projects/:id/…` | Same: durable, and the resource is the container. A canvas-level route grows underneath when there is more than one canvas |
| `/p/<id>` | Settled 23 Aug. Named for the project, which is what makes `/p/<project>/<canvas>` read right later without moving anybody's links |
| `.isocan/project.json` | Literally the container's marker: a directory is a project |
| `defaultProjectId` in the home's config | A stored key at every home; leave it, and read it as "the default project", which it is |

### Rename: code that calls the surface a project

| Where | To | Cost |
| --- | --- | --- |
| `useCanvasStore.project` (web) — the canvas's record beside `canvas` (its items) | `meta`, or `record`; the type is already `Canvas` | one store field, 17 readers |
| `CanvasListPage`'s `setProjects` | `setCanvases` | one line |
| `--project <ref>` (hidden alias of `--canvas`) | keep as the hidden alias — it costs nothing and old scripts use it | none |
| `core/model.ts`: `Canvas` is the RECORD (id, title, description) and `CanvasState` is the surface | leave the names, add the glossary comment: when a project record exists, `Canvas` splits into `Project` (title, description, directory) and `Canvas` (the surface's record) | a comment now, a type later |

### Reword: prose that says project where it means canvas

| Where | Now | Should say |
| --- | --- | --- |
| `isocan` help: *"Run this in a project directory"* | ambiguous — the directory IS the project, so this one is right; keep | — |
| README, "Starting a *new* project": *"an empty directory, a GitHub repo, a canvas"* | right by the model above (a project is the directory); keep, and say so once | add the glossary sentence |
| `docs/architecture.md` | has no glossary | the three definitions above, in one paragraph, near the top |
| the agent guide (8 mentions) | each is about the directory; keep | — |

Most of the prose is already right, which is the finding: the word was
chosen well and used carelessly only in code.

## What multiple canvases would need (so nothing built now fights it)

1. A project record: id, title, description, the directory binding, the
   home, `canvasIds` in order. `project.*` ops move to it unchanged.
2. A canvas record: id, projectId, title. `canvas.create` / `canvas.update` /
   `canvas.delete` as the new ops — the only new vocabulary.
3. The address: `/p/<project>` opens the project's first (or last-visited)
   canvas; `/p/<project>/<canvas>` names one. `canvasPath()` in `address.ts`
   is already the one spelling, so the change is one function.
4. The marker: `.isocan/project.json` gains `canvases` beside its `canvasId`;
   a marker without it means one canvas, as every marker does today.
5. The switcher's row becomes `Project › Canvas`, matched on both
   (`switcher/design.md`, phase 5). The home screen groups by project the way
   it groups by space now. `isocan canvas list` prints the project column.
6. Agents: an enrolment is per canvas (standing agents), and a project-wide
   enrolment is a convenience over it — "on every canvas in this project" —
   not a new kind of standing.

None of this is asked for yet. It is here so the renames above are made in
the direction the model is going, and so the wire is not touched twice.

## The walk

1. **The glossary**, in `architecture.md`, and a sentence in the README's
   "new project" section. Words only.
2. **The code renames** that call the surface a project: the store field,
   the list page's setter. No wire change, no behaviour change; a test that
   greps the web app's user-facing strings for "project" outside an allowlist
   (the marker, the directory sentence) so the word cannot creep back.
3. **The type split**, when a project record is wanted: `Project` and
   `Canvas` in `model.ts`, the three `canvas.*` ops, the address segment.
   That is the multi-canvas project and it is a project of its own, not this
   note.
