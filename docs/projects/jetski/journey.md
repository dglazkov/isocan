---
status: partial
since: 2026-09-28
issue: 364
see: embed, harnesses, bench, design-competition
note: all four phases built 28 Sep 2026; phase 0 closed, phases 1–3 part-done, each waiting on one walk only a person can do. `isocan embed` frames a canvas chat-free (`?embed=1`, every Chat entrance closed) and a framed canvas tells its pane what is selected, only after the pane says hello; `--model` pins a standing agent's model through the doors its harness really has; `plugins/jetski/` is the plugin — a SessionStart hook that names a new conversation and puts it on the workspace's canvas, and the Isocan Canvas pane with an Agents bar of model-pinned presets. Owed: a summoned turn on a pinned model, and the hook and the pane inside real Jetski.
---

# Jetski — the journey

Asked for by Dion on 28 September 2026: *package isocan as a plugin for
Jetski — open a pane with isocan running on the same project that is open in
Jetski (locally or mapped to a canvas on isocan.io), have all the skills and
tools loaded, hide the chat inside isocan since driving happens in the Jetski
chat, fire off a session where Jetski joins the canvas, and provide a way to
fire off multiple agents with models (Opus 5.5, Barium, Gemini) so they are
available on the canvas.*

These scenes are the acceptance suite. [design.md](design.md) is the mechanism
and [phases.md](phases.md) is the walk.

## 1. Opening a repo opens its canvas, without a second chat column

Dion opens `~/code/acme` in Jetski. The `isocan` plugin is installed, and
`~/code/acme/.isocan/project.json` binds the repo to a canvas. When he starts
a conversation, the agent already knows which canvas this is and offers an
**[Isocan Canvas](sidecar://isocan/canvas/)** link.

Clicking it opens the pane beside the chat. Jetski's conversation is already
the column Dion talks in, so the canvas opens **with no Chat dock and no Chat
button** — not on the rail, not behind ⌘J, not in the palette — and every
pixel of the pane goes to the canvas and the faces of who is on it. Opening a
folder with no canvas yet shows a card instead: bind it to an existing canvas
by its link, id or title, or create one for it.

**What the scene forces:** `?embed=1` in `@isocan/core` and `@isocan/web`
closing every entrance to the Chat while keeping the Agents door and the
faces; `isocan embed` writing `?embed=1` by default (with `--chat` to opt
back in); a pane that follows the conversation's workspace, mints a fresh
address per load, and binds an unbound folder.

## 2. The Jetski conversation is already on the canvas

Before Dion types a word, the canvas shows the conversation's face — under
its own name, not his. The agent has the `isocan mcp` tools and the
`isocan-collab` skill from the plugin, and the hook's message told it where
it is, what it is called, and to read `isocan --agent-help` before acting on
the canvas. When Dion asks in the chat to *"sketch three onboarding cards"*,
the agent builds them on the canvas, and they appear in the pane, attributed
to it.

**What the scene forces:** a `SessionStart` hook that names the conversation
(`isocan identity --session`, keyed to `ANTIGRAVITY_CONVERSATION_ID`), starts
its presence, and says so in one ephemeral message; silence in a folder that
is not bound; `mcp_config.json` and the skill in the plugin.

## 3. Pointing at the canvas speaks to Jetski chat

Dion clicks two screens on the canvas in the pane, *Acme sign-in* and *Acme
verify code*. Chips naming them appear under the pane's header, beside a box
that says *Ask Jetski about this…*. He types *"which of these is closer to
the brief?"* and presses **Ask**: the question arrives in the conversation
with the two items' ids and titles after it, and the agent answers about
exactly those two. Clicking a chip brings its item back into view.

**What the scene forces:** a selection bridge in `CanvasPage.tsx` when framed
that talks only to the pane that answered it, and a pane that hands a
question to the conversation through `window.sidecar.agent.sendMessage`.

## 4. A bench of models — Opus 5.5, Barium, Gemini Pro

Dion wants to see how **Opus 5.5**, **Barium** and **Gemini Pro** each
interpret the same brief. From the pane's **Agents** bar — or from the
terminal, `isocan rc add Orla --harness claude-code --model claude-opus-5-5`
— he enrols standing agents with agents' names, each pinned to a model. Each
row in `rc-agents.json` and on his bench carries its `model`, and `adapterFor`
hands it to the harness through the door that harness has; a preset whose
harness has no such door says so before he compares anything. Then he asks
the conversation to run a visual arena on the brief: the plugin's
`visual-arena` agent asks each pinned agent for a variant, and their screens
land side by side on the canvas, each labelled with the model it really ran.

**What the scene forces:** `--model <id>` on `isocan rc add`, `isocan agent
add` and `isocan bench add`; `model` on `RcAgentRow` and `BenchAgent`;
`adapterFor` reaching a harness only through a door it has, and
`isocan harness` saying which; and the pane's Agents bar.
