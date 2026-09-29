---
name: isocan
description: >-
  Open or toggle the Isocan Canvas sidecar pane ([Isocan Canvas](sidecar://isocan/canvas/))
  from chat, or run a quick canvas action while surfacing the pane pill. Triggered
  by /isocan or when the person asks to open the isocan canvas pane.
---

# Open the Isocan Canvas (`/isocan`)

Use this skill when the person types `/isocan` in chat or asks to open/show the
Isocan Canvas pane.

## Behavior

1. **Bare `/isocan` (or `/isocan open`, `/isocan show`, `/isocan pane`):**
   Reply immediately with the one-click sidecar pill — do not run extra shell
   commands first:

   ```markdown
   Open the canvas beside this chat: [Isocan Canvas](sidecar://isocan/canvas/)
   ```

2. **`/isocan <question or instruction>`:**
   Include `[Isocan Canvas](sidecar://isocan/canvas/)` in your reply and carry
   out the canvas request using the `isocan` CLI (if `<question or instruction>`
   starts with a canvas `/skill`, run `isocan command show <name>` and follow
   its instructions on the canvas).
