---
name: isocan-collab
description: Collaborate on an isocan canvas as a visible agent — address comments, build/edit items, and run the wait-driven feedback loop via the isocan CLI. Use when asked to work on a canvas, address canvas comments, "park" and wait for feedback, or run a canvas session. Triggers on "isocan", "canvas comments", "park on the canvas", "address my comments".
---

# Collaborating on an isocan canvas

isocan is an infinite shared canvas. A local daemon owns the state; the web
app (which the human watches) and the `isocan` CLI (you) are equal clients —
every operation you run appears on their screen live, and your presence
renders as a named cursor. `isocan --help` is the full reference and is
written for you; read it once per session.

## Orient (once per session)

```sh
isocan status                  # daemon auto-starts on any command if down
isocan whoami                  # identity must be YOURS (e.g. "Claude"), not the user's
isocan identity --name "Claude"   # only if unset or wrong
isocan project list            # find the canvas; then either:
isocan use <project>           #   set default, or pass --project <ref> per command
```

Conventions: `<item>`/`<thread>` args accept id, id prefix, or title prefix.
Coordinates are world units (+x right, +y down). Add `--json` to any command
when you need to parse output.

## The session protocol

1. **Appear.** `isocan session start --label "Claude 🤖"`
2. **Read.** `isocan comment list` — a comment needs addressing when the last
   entry in its thread is not yours.
3. **Show your work — before the quiet part.** The moment you start on a task:
   `isocan session work <item> --say "what you're doing…"` (or
   `session work --at x,y --say …` when no item exists yet). Do this BEFORE
   authoring files or thinking — that's when you'd otherwise look frozen.
   Update the narration with `session say "…"` as phases change.
4. **Build.** `add` new files, `edit <item> <file>` for changes to existing
   items (each edit stacks a version — never re-add), `mv`/`set` to arrange.
   Every op you run snaps your cursor to where it happened.
5. **Close the loop on the thread.** Always `isocan comment reply <thread>
   "…"` describing what you did, where you put it, and any judgment calls.
   The reply is the deliverable's receipt. Comments render as markdown in
   the web app, so structure is welcome. Address a specific person with
   `@Name` (first names work) — mentions are resolved when you post.
6. **Park.** `isocan wait --json --timeout 3600` blocks until the next comment
   that is FOR YOU: one that @-mentions you (name or session label) or lands
   in a thread you wrote in or were mentioned in. Everything else — comments
   for others, comments mentioning nobody — is ether and won't wake you.
   Exit 2 on timeout, 0 with the feedback as JSON. Run it as a background
   task; while parked your cursor shows "waiting for your feedback…"
   automatically. On wake: go to step 3.
7. **Leave.** `isocan session end` when the collaboration is over.

## Practices that earn trust

- **Placement**: honor the comment's location. Anchored comments → work on
  that item. Freestanding comments → place results near the pin
  (`--at x,y` close to the comment's coordinates), or use
  `--anchor <item>` to sit neatly left of a related item.
- **Anchor the thread to what it produced.** When a freestanding comment
  asks for something and you build the item, run
  `isocan comment anchor <thread> <item>` so the thread pins to the result
  and follows it from then on.
- **Versions are the medium for iteration.** "Change X on this item" means
  `edit` → new version. Mention "vN on the stack — fan out (V) to compare"
  in your reply so the human knows the history is there.
- **Verify before you ship.** HTML items: test logic headlessly (extract the
  script, run in node with DOM stubs). Risky renders: upload the blob alone
  (`POST /api/projects/<id>/blobs`) and eyeball it in a browser before
  creating the version — orphaned preview blobs are GC'd later. Note:
  cursor ANIMATION cannot be verified from a background/automation tab
  (Chrome throttles rAF when hidden); verify static layout only.
- **External content**: prefer cleanly-licensed sources (Wikimedia Commons);
  put attribution in the item title or reply. Say what you skipped and why.
- **Scope discipline**: comments are the user's instructions — but confirm on
  the thread before anything destructive (deleting items, emptying trash) or
  far outside the comment's ask.
- **Undo is per-actor**: your `isocan undo` only reverts your own ops.
- **If you hit a product bug**, stop the session work and tell the user —
  fixing the tool comes before continuing the choreography.

## Quick reference of the whole surface

`isocan --help` covers everything; the commands you'll live in:
`comment list|add|reply|anchor`, `session start|work|say|point|end`, `who`,
`add`, `edit`, `mv`, `set`, `ls`, `show`, `versions`, `version promote`,
`rm`/`restore`/`trash`, `undo`/`redo`, `wait`, `tail -f`, `gc`.
