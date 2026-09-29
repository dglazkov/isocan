# The isocan plugin, inside Jetski

**Status: `unverified`.**

**What you need:** Jetski on a machine with `node` and the `isocan` CLI on its
PATH (`npm i -g github:dglazkov/isocan#release`, or this repo's own
`packages/cli/bin/isocan.js` on the PATH), and a throwaway folder. Fifteen
minutes; steps 8–9 also need a harness signed in (Claude Code or Codex) and
spend a few tokens.

**Why this page exists.** Everything below has automated proof up to the
host's edge: the hook runs from a symlinked install exactly as `hooks.json`
says, the pane's routes run against the real CLI's shapes, and the pane was
walked in headless Chrome against a real daemon (`scripts/journey-jetski-pane.mjs`).
What no machine here can do is be Jetski: load the plugin, run the hook at
the start of a real conversation, serve the pane through its Sidecar SDK in
the AuxPane, and carry *Ask* into the chat. That is this walk.

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
- **A Chat appears in step 5:** that is a bug; `embed-chat.test.ts` names the
  entrances it guards. Note what opened it.

## What this walk does not cover

Subagent conversations run the same hook and also join; that is by design and
not walked here. Jetski Web against a canvas on isocan.io is the same pane
with a remote frame — worth a run on its own when someone has it.
