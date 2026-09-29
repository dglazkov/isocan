---
name: fan-out
description: >-
  Fan out a canvas question or canvas /skill across multiple model tiers
  (flash + pro by default, or flash_lite, flash, and pro) in parallel Jetski
  conversations that each join the bound isocan canvas under their own name and
  place their takes side by side. Triggered by /fan-out or when the person asks
  to fan out a canvas task across models.
---

# Fan Out Across Model Tiers (`/fan-out`)

Use this skill when the person types `/fan-out …` in chat (or asks to fan a
canvas prompt or skill out across model tiers). It runs the exact same
`/api/fanout` path as the **Isocan Canvas** pane's **Fan out** button, so each
tier starts as a real Jetski conversation in this project, joins the canvas
under its own name, and shows its tier badge (`· flash`, `· pro`, `· flash_lite`)
and `💬` link in the pane's **Agents** bar.

## Steps

1. **Determine the tiers, target items, and ask or skill:**
   - **Tiers:** Default to `["flash", "pro"]`. If the person asks for all three
     tiers (`all`, `3`, `three tiers`, or names `flash_lite`), use
     `["flash_lite", "flash", "pro"]`.
   - **Skill vs. Question:** If the request names a canvas skill (e.g.
     `/variation`, `variation`, `/design-audit`, `/accessibility-audit`,
     `/tidy`), pass `skill` (without the leading `/`) and any remaining instructions as `args`. Otherwise pass the text as `question`.
   - **Items:** If the person names specific canvas items (by `itm_…` ID or
     title), look them up with `isocan ls` if needed and pass them as
     `[{ id, title }]`.

2. **Launch the fan-out via the plugin's `/api/fanout` handler:**

   ```bash
   node --input-type=module -e '
     import os from "node:os";
     import path from "node:path";
     import { pathToFileURL } from "node:url";
     const pluginDir = process.env.ISOCAN_JETSKI_PLUGIN_DIR || path.join(os.homedir(), ".gemini", "config", "plugins", "isocan");
     const { createPane } = await import(pathToFileURL(path.join(pluginDir, "sidecars", "canvas", "main.mjs")).href);
     const { routes } = createPane();
     const out = await routes["/api/fanout"]({
       workspaceUris: [process.cwd()],
       conversationId: process.env.ANTIGRAVITY_CONVERSATION_ID ?? null,
       projectId: process.env.ANTIGRAVITY_PROJECT_ID ?? null,
       tiers: JSON.parse(process.argv[1]),
       question: process.argv[2] || undefined,
       skill: process.argv[3] || undefined,
       args: process.argv[4] || undefined,
       items: JSON.parse(process.argv[5] || "[]"),
     });
     console.log(JSON.stringify(out, null, 2));
   ' '["flash","pro"]' "<question>" "<skill>" "<args>" '[]'
   ```

3. **Reply concisely with links to each conversation and the canvas pane:**
   - List each started tier with its clickable conversation link:
     `[<tier>](conversation://<conversationId>)`
   - Include `[Isocan Canvas](sidecar://isocan/canvas/)` so the person can watch
     each conversation join the canvas and compare their results side by side.
