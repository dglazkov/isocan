# Isocan Canvas for Jetski

The [isocan](https://github.com/dglazkov/isocan) canvas bound to your
workspace, beside the Jetski chat. Every part of it is an `isocan` CLI
command, so the plugin can do nothing the CLI cannot.

- **The pane** (`sidecars/canvas/`) opens the canvas your workspace's
  `.isocan/project.json` names, without isocan's own chat column — the Jetski
  chat is where you steer. An unbound folder can be bound to an existing
  canvas (by id, link or title) or to a new one. Select items on the canvas
  and ask Jetski about them from the pane.
- **Arriving** (`hooks.json`): a new conversation in a bound workspace is
  named (`isocan identity --session`) and put on the canvas, so what it
  writes is attributed to it rather than to you. `ISOCAN_JETSKI_JOIN=off` in
  Jetski's environment keeps the note and skips the joining.
- **Agents**: the pane's Agents bar enrols standing agents pinned to a model
  (`isocan rc add <name> --harness … --model …`), from
  `sidecars/canvas/presets.json` — edit it, or point `ISOCAN_JETSKI_PRESETS`
  at your own. They answer @mentions while `isocan rc` runs on your machine,
  and the pane marks any whose harness cannot take the model.
- **The rest**: the `isocan-collab` skill, a rule for bound workspaces, the
  `canvas-builder` and `visual-arena` agents, and the `isocan mcp` server.

## Install

It needs the `isocan` CLI (`npm i -g github:dglazkov/isocan#release`) and
`node` on Jetski's PATH. The `#release` install carries `plugins/jetski/`
alongside the CLI, so no clone of the repository is needed:

```sh
isocan setup --jetski
```

(From a checkout of the repo, `node scripts/install-jetski-plugin.mjs` does the
same thing, and `--uninstall` removes the link.) That links
`~/.gemini/config/plugins/isocan` to the installed `plugins/jetski/`
directory. Restart Jetski after installing, and after any change to
`hooks.json` — Jetski reads it once, when the plugin loads.

## Limits

- A canvas on this machine's own daemon (`http://127.0.0.1:…`) can only be
  shown by a browser on this machine. In Jetski Web from anywhere else, bind
  the folder to a canvas on a shared home such as isocan.io.
- Every new conversation in a bound workspace joins the canvas — subagent
  conversations run the same hook.
- A preset's model id is spelled the way its harness spells it, and nothing
  here can check the spelling: a wrong id fails when the agent is first
  summoned, not when it is enrolled.

`docs/projects/jetski/` in the repo has the design.
