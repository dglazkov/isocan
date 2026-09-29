---
status: built
since: 2026-09-29
issue: 364
see: embed, harnesses, bench, design-competition
note: all five phases (0–4) built and closed 28–29 Sep 2026, walked inside real Jetski. `isocan embed` frames a canvas chat-free (`?embed=1`, every Chat entrance closed) and speaks the selection bridge; `--model` pins a standing agent's model through the doors its harness has (`ANTHROPIC_MODEL`, `CODEX_CONFIG`, `{model}` in `acpAdapters`); `plugins/jetski/` ships the SessionStart hook, the Isocan Canvas AuxPane with `/skill` menu, selection composer, model-pinned Agents bar, open-asks inbox, fan-out across Jetski tiers, `/isocan` and `/fan-out` chat skills, and the live canvas-to-chat relay.
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

---

*Added 29 September 2026, when Dion asked for the tie to be a killer one:
"how can we teach the Jetski side what the user can do? how can we surface
how skills work across both?" Scenes 1–4 put the two windows side by side.
These four make them one place.*

## 5. The pane teaches by offering

Dion opens the pane on a canvas he has never used from Jetski. Before he has
selected anything, the box under the header says *Ask Jetski about the
canvas, or / for a skill…*, and under it sit a few starters: *What's on this
canvas?*, *Answer 1 open question*, *Put what we did here on the canvas*,
`/tidy`, and `/ 7 skills`. He clicks *Acme sign-in* on the canvas and the
starters change under him: *Build this in the repo*, `/variation`,
`/design-audit`, `/accessibility-audit`, *What's wrong with it?*. Nothing is
sent until he presses the button — a starter only fills the box — so reading
them costs nothing, and after a week he types them himself.

**What the scene forces:** a composer that is there before a selection is;
starters that come from the canvas's own state (its skills, what is waiting,
what is selected) rather than a fixed list; and the two cross-world acts
named as plainly as the canvas's own — *build this in the repo* and *put
this on the canvas*.

## 6. One skill, two worlds

Dion types `/` and the canvas's skills drop down — the built-ins and
`/acme-brand`, which Mara added to the canvas last week with `/skill add`,
marked with where it came from. He takes `/variation`, adds *n=2 one dark,
one playful*, and presses **Ask**. The conversation beside him receives
exactly what a canvas comment would carry — `/variation n=2 …` first — with
one sentence the canvas never needed: *`isocan command show variation` is
your instructions*. The Jetski agent runs the canvas's skill as itself, and
two screens land beside the selection.

Tomorrow he wants the same audit from Orla, the Opus agent on his bench. He
switches the box's target from *This chat* to *@Orla on the canvas* and
presses **Hand off**: the pane posts `/design-audit @Orla spacing only` as
his comment on the selected screen, the frame opens the thread, and Orla
answers there while `isocan rc` runs. The same skill, run by whoever he
points at, and the record is on the canvas either way.

**What the scene forces:** the canvas's command catalogue (`isocan command
ls`) in the pane, without the ones the web app answers itself; a skill sent
to the conversation in the canvas's own grammar; and a hand-off that is an
ordinary comment, so nothing about skills is Jetski-only.

## 7. The canvas can reach the conversation

Mara, in a browser tab on the same canvas, writes *"@Kit the header is
too tall on mobile"* on the sign-in screen. Kit is Dion's Jetski
conversation; it arrived on the canvas when he opened it (scene 2) and it is
not parked on `isocan wait`, because Dion talks to it in the chat. Until
now Mara was writing to a face with no ear. Now, while the pane runs, her
comment arrives in Dion's conversation — *"The isocan canvas "Acme" has
something for you"*, her words as `isocan wait` prints them, and *answer it
on the canvas*. The agent fixes the header and replies on Mara's thread.
Dion saw it happen; Mara never had to know it was Jetski.

When an agent on the canvas asks Dion something — Test Otter wants to know
whether the Google button goes above the email field — the header grows an
**Asks 1** button. He can *Show* it, which opens the thread in the frame, or
*Answer with Jetski*, which hands the question to his conversation to think
through together before anybody replies.

**What the scene forces:** a record of which conversation became which
actor; a relay that parks AS the conversation and hands it the wake
(`agentapi send-message`), standing back when the conversation parks itself;
and an inbox of `isocan comment ls --open`.

## 8. Faces are conversations, and tiers are a button

Dion wants to see how Jetski's own tiers read one brief. With two screens
selected he picks *Fan out: Flash + Pro* and asks *which is closer to the
brief — and make a third that is?*. Two new Jetski conversations start, each
titled with its tier and told it is one of two; each arrives on the canvas
under its own name, and the Agents bar shows them as *● Nell · Chat · flash*
and *● Rui · Chat · pro*. The takes land side by side. Clicking 💬 beside a
face opens that conversation in Jetski, so reading *why* the pro take went
the way it did is one click from the take itself.

**What the scene forces:** `agentapi new-conversation --model=<tier>
--title=…` from the pane, recorded against the canvas so a face can say its
tier; `window.sidecar.ui.toggleConversation` from a face; and faces that
know which of them is *this chat*.
