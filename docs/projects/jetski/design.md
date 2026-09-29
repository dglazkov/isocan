# Jetski — the mechanism

This document discharges the mechanisms [journey.md](journey.md)'s four scenes
force: the canvas beside the Jetski chat without a second chat column, the
conversation already on the canvas under its own name, pointing at the canvas
speaking to the chat, and a bench of model-pinned agents. It continues
[embed](../embed/phases.md), which made `isocan embed` the address for a pane,
and [harnesses](../harnesses/journey.md), which left "choosing a model per
agent" unbuilt.

## 1. A plugin, not a per-IDE fork

[Embed phase 4](../embed/phases.md) retired per-IDE extensions: a codebase per
editor is a second client that drifts from the CLI. A Jetski plugin is a
directory of declarations — a manifest, an MCP server entry, one hook, a rule,
two agents, a doorway to the one skill, and a sidecar pane — and every act in
it is an `isocan` command. The pane can do nothing the CLI cannot.

The two scripts share `plugins/jetski/lib/workspace.mjs`: plain ESM with no
dependencies, because it runs under whatever Node Jetski provides, from a
plugin directory that is usually a symlink into this repo. Where it mirrors
TypeScript it cannot import — `findBinding` from `packages/server`, the
harness session variables from `packages/api` — `test/jetski-plugin.test.ts`
runs both on the same inputs.

## 2. `?embed=1`: one switch, read once

**One spelling.** `embedCanvasUrl(origin, canvasId, token, { chat })` in
`@isocan/core` writes `<origin>/p/<id>?embed=1#<pass>`, plus `&chat=on` when
the caller keeps the Chat. `isEmbedded(search)` is exactly `embed=1`;
`isEmbeddedChatHidden(search)` is that without `chat=on`. There are no
synonyms: a reader that accepts spellings no writer writes is a second
vocabulary to keep in step. `isocan embed` writes the chat-free address by
default and `--chat` keeps the dock. Its `--json` `canvas` is where an
admitted frame goes back to, so it keeps `?embed=1`; a tab wants the switch
off as well, which is why the pane derives its own `tab` address (§6).

**Read once.** `packages/web/src/lib/panels.ts` latches the query string the
window was loaded with (`searchAtLoad`), and `chatHiddenNow()` and
`embeddedNow()` read the latch. The app's own navigation (`/i/<item>`, `/w`)
drops the query, and neither the Chat nor a quiet bridge may come back the
moment somebody opens an item inside the pane.

**Every way in is closed, not only the dock.** A hidden dock with a live ⌘J is
a key that closes whatever else is open on its way to nothing. So each
entrance asks `chatHiddenNow()`: the dock (`MainThreadPanel`), the rail
button (`RailStrip`), ⌘J (`CanvasPage`), the palette's *Open Chat* and its
slash-command rows, since choosing one opens the Chat with it typed
(`actions.ts`, `CommandPalette.tsx`), the chrome menu's Chat row
(`menuentries.tsx`), and the module workspace's Chat button
(`ModuleWorkspace.tsx`). `openPanel(…, "main")` folds to a closed dock and
stores nothing: nobody chose "closed", and a stored choice would outlive the
pane in any browser that does not partition a frame's storage. The forcing
function is `packages/web/test/embed-chat.test.ts`, *"leaves no way in to a
Chat that is not there"*: a source file outside `panels.ts` that can open the
Chat and never asks `chatHiddenNow()` fails it. The rail's Agents door and the
faces stay — who is on the canvas is not the host's to replace.

`HIDEABLE` (`?hide=`) was not the door for this: every entry there must be a
display switch in `DISPLAY_SWITCHES` (`hideable.test.ts`), and hiding the
Chat's surfaces is not the same act as closing its entrances.

## 3. The host bridge

`packages/web/src/lib/hostbridge.ts`, installed by `CanvasPage` and inert
unless the page was opened with `?embed=1` and really is framed. Three
messages, and the order is the security:

1. The canvas posts `{ type: "isocan:ready", canvasId }` to its parent at `"*"`
   — nothing a framer did not already put in the address.
2. The parent answers `{ type: "isocan:hello" }`. The origin that hello came
   from is the only origin the canvas ever posts to. Until one arrives
   nothing is posted, and a parent whose origin is `"null"` is told nothing.
3. From then on each selection change posts `{ type: "isocan:selection",
   canvasId, items: [{ id, title, groupId }] }` to that origin, and
   `{ type: "isocan:focus-item", itemId }` is obeyed only from that parent at
   that origin, and only for an item on this canvas.

The pane's half believes a message only when it comes from its own frame's
window, from the origin the pass was minted at, about the canvas it framed.

## 4. Model-pinned agents (`--model`)

`RcAgentRow` (`packages/rc/src/rows.ts`) and `BenchAgent`
(`packages/core/src/bench.ts`, a `model` property and a `- model:` line in
`agent.md`) carry an optional `model`. `isocan agent add`, `isocan rc add`
and `isocan bench add` take `--model <id>`, spelled the way the harness spells
it, and `agent add` gained `--harness` so an agent can enrol a specialist on
a harness other than its own.

`adapterFor(home, harness, env, model)` (`packages/cli/src/harnesses.ts`)
always lays the id on `ISOCAN_MODEL`, and hands it to the harness itself only
through a door that harness is known to have:

- Claude Code: `ANTHROPIC_MODEL` (`HARNESS_MODEL_ENV`);
- Codex: `model` merged into its bridge's `CODEX_CONFIG` overrides
  (`codexModelConfig`);
- a declared `acpAdapters` entry: `{model}` substituted in its arguments
  (`modelArgs`). With no model pinned, an argument naming `{model}` is left
  out, and so is a flag just before a bare `{model}`.

Anything else runs its own default whatever the row says. A guessed variable
name would be a pin that silently does nothing, so none are guessed, and
`isocan harness` says which harnesses a pin reaches (`model: pins|own`;
`pinsModel` in `--json`). Two agents compared as "pinned" had better both be.

## 5. Arriving: the SessionStart hook

`hooks.json` wires one event, `SessionStart`, to
`scripts/session-start.mjs`. What the host does, as found rather than as
documented:

- It runs the command with `sh -c`, the plugin directory as the cwd, and a
  flat JSON object on stdin (`conversationId`, `workspacePaths`, …).
- It parses stdout strictly: `{"injectSteps":[{"ephemeralMessage":"…"}]}` or
  nothing at all.
- It reads `hooks.json` once, when the plugin loads. A changed hook takes a
  Jetski restart, and until then the old wiring runs.

The command is guarded — `if command -v node …; then exec node …; fi` — so a
machine without `node` on Jetski's PATH gets silence rather than an error in
every conversation. The script finds the canvas only from `workspacePaths`,
taking absolute paths and `file:` URIs and dropping anything relative: read
against the cwd, a relative path would be the plugin's own directory, inside
a repository that is itself bound. Outside a bound folder it prints nothing.

Inside one it does what the agent guide says an arriving agent does —
`isocan identity --session`, then `isocan session start --label "<name> 🤖"` —
as the conversation (`agentEnv`: the person's environment with every harness
variable removed and `ANTIGRAVITY_CONVERSATION_ID` put back, the one Jetski
exports into that conversation's shell), and says in one ephemeral message
where it is, what it is called, and that `[Isocan Canvas](sidecar://isocan/canvas/)`
opens the pane. Naming and presence fail separately and are reported
separately: an agent that could not be named is not put on the canvas, and
one that was named but not made present is told its name anyway.
`ISOCAN_JETSKI_JOIN=off` keeps the message and skips the joining. The exit
code is always 0.

**The `invocationNum` guard.** An early version also wired `PreInvocation`,
which fires before every model call, not once. A Jetski still holding that
cached `hooks.json` would run the script per turn, and it did: a
conversation claimed an identity and started presence on the canvas bound to
this very repository without anybody asking. `SessionStart`'s input never
carries `invocationNum`, so the script now returns nothing for any call that
does.

## 6. The pane: `sidecars/canvas/`

`sidecar.json` runs `node main.mjs` with the AuxPane entrypoint. Under Jetski
(`ANTIGRAVITY_LS_ADDRESS` and `ANTIGRAVITY_SIDECAR_WEB_PORT` set) the routes
ride the host's Sidecar SDK, which serves `/preload.js` and enforces the UI
token on every non-GET call. Anywhere else, the same route table is served by
a plain loopback server that keeps the token rule (`PORT`, and
`?workspace=<folder>` on the page for the folder; a `?token=` on the page is
forwarded as the SDK would). Every route is one or two CLI commands, run as
the **person** (`personEnv`: every harness session variable and
`ISOCAN_CANVAS` removed), in the folder the host named:

| Route | Runs | Returns |
|---|---|---|
| `/api/workspace` | reads the marker; `isocan harness` (cached 60s) | folder, canvas, the Agents bar as it would really run here |
| `/api/embed` | `isocan embed` | the frame's address, a plain `tab` address for *Open ↗*, the expiry, whether the daemon is loopback |
| `/api/bind` | `isocan canvas new` if nothing named, then `isocan use` | the new state; refuses a folder already bound |
| `/api/model-agent` | `isocan rc add <name> --harness … --model …` | the enrolled agent |

A pass is single-use and a local daemon's frame cannot keep a badge across
reloads, so the page mints a fresh address per load (*Reload* does the same).
A loopback daemon framed from another machine — Jetski Web on a laptop, the
daemon on a workstation — cannot load, and the pane says so instead of
showing a blank frame. Selected items appear as chips; a chip points the
canvas at its item (`isocan:focus-item`), and *Ask* sends the typed question
with the items' ids and titles to the conversation through
`window.sidecar.agent.sendMessage`.

The Agents bar's buttons come from `presets.json` beside `main.mjs` (or the
file `ISOCAN_JETSKI_PRESETS` names). Each is a standing agent — an agent's
name, never a model's or a vendor's — with a harness (null: this machine's
default) and a model id. A button whose harness has no door for its model is
marked ⚠ and says so on hover, and one whose harness cannot run here is
disabled with the reason. The shipped model ids are the harnesses' spellings
as best known on 28 Sep 2026; nothing here can check them, and a wrong one
fails when the agent is first summoned, not when it is enrolled.

## 7. Whose name each part speaks in

- The **hook** speaks as the conversation, so what the Jetski agent writes on
  the canvas is attributed to it, not to the person.
- The **pane** speaks as the person: minting a pass, binding a folder and
  enrolling an agent are the person's acts.
- The **MCP server** (`isocan mcp`) speaks as the person unless a call carries
  a `session`. The CLI in the conversation's own shell resolves the
  conversation; a bare MCP call does not. The plugin's rule tells the agent
  to prefer the CLI for writes.

## 8. Limits, on purpose or for now

- A canvas on this machine's own daemon can only be framed by a browser on
  this machine; from Jetski Web elsewhere, bind the folder to a canvas on a
  shared home such as isocan.io.
- Every new conversation in a bound workspace joins, subagent conversations
  included — they run the same hook.
- The hook and the pane need `node` on Jetski's PATH; the MCP server needs
  `isocan`.
- The pane offers no slash commands: they post into the canvas Chat, which is
  not there.
- The walk that only a person can do — Jetski's own SDK, the AuxPane, the hook
  message in a real conversation — is
  [`docs/verify/2026-09-28-jetski-plugin.md`](../../verify/2026-09-28-jetski-plugin.md).
