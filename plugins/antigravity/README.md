# Isocan Canvas for Antigravity

The [isocan](https://github.com/dglazkov/isocan) canvas bound to your
workspace, beside the Antigravity chat. Every part of it is an `isocan` CLI
command, so the plugin can do nothing the CLI cannot.

- **The pane** (`sidecars/canvas/`) opens the canvas your workspace's
  `.isocan/project.json` (or `~/.isocan/bindings.json`) names, without isocan's
  own chat column — the Antigravity chat is where you steer. An unbound folder
  can be bound to an existing canvas (by id, link or title) or to a new one.
- **Arriving** (`hooks.json`): a new conversation in a bound workspace is
  named (`isocan identity --session`) and put on the canvas, so what it
  writes is attributed to it rather than to you. `ISOCAN_ANTIGRAVITY_JOIN=off` in
  Antigravity's environment keeps the note and skips the joining.
- **The relay** (`lib/relay.mjs`): while the pane runs, an @mention of a
  conversation on the canvas (or a reply in its thread) is relayed into that
  conversation, which answers on the canvas. `ISOCAN_ANTIGRAVITY_RELAY=off`
  switches it off.
- **The rest**: the `isocan` (`/isocan` opens the pane pill) and `isocan-collab`
  skills, a rule for bound workspaces, the `canvas-builder` and `visual-arena`
  agents, and the `isocan mcp` server.

## Install

It needs the `isocan` CLI (`npm i -g github:dglazkov/isocan#release`) and
`node` on Antigravity's PATH. The `#release` install carries `plugins/antigravity/`
alongside the CLI, so no clone of the repository is needed:

```sh
isocan setup --antigravity
```

(From a checkout of the repo, `node scripts/install-antigravity-plugin.mjs` does the
same thing, and `--uninstall` removes the link.) That links
`~/.gemini/config/plugins/isocan` to the installed `plugins/antigravity/`
directory. Restart Antigravity after installing, and after any change to
`hooks.json` — Antigravity reads it once, when the plugin loads.

## Limits

- A canvas on this machine's own daemon (`http://127.0.0.1:…`) can only be
  shown by a browser on this machine. In Antigravity Web from anywhere else, bind
  the folder to a canvas on a shared home such as isocan.io.
- Every new conversation in a bound workspace joins the canvas — subagent
  conversations run the same hook.

`docs/projects/antigravity/` in the repo has the design.
