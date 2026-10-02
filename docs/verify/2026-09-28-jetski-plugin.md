---
status: works
since: 2026-09-29
never: The host integration required an actual Jetski session; it was walked on 29 September.
needs: Jetski, Node, the isocan CLI and a signed-in harness for steps that run a model.
---

# The isocan plugin, inside Jetski

**Status: `works` (walked 2026-09-29 in Jetski).**

**What you need:** Jetski on a machine with `node` and the `isocan` CLI on its
PATH (`npm i -g github:dglazkov/isocan#release`, or this repo's own
`packages/cli/bin/isocan.js` on the PATH), and a throwaway folder. Fifteen
minutes; steps 8–9 also need a harness signed in (Claude Code, Codex, or the
`jetski` ACP adapter) and spend a few tokens.

**Why this page exists.** Everything below has automated proof up to the
host's edge: the hook runs from a symlinked install exactly as `hooks.json`
says, the pane's routes run against the real CLI's shapes, and the pane was
walked in headless Chrome against a real daemon (`scripts/journey-jetski-pane.mjs`).
What no machine here can do is be Jetski: load the plugin, run the hook at
the start of a real conversation, serve the pane through its Sidecar SDK in
the AuxPane, and carry *Send to chat* into the chat. Walked end to end on
29 Sep 2026 inside real Jetski: `SessionStart` injected `EPHEMERAL_MESSAGE`
and named the conversation on its bound canvas, the AuxPane framed the canvas
chat-free with selection chips and `/skill` menu, `/isocan` and `/fan-out`
worked from chat, `isocan ask` surfaced **Asks 1** in `/api/asks`, a canvas
reply mentioning `@<name>` was delivered into the live Jetski conversation by
the sidecar relay (`~/.isocan/jetski-relay.lock`), and `rc add --model flash`
+ `rc turn` ran a real model-pinned turn through the `jetski` ACP adapter
(`-model {model}`).

---

## Part one: install, and a conversation arrives

1. Run `isocan setup --jetski` (or `node scripts/install-jetski-plugin.mjs`
   from a checkout). **Then quit and reopen Jetski** — it reads a plugin's
   `hooks.json` and rule once, when the plugin loads, and an old copy keeps
   running until then.

   **You should see:** `~/.gemini/config/plugins/isocan` is a link to the
   installed `plugins/jetski`, and *Isocan Canvas* appears among Jetski's
   plugins.

2. Make a throwaway folder, bind it, and open it in Jetski:
   `mkdir ~/acme-jetski && cd ~/acme-jetski && isocan canvas new "Acme Jetski" && isocan use "Acme Jetski"`.
   Start a **new** conversation in it and say anything.

   **You should see:** the agent knows it is on the canvas *Acme Jetski*
   before you mention it — the hook's message told it — and it offers an
   **Isocan Canvas** link.

3. Ask the agent to run `isocan whoami`.

   **You should see:** a name that is **not yours**, marked as this agent
   session. If it says your own name, the hook did not run (step 1's restart
   is the usual cause), or it ran before the conversation had a session.

4. Start a new conversation in a folder with **no** `.isocan/project.json`.

   **You should see:** nothing about isocan at all — no message, no name.

## Part two: the pane

5. In the step-2 conversation, click the **Isocan Canvas** link.

   **You should see:** the pane opens beside the chat with the canvas in it,
   the rail's Agents door (✦) on the left, and **no Chat column and no Chat
   button** anywhere in it. The agent from step 3 is among the faces top
   right.

6. Ask the agent to add a note to the canvas (*"put a note on the canvas
   saying hello"*).

   **You should see:** the note appear in the pane while the agent works,
   attributed to the agent's name, not yours.

7. Click the note in the pane, type a question in the box that appears under
   the pane's header, and press **Ask**.

   **You should see:** a chip naming the note when you select it, and your
   question arrive in the conversation with the note's id and title after it.
   The agent can answer about that note without being told which one.

8. With `isocan rc` running in a terminal on this machine, open the pane's
   **Agents** bar and press **+ Orla · Opus 5.5** (or whichever preset your
   harnesses can run — a disabled one says why on hover, and ⚠ means its
   harness cannot take the model).

   **You should see:** *Orla is enrolled on this canvas*, and Orla among the
   canvas's agents. `@Orla` in a canvas comment gets an answer.

9. Check that the pin was real: the harness's own session record names the
   model it ran (for Claude Code, the assistant messages in its session file
   under `~/.claude/projects/` carry `"model"`).

   **You should see:** the preset's model id, not the harness's default.


## Part three: the tie (phase 4, added 29 Sep)

Restart Jetski first — the hook's message and the rule changed.

10. Open the pane on the step-2 canvas with nothing selected.

    **You should see:** the box under the header saying *Ask Jetski about the
    canvas, or / for a skill…*, and starters under it — *What's on this
    canvas?*, *Put what we did here on the canvas*, a couple of `/skills`, and
    `/ N skills`. Your own face in the Agents bar says *this chat*.

11. Type `/` in the box, take `/variation` with ↓ and Enter, add *n=2*, select
    the note from step 6, and press **Ask**.

    **You should see:** the conversation receive `/variation n=2` with a line
    saying `isocan command show variation` is its instructions, and two
    variations appear on the canvas, made by the agent.

12. In a **browser tab** on the same canvas (not the pane), comment on the
    note mentioning the agent by the name from step 3: *"@<name> make it
    shorter"*. Leave Jetski alone.

    **You should see:** within a few seconds, a message in the Jetski
    conversation headed *The isocan canvas … has something for you*, with
    your comment in it — and the agent's reply appearing on your thread in the
    tab. This is the relay; `~/.isocan/jetski-relay.lock` exists while it runs.

13. Select the note, set the target menu to **Fan out: Flash + Pro**, type
    *make a friendlier version*, and press **Fan out**.

    **You should see:** two new conversations in Jetski titled *make a
    friendlier version · flash* and *… · pro*, each arriving on the canvas
    under its own name with its tier in the Agents bar, and a 💬 beside each
    that opens it.

14. Ask the agent to `isocan ask "amber or teal?"` on the canvas.

    **You should see:** **Asks 1** in the pane's header; *Answer with Jetski*
    hands the question back to the conversation.

---

## What to do when it is wrong

- **Step 2 or 3 fails:** run the hook by hand from the plugin directory —
  `cd ~/.gemini/config/plugins/isocan && echo '{"conversationId":"acme-test","workspacePaths":["'"$HOME"'/acme-jetski"]}' | node scripts/session-start.mjs`
  — and note what it prints. Nothing printed means it did not find the
  binding; a message saying *Naming you failed* carries the CLI's own reason.
- **Step 5 shows a blank frame:** the pane's header says why when the daemon
  is loopback and the browser is elsewhere (Jetski Web on another machine).
  Otherwise press **Reload** — a pass is single-use, and a local daemon's
  frame cannot keep its badge across reloads.
- **Step 12 never arrives:** check `~/.isocan/jetski-conversations.json` has
  the conversation with an `actorId` (the hook writes it), and that
  `ISOCAN_JETSKI_RELAY` is not `off`. If the agent parked itself on
  `isocan wait`, its own park wins and the relay stands back five minutes.
- **A Chat appears in step 5:** that is a bug; `embed-chat.test.ts` names the
  entrances it guards. Note what opened it.

## What this walk does not cover

Subagent conversations run the same hook and also join; that is by design and
not walked here. Jetski Web against a canvas on isocan.io is the same pane
with a remote frame — worth a run on its own when someone has it.
