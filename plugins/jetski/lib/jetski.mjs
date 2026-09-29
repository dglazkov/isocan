/**
 * **Jetski's half of the tie** (`docs/projects/jetski/design.md` §9–§12).
 *
 * `workspace.mjs` knows the canvas; this file knows the conversations. Three
 * things live here, all plain ESM for the same reason as its neighbour:
 *
 * - **`agentapi`**, the host's own CLI for conversations — the same binary the
 *   Sidecar SDK shells out to (`ANTIGRAVITY_AGENTAPI_EXE agentapi …`), called
 *   directly because the SDK drops `--title` on a new conversation and a
 *   fan-out wants to say which tier each conversation is.
 * - **The conversations record**, `<isocan home>/jetski-conversations.json`:
 *   which Jetski conversation became which actor on which canvas. The desk
 *   keeps that claim as `antigravity:<conversationId>` and never hands it back,
 *   so the hook writes down what it named and the pane and the relay read it.
 * - **Every sentence the pane hands a conversation.** Composed here, not in
 *   the page, so a test can hold them — and so they say the same thing to the
 *   agent whichever button sent them.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

// ---------- agentapi ----------

/** The tiers `agentapi new-conversation --model` takes, cheapest first. */
export const TIERS = ["flash_lite", "flash", "pro"];

/** How to run `agentapi`: the language server's own executable when the host
 * names it (the SDK's preference — no PATH shim, no shell), else the shim. */
export function agentapiCommand(env = process.env) {
  const exe = text(env.ANTIGRAVITY_AGENTAPI_EXE);
  return exe ? { command: exe, prefix: ["agentapi"] } : { command: "agentapi", prefix: [] };
}

/** One `agentapi` call, its JSON answer parsed (`{}` for silence). A failure
 * throws with the tool's own last words. */
export function runAgentapi(args, { env = process.env, projectId = null, timeoutMs = 30_000 } = {}) {
  const { command, prefix } = agentapiCommand(env);
  const childEnv = { ...env, ...(projectId ? { ANTIGRAVITY_PROJECT_ID: projectId } : {}) };
  return new Promise((resolve, reject) => {
    execFile(command, [...prefix, ...args], { env: childEnv, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, encoding: "utf8" }, (err, stdout, stderr) => {
      if (err) {
        const said = `${stderr ?? ""}`.trim().split("\n").slice(-2).join(" ").trim();
        return reject(new Error(`agentapi ${args[0]}: ${err.killed ? "timed out" : said || err.message}`));
      }
      let out;
      try {
        out = stdout.trim() ? JSON.parse(stdout) : {};
      } catch {
        return resolve({ raw: stdout.trim() });
      }
      // agentapi can exit 0 and still say it failed, in the body.
      if (out && typeof out.error === "string" && out.error) return reject(new Error(`agentapi ${args[0]}: ${out.error}`));
      resolve(out);
    });
  });
}

/** The project a conversation belongs to, read the way the SDK's preload
 * reads it — both spellings, and "" when the host will not say. */
export function projectIdOf(metadata) {
  const event = metadata?.response?.conversationMetadata ?? metadata?.response?.conversation_metadata;
  const meta = event?.metadata;
  return text(meta?.projectId) ?? text(meta?.project_id) ?? "";
}

/** The `new-conversation` arguments for one fan-out conversation. */
export function newConversationArgs({ message, tier, title }) {
  if (!TIERS.includes(tier)) throw new Error(`"${tier}" is not a tier agentapi knows (${TIERS.join(", ")})`);
  return ["new-conversation", `--model=${tier}`, ...(text(title) ? [`--title=${text(title)}`] : []), message];
}

// ---------- the conversations record ----------

export const CONVERSATIONS_FILE = "jetski-conversations.json";

/** How long a conversation is believed to still be somebody's. Past this the
 * relay stops parking for it: a conversation from last week is not waiting. */
export const CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000;

export function readConversations(home) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(home, CONVERSATIONS_FILE), "utf8"));
    const list = raw?.conversations;
    if (!list || typeof list !== "object") return {};
    const out = {};
    for (const [conversationId, row] of Object.entries(list)) {
      if (!text(conversationId) || !row || typeof row !== "object") continue;
      const canvasId = text(row.canvasId);
      const root = text(row.root);
      if (!canvasId || !root) continue;
      out[conversationId] = {
        canvasId,
        root,
        actorId: text(row.actorId),
        name: text(row.name),
        title: text(row.title),
        tier: text(row.tier),
        at: typeof row.at === "number" ? row.at : 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** Write one conversation's row (or drop it, with `row: null`). Rows past the
 * TTL are swept on every write, so the file cannot grow without bound. The
 * write is a rename, so a reader never sees half a file. */
export function recordConversation(home, conversationId, row, now = Date.now()) {
  const all = readConversations(home);
  if (row) all[conversationId] = { ...all[conversationId], ...row, at: now };
  else delete all[conversationId];
  for (const [id, r] of Object.entries(all)) if (now - r.at > CONVERSATION_TTL_MS) delete all[id];
  fs.mkdirSync(home, { recursive: true });
  const file = path.join(home, CONVERSATIONS_FILE);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ conversations: all }, null, 2)}\n`);
  fs.renameSync(tmp, file);
  return all;
}

/** The live conversations on one canvas, newest first. */
export function conversationsOn(home, canvasId, now = Date.now()) {
  return Object.entries(readConversations(home))
    .filter(([, r]) => r.canvasId === canvasId && now - r.at <= CONVERSATION_TTL_MS)
    .sort(([, a], [, b]) => b.at - a.at)
    .map(([conversationId, r]) => ({ conversationId, ...r }));
}

// ---------- what the pane hands a conversation ----------

const canvasName = (canvas) =>
  canvas?.title ? `"${canvas.title}" (${canvas.canvasId})` : (canvas?.canvasId ?? "this workspace's canvas");

function itemList(items) {
  return (items ?? [])
    .filter((i) => text(i?.id))
    .map((i) => `\`${i.id}\`${text(i.title) ? ` "${text(i.title)}"` : ""}`)
    .join(", ");
}

/** The footer every pane message ends with: which canvas, which items, and
 * the two commands that read them. One spelling, so the agent learns it. */
function pointedAt(canvas, items) {
  const list = itemList(items);
  return list
    ? `(Selected on the isocan canvas ${canvasName(canvas)}: ${list}. \`isocan show <id>\` describes one; \`isocan get <id>\` prints its file.)`
    : `(On the isocan canvas ${canvasName(canvas)} — nothing selected. \`isocan ls\` lists what is on it.)`;
}

/**
 * A plain question about the selection, or about the canvas.
 *
 * `agentapi send-message` hands it over as a system message, not as the
 * person's own chat turn, and a conversation in the middle of a task folds a
 * bare sentence into what it was doing and never answers it (29 Sep: *How
 * many screens are there?* disappeared into a busy turn). So it says who is
 * asking and that it wants an answer here, before anything else.
 */
export function askMessage({ question, items, canvas }) {
  const typed = text(question) ?? (itemList(items) ? "Take a look at these and tell me what you think." : "What is on the canvas right now?");
  return `${ASKED}\n\n${typed}\n\n${pointedAt(canvas, items)}`;
}

/** The first line of everything the pane asks: who, from where, and that it
 * wants an answer in this chat even when a task is under way. Because
 * `agentapi send-message` arrives as a hidden system event rather than a
 * visible user turn in the chat column, the agent quotes the prompt first. */
export const ASKED =
  "The person asked this from the Isocan Canvas pane beside this chat (their prompt is not shown in the chat transcript, so start your reply by quoting what they asked on a `> ` line). Answer it here — if you are in the middle of something, answer it first, then carry on:";

/**
 * A canvas skill, run by this conversation. The same words a comment would
 * carry — `/name args` first, because on the canvas a message that starts
 * with `/name` IS the request — and then the one instruction a Jetski agent
 * would not otherwise know: the skill's body is `isocan command show <name>`.
 */
export function skillMessage({ skill, args, items, canvas }) {
  const name = text(skill)?.replace(/^\//, "");
  if (!name) throw new Error("which skill?");
  const typed = text(args);
  return [
    `/${name}${typed ? ` ${typed}` : ""}`,
    "",
    ASKED,
    "",
    `This is the isocan canvas skill /${name}. Run \`isocan command show ${name}\` — the body it prints is your instructions for this turn; what I typed after the name outranks its defaults. Do the work on the canvas as yourself, then tell me here what you made and where.`,
    "",
    pointedAt(canvas, items),
  ].join("\n");
}

/** The comment that hands a skill (or a question) to a standing agent on the
 * canvas instead: `/name` first when it is a skill, the @mention after it,
 * so the rc wakes that agent and the request is the record. */
export function handoffComment({ skill, args, agent, question }) {
  const who = text(agent);
  if (!who) throw new Error("hand it to whom?");
  const name = text(skill)?.replace(/^\//, "");
  const typed = text(name ? args : question);
  return name ? `/${name} @${who}${typed ? ` ${typed}` : ""}` : `@${who} ${typed ?? "take a look at this"}`;
}

/** An open question an agent left on the canvas, handed to this conversation
 * to answer. */
export function threadMessage({ thread, canvas }) {
  const id = text(thread?.threadId);
  if (!id) throw new Error("which thread?");
  const asker = text(thread.askerName) ?? "An agent";
  const body = text(thread.body) ?? "";
  return [
    ASKED,
    "",
    `${asker} is waiting on an answer on the isocan canvas ${canvasName(canvas)}:`,
    "",
    body ? `> ${body.replace(/\n/g, "\n> ")}` : "",
    "",
    `Help me answer it. It is thread \`${id}\` (\`isocan comment ls --open\` lists the questions waiting on a person); reply on it with \`isocan comment reply ${id} "…"\` once we agree what to say.`,
  ].filter((line, i, all) => line !== "" || all[i - 1] !== "").join("\n");
}

/**
 * The opening message of one fan-out conversation. It arrives on the canvas
 * under its own name (the SessionStart hook), so the only thing it must be
 * told that the hook cannot tell it is that it is one of several — and to
 * say which tier it ran, because the name the hook gives it will not.
 */
export function fanoutMessage({ ask, skill, args, items, canvas, tier, of }) {
  const body = text(skill) ? skillMessage({ skill, args, items, canvas }) : askMessage({ question: ask, items, canvas });
  return [
    `You are one of ${of} Jetski conversations given the same ask, each on a different model tier; you are on **${tier}**. ` +
      "Work on the canvas as yourself and keep your result separate from the others' — put what you make beside the selection, not on top of it — " +
      `and title it or say in your reply that it is the ${tier} take, so a person can compare them.`,
    "",
    body,
  ].join("\n");
}

/**
 * What the relay hands a conversation when the canvas asked for it: the
 * wake exactly as `isocan wait` printed it — written for an agent already —
 * with one line in front saying where it came from and one after saying how
 * to answer, because this conversation did not park and does not know it
 * was woken.
 */
export function relayMessage({ woke, canvas, name }) {
  return [
    `The isocan canvas ${canvasName(canvas)} has something for you${text(name) ? ` (${text(name)})` : ""} — somebody there mentioned you or replied in your thread:`,
    "",
    text(woke) ?? "(the wake said nothing — `isocan comment ls` shows the threads)",
    "",
    "Answer it ON THE CANVAS with `isocan comment reply <thread> \"…\"` — the person who wrote it is reading the canvas, not this chat. If it asks for work, do it, then reply there. You do not need to run `isocan wait`; the Isocan Canvas pane passes the next one on.",
  ].join("\n");
}

/**
 * Turns a raw send/handoff/fanout failure into a sentence a person can act on
 * from the composer, naming both what went wrong and what recovers it.
 */
export function friendlyAskError(err, target = "here") {
  const raw = (typeof err === "string" ? err : err?.message) ?? "";
  const msg = raw.trim() || "Something went wrong while sending";
  const lower = msg.toLowerCase();
  if (lower.includes("not attached to a conversation")) {
    return "This pane isn't linked to an active chat yet — send a message in the chat column on the left to attach it, or switch the target menu to Fan out or an @agent.";
  }
  if (lower.includes("select an item")) {
    return "Select an item on the canvas first — handing off to an @agent posts a comment thread pinned to the selected item.";
  }
  if (lower.includes("trajectory not found") || lower.includes("conversation not found")) {
    return "Jetski couldn't find this chat's session — send a message in the chat column on the left to wake it, or use Fan out to start a fresh conversation.";
  }
  if (lower.includes("timed out")) {
    return "Timed out waiting for Jetski to accept the message — the host may be busy. Click Retry to send again.";
  }
  if (lower.includes("unauthorized") || lower.includes("answered 401")) {
    return "This pane's session token expired — click Reload in the top bar.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("fetch failed")) {
    return "Couldn't reach the pane server — click Retry, or click Reload in the top bar if the pane restarted.";
  }
  if (lower.includes("not bound to a canvas")) {
    return "This workspace folder isn't bound to a canvas yet — bind or create one first.";
  }
  if (target.startsWith("agent:")) {
    return `Couldn't post handoff comment on the canvas (${msg}). Check that the canvas daemon is reachable and click Retry.`;
  }
  if (target.startsWith("fan:")) {
    return `Couldn't start fan-out conversations (${msg}). Click Retry to try again.`;
  }
  return `Couldn't send to this chat (${msg}). Click Retry, or paste your message into the chat column on the left.`;
}

