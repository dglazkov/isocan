#!/usr/bin/env node
/**
 * **The Isocan Canvas pane** — a Jetski sidecar (`docs/projects/jetski/design.md`
 * §6, phase 3).
 *
 * Jetski starts this with the sidecar's directory as the cwd, a loopback port,
 * and a token every non-GET call must carry; the page it serves is framed in
 * the AuxPane beside the chat. It owns no canvas logic. Every route is one or
 * two `isocan` commands, run as the PERSON (`personEnv`) in the workspace
 * folder the host names — so the pane can do nothing the CLI cannot, and a
 * folder the host did not name is never guessed at.
 *
 * Under Jetski the routes ride the host's Sidecar SDK (`sidecar_sdk`, which
 * Jetski's loader resolves). Anywhere else — a test, somebody running it by
 * hand — the same table is served by a plain loopback server that keeps the
 * same token rule.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TIERS,
  askMessage,
  conversationsOn,
  fanoutMessage,
  handoffComment,
  newConversationArgs,
  projectIdOf,
  recordConversation,
  runAgentapi,
  skillMessage,
  threadMessage,
} from "../../lib/jetski.mjs";
import { startRelay } from "../../lib/relay.mjs";
import { bindingFor, isocanHome, personEnv, resolveCli, runIsocan, workspacePaths } from "../../lib/workspace.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/** How long a harness scan is believed. It reads PATH and config.json, which
 * change rarely, and the pane asks on every workspace change. */
const HARNESS_TTL_MS = 60_000;

/** How long a canvas's skill list is believed. A skill added with `/skill
 * add` shows within a minute; the pane asks whenever the composer opens. */
const SKILLS_TTL_MS = 60_000;

/** At most this many conversations per fan-out: each is a real conversation
 * on a real model, and a person comparing takes are reading every one. */
const MAX_FANOUT = 3;

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
const messageOf = (err) => (err instanceof Error ? err.message : String(err));

/**
 * The Agents bar's buttons: `presets.json` beside this file, or the file
 * `ISOCAN_JETSKI_PRESETS` names. Each is a standing agent to enrol — a name
 * (an agent's, never a model's), a harness (null: this machine's default), and
 * a model id spelled the way that harness spells it (null: its own default).
 */
export function loadPresets(env = process.env) {
  const file = env.ISOCAN_JETSKI_PRESETS || path.join(here, "presets.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const list = Array.isArray(raw) ? raw : raw?.presets;
  if (!Array.isArray(list)) throw new Error(`${file}: expected a "presets" list`);
  return list.flatMap((entry) => {
    const name = text(entry?.name);
    if (!name) return [];
    return [
      {
        id: text(entry.id) ?? name.toLowerCase(),
        name,
        label: text(entry.label) ?? name,
        harness: text(entry.harness),
        model: text(entry.model),
      },
    ];
  });
}

/** A canvas reference as a person pastes it: an address (`…/p/prj_…`, a pass
 * fragment and all) reduces to its id; anything else — an id, a title — is
 * handed to `isocan use` as typed, which reads both. */
export function canvasRef(raw) {
  const typed = text(raw);
  if (!typed) return null;
  return /\/p\/(prj_[A-Za-z0-9_-]+)/.exec(typed)?.[1] ?? typed;
}

/** Whether an address is this machine's own daemon — framed from anywhere
 * but this machine (Jetski Web on a laptop, the daemon on a workstation) it
 * cannot load, and the pane says so rather than showing a blank frame. */
export function isLoopback(address) {
  try {
    const host = new URL(address).hostname.replace(/^\[|\]$/g, "");
    return host === "localhost" || host.endsWith(".localhost") || host === "::1" || /^127\./.test(host);
  } catch {
    return false;
  }
}

/** The canvas as an ordinary tab, for the pane's "Open ↗": the embed
 * address with its pass and its embed switches taken off. `isocan embed
 * --json`'s own `canvas` keeps `?embed=1` — it is where an admitted FRAME
 * goes back to — and a tab opened from it would hide its own chat. */
export function tabAddress(address) {
  try {
    const url = new URL(address);
    url.hash = "";
    url.searchParams.delete("embed");
    url.searchParams.delete("chat");
    return url.href;
  } catch {
    return address;
  }
}

/** What a preset will really run on here: its harness or the machine's
 * default, whether that can run, whether its model reaches it, and whether it
 * is already enrolled on this canvas. */
function reach(preset, scan, enrolled = []) {
  const match = enrolled.find((e) => e.name.toLowerCase() === preset.name.toLowerCase()) ?? null;
  const runsOn = match?.harness ?? preset.harness ?? scan?.default ?? null;
  const row = scan?.harnesses?.find((r) => r.name === runsOn) ?? null;
  return {
    ...preset,
    runsOn,
    runnable: Boolean(row?.runnable),
    enrolled: Boolean(match),
    // Null when there is nothing to pin, or when the CLI is too old to say.
    pinsModel: preset.model && typeof row?.pinsModel === "boolean" ? row.pinsModel : null,
  };
}

/** What this machine already has on `canvasId`: live agent sessions in
 * `~/.isocan/sessions/<actorId>.json` and standing agents enrolled in
 * `~/.isocan/rc-agents.json`. Read from files so `/api/workspace` stays one
 * cached harness scan. */
export function canvasAgents(home, canvasId) {
  if (!home || !canvasId) return { sessions: [], enrolled: [] };
  let enrolled = [];
  try {
    const rows = JSON.parse(fs.readFileSync(path.join(home, "rc-agents.json"), "utf8"));
    if (Array.isArray(rows)) {
      enrolled = rows.flatMap((row) => {
        const name = text(row?.name);
        if (row?.canvasId !== canvasId || !name) return [];
        return [{
          actorId: text(row.actorId),
          name,
          harness: text(row.harness),
          model: text(row.model),
        }];
      });
    }
  } catch { /* no rc-agents.json yet */ }

  let actors = null;
  try {
    actors = JSON.parse(fs.readFileSync(path.join(home, "actors.json"), "utf8"));
  } catch { /* no actors.json yet */ }

  const sessions = [];
  try {
    const sessDir = path.join(home, "sessions");
    for (const entry of fs.readdirSync(sessDir)) {
      if (!entry.endsWith(".json")) continue;
      const actorId = entry.slice(0, -5);
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(sessDir, entry), "utf8"));
        if (raw?.canvasId !== canvasId) continue;
        const harness = text(actors?.harnesses?.[actorId]);
        const label = text(raw?.label);
        if (!harness && !label) continue;
        const stripped = label ? label.replace(/\s*🤖\s*$/, "").trim() : null;
        const name = text(actors?.names?.[actorId]?.name) ?? stripped ?? actorId;
        const bridge =
          raw?.bridge &&
          typeof raw.bridge.at === "number" &&
          raw.bridge.message &&
          typeof raw.bridge.message === "object"
            ? { at: raw.bridge.at, message: raw.bridge.message }
            : null;
        sessions.push({
          actorId,
          name,
          label,
          harness,
          sessionId: text(raw.sessionId),
          ...(bridge ? { bridge } : {}),
        });
      } catch { /* unreadable session file */ }
    }
  } catch { /* no sessions directory yet */ }

  return { sessions, enrolled };
}

/**
 * The pane's routes, over an injected environment and command runner so a
 * test can hold them to what they run. Every handler takes the request's
 * data — `workspaceUris` as the host pushed them, plus the route's own
 * fields — and returns JSON, or throws a sentence.
 */
export function createPane({ env = process.env, run = runIsocan, agentapi = runAgentapi, now = Date.now } = {}) {
  const home = isocanHome(env);
  let scanned = null;
  const skillCache = new Map();

  const exec = (args, cwd, timeoutMs = 20_000) => run(args, { cwd, env: personEnv(env, home), timeoutMs });
  const execJson = async (args, cwd, timeoutMs) => JSON.parse((await exec(["--json", ...args], cwd, timeoutMs)).stdout);

  async function harnesses() {
    if (scanned && now() - scanned.at < HARNESS_TTL_MS) return scanned.value;
    const value = await execJson(["harness"], os.homedir(), 15_000);
    scanned = { at: now(), value };
    return value;
  }

  function where(data) {
    const paths = workspacePaths(data?.workspaceUris);
    return { paths, binding: bindingFor(paths, home) };
  }

  function bound(data) {
    const { binding } = where(data);
    if (!binding) throw new Error("this workspace is not bound to a canvas yet");
    return binding;
  }

  /** What the pane shows: the folder, its canvas if it has one, and the
   * Agents bar as it would really run here. Reads files and one cached
   * scan; changes nothing. */
  async function workspace(data) {
    const { paths, binding } = where(data);
    const cli = resolveCli(env) !== null;
    let scan = null;
    let harnessError = null;
    if (cli) {
      try {
        scan = await harnesses();
      } catch (err) {
        harnessError = messageOf(err);
      }
    }
    const { sessions: live, enrolled } = canvasAgents(home, binding?.canvasId);
    // Which faces are Jetski conversations, so a face can open its chat.
    const conversations = binding ? conversationsOn(home, binding.canvasId, now()) : [];
    const sessions = live.map((sess) => {
      const convo = conversations.find((c) => c.actorId && c.actorId === sess.actorId);
      return convo ? { ...sess, conversationId: convo.conversationId, ...(convo.tier ? { tier: convo.tier } : {}) } : sess;
    });
    let presets = [];
    let presetsError = null;
    try {
      presets = loadPresets(env).map((preset) => reach(preset, scan, enrolled));
    } catch (err) {
      presetsError = messageOf(err);
    }
    return {
      workspace: binding?.workspace ?? paths[0] ?? null,
      bound: Boolean(binding),
      canvasId: binding?.canvasId ?? null,
      title: binding?.title ?? null,
      root: binding?.root ?? null,
      markerHome: binding?.home ?? null,
      cli,
      ...(harnessError ? { harnessError } : {}),
      defaultHarness: scan?.default ?? null,
      sessions,
      enrolled,
      conversations,
      tiers: TIERS,
      presets,
      ...(presetsError ? { presetsError } : {}),
    };
  }

  /** A fresh address for the frame: `isocan embed`, which mints a pass as
   * the person. Minted per load, because a pass is single-use and a local
   * daemon's frame cannot keep a badge across reloads. */
  async function embed(data) {
    const binding = bound(data);
    const out = await execJson(["embed"], binding.root);
    return {
      address: out.address,
      canvas: out.canvas,
      tab: tabAddress(out.canvas ?? out.address),
      expiresAt: out.expiresAt,
      loopback: isLoopback(out.address),
    };
  }

  /** Bind the workspace's folder: to the canvas a reference names, or to a
   * new one titled after the folder (or as asked). `isocan use` writes the
   * marker where it belongs — the repo's top, in a repo. */
  async function bind(data) {
    const { paths, binding } = where(data);
    const folder = paths[0];
    if (!folder) throw new Error("Jetski has not said which folder this workspace is");
    if (binding) throw new Error(`this workspace is already bound, by ${path.join(binding.root, ".isocan", "project.json")}`);
    let ref = canvasRef(data?.ref);
    if (!ref) ref = (await execJson(["canvas", "new", text(data?.title) ?? path.basename(folder)], folder)).canvasId;
    const { stdout } = await exec(["use", ref], folder);
    return { ...(await workspace(data)), said: stdout.trim() };
  }

  /** Enrol a standing agent from a preset, or from a name, harness and model
   * given outright. It answers whenever this person's `isocan rc` runs. */
  async function modelAgent(data) {
    const binding = bound(data);
    const presetId = text(data?.presetId);
    const preset = presetId ? loadPresets(env).find((p) => p.id === presetId) : null;
    if (presetId && !preset) throw new Error(`no preset "${presetId}"`);
    const name = text(data?.name) ?? preset?.name ?? null;
    if (!name) throw new Error("an agent needs a name");
    const harness = text(data?.harness) ?? preset?.harness ?? null;
    const model = text(data?.model) ?? preset?.model ?? null;
    const out = await execJson(
      ["rc", "add", name, "--dir", binding.root, ...(harness ? ["--harness", harness] : []), ...(model ? ["--model", model] : [])],
      binding.root,
    );
    return { enrolled: out.enrolled, canvasId: out.canvasId, harness, model: out.model ?? model };
  }

  /** The canvas's skills — its slash commands, built in and added with
   * `/skill add` — as the pane's `/` menu offers them. A command answered
   * where it is typed (`local`, like /help) is the web app's, not an
   * agent's, and is left out. */
  async function skills(data) {
    const binding = bound(data);
    const cached = skillCache.get(binding.canvasId);
    if (cached && now() - cached.at < SKILLS_TTL_MS) return { skills: cached.value };
    const list = await execJson(["command", "ls"], binding.root);
    const value = (Array.isArray(list) ? list : []).flatMap((c) => {
      const name = text(c?.name);
      if (!name || c.local) return [];
      return [{ name, description: text(c.description) ?? "", usage: text(c.usage) ?? "", source: text(c.source) ?? "" }];
    });
    skillCache.set(binding.canvasId, { at: now(), value });
    return { skills: value };
  }

  /** Questions agents left on the canvas that nobody has answered — the
   * pane's inbox. Names come from the local actor cache, as the Agents bar's
   * do; an unknown asker is its id. */
  async function asks(data) {
    const binding = bound(data);
    const list = await execJson(["comment", "ls", "--open"], binding.root);
    let names = {};
    try {
      names = JSON.parse(fs.readFileSync(path.join(home, "actors.json"), "utf8"))?.names ?? {};
    } catch { /* no cache yet */ }
    return {
      asks: (Array.isArray(list) ? list : []).flatMap((a) => {
        const threadId = text(a?.threadId);
        if (!threadId) return [];
        const askerId = text(a.askerId);
        return [{ threadId, askerId, askerName: text(names?.[askerId]?.name) ?? askerId, body: text(a.body) ?? "" }];
      }),
    };
  }

  const canvasOf = (binding) => ({ canvasId: binding.canvasId, title: binding.title ?? null });

  /** The project a conversation lives in, so a message lands where the
   * conversation is — the page says it when it knows, the host is asked when
   * it does not. */
  async function projectFor(data, conversationId) {
    const given = text(data?.projectId);
    if (given) return given;
    if (!conversationId) return null;
    try {
      return projectIdOf(await agentapi(["get-conversation-metadata", conversationId], { env })) || null;
    } catch {
      return null;
    }
  }

  /** Hand this conversation something from the canvas: a question about the
   * selection, a canvas skill to run, or an open question to help answer. */
  async function send(data) {
    const binding = bound(data);
    const conversationId = text(data?.conversationId);
    if (!conversationId) throw new Error("this pane is not attached to a conversation");
    const canvas = canvasOf(binding);
    const items = Array.isArray(data?.items) ? data.items : [];
    const kind = text(data?.kind) ?? "ask";
    const message =
      kind === "skill" ? skillMessage({ skill: data.skill, args: data.args, items, canvas })
      : kind === "thread" ? threadMessage({ thread: data.thread, canvas })
      : askMessage({ question: data.question, items, canvas });
    await agentapi(["send-message", conversationId, message], { env, projectId: await projectFor(data, conversationId) });
    return { sent: true, message };
  }

  /** Hand a skill or a question to a standing agent ON the canvas: a comment
   * on the first selected item that @mentions it, posted as the person. The
   * request is the record, and whoever runs `isocan rc` gets the wake. */
  async function handoff(data) {
    const binding = bound(data);
    const items = (Array.isArray(data?.items) ? data.items : []).filter((i) => text(i?.id));
    if (items.length === 0) throw new Error("select an item on the canvas first — the request is pinned to it");
    const others = items.slice(1).map((i) => `\`${i.id}\``);
    const body = handoffComment({ skill: data.skill, args: data.args, agent: data.agent, question: data.question });
    const withOthers = others.length ? `${body}\n\n(also: ${others.join(", ")})` : body;
    const out = await execJson(["comment", "add", "--item", items[0].id, withOthers], binding.root);
    return { threadId: out.threadId, body: withOthers };
  }

  /**
   * **Fan out:** the same ask in several new Jetski conversations, one per
   * model tier. Each is a real conversation in this project; the SessionStart
   * hook names it and puts it on the canvas like any other, so the takes land
   * side by side under their own names. The record is written ahead of the
   * hook so the pane can say which face is which tier.
   */
  async function fanout(data) {
    const binding = bound(data);
    const tiers = [...new Set((Array.isArray(data?.tiers) ? data.tiers : []).filter((t) => TIERS.includes(t)))];
    if (tiers.length === 0) throw new Error(`pick at least one tier (${TIERS.join(", ")})`);
    if (tiers.length > MAX_FANOUT) throw new Error(`at most ${MAX_FANOUT} at once`);
    const canvas = canvasOf(binding);
    const items = Array.isArray(data?.items) ? data.items : [];
    const projectId = await projectFor(data, text(data?.conversationId));
    const what = text(data?.skill) ? `/${text(data.skill).replace(/^\//, "")}` : (text(data?.question) ?? "the canvas").slice(0, 48);
    const started = [];
    for (const tier of tiers) {
      const message = fanoutMessage({ ask: data.question, skill: data.skill, args: data.args, items, canvas, tier, of: tiers.length });
      const out = await agentapi(newConversationArgs({ message, tier, title: `${what} · ${tier}` }), { env, projectId });
      const conversationId = text(out?.conversationId) ?? text(out?.conversation_id) ?? text(out?.response?.conversationId) ?? null;
      if (conversationId) {
        try {
          recordConversation(home, conversationId, { canvasId: binding.canvasId, title: binding.title ?? null, root: binding.root, tier }, now());
        } catch { /* the hook writes it again */ }
      }
      started.push({ tier, conversationId });
    }
    return { started };
  }

  return {
    routes: {
      "/api/workspace": workspace,
      "/api/embed": embed,
      "/api/bind": bind,
      "/api/model-agent": modelAgent,
      "/api/skills": skills,
      "/api/asks": asks,
      "/api/send": send,
      "/api/handoff": handoff,
      "/api/fanout": fanout,
    },
  };
}

/** The page, read per request so an edit shows on the next load. */
function page() {
  return fs.readFileSync(path.join(here, "public", "index.html"), "utf8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw.trim() ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/**
 * The host's three `/_sidecar/*` routes, delegated to `SidecarApp`'s own
 * methods so `createServer` — which awaits async route handlers, where
 * ` sidecar_sdk`'s own `SidecarApp.run()` calls `JSON.stringify(handler(data))`
 * synchronously and turns a Promise into `{}` — serves both the host's
 * routes and the pane's.
 */
export function hostRoutes(app) {
  return {
    "/_sidecar/send-message": (data) =>
      app.sendMessage(data.conversationId, data.message, { title: data.title, projectId: data.projectId }),
    "/_sidecar/new-conversation": (data) =>
      app.startConversation(data.message, { model: data.model, projectId: data.projectId }),
    "/_sidecar/get-conversation-metadata": (data) =>
      app.getConversationMetadata(data.conversationId),
  };
}

/**
 * The same route table on one loopback server, inside Jetski and outside it:
 * GET serves the page (and `/preload.js` when the host provides it),
 * everything else is POST, carries the token when one is set, and awaits the
 * handler before serialising its answer.
 */
export function createServer(routes, { token = process.env.ANTIGRAVITY_SIDECAR_UI_TOKEN, preload = "" } = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET") {
      if (url.pathname === "/preload.js" && preload) {
        res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
        return res.end(preload);
      }
      if (url.pathname !== "/") return send(404, { error: "not found" });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(page());
    }
    if (token && (req.headers["x-sidecar-token"] ?? url.searchParams.get("token")) !== token) {
      return send(401, { error: "unauthorized" });
    }
    const route = Object.hasOwn(routes, url.pathname) ? routes[url.pathname] : null;
    if (!route) return send(404, { error: "not found" });
    if (req.method !== "POST") return send(405, { error: "method not allowed" });
    try {
      const data = Object.fromEntries([...url.searchParams].filter(([key]) => key.toLowerCase() !== "token"));
      send(200, await route({ ...data, ...(await readBody(req)) }));
    } catch (err) {
      send(500, { error: messageOf(err) });
    }
  });
}

async function main() {
  const { routes } = createPane();
  let extra = {};
  let preload = "";
  if (process.env.ANTIGRAVITY_LS_ADDRESS && process.env.ANTIGRAVITY_SIDECAR_WEB_PORT) {
    const { SidecarApp } = await import("sidecar_sdk");
    extra = hostRoutes(new SidecarApp());
    preload = fs.readFileSync(new URL("./preload.js", import.meta.resolve("sidecar_sdk")), "utf8");
  }
  const port = Number(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || process.env.PORT || 0);
  const server = createServer({ ...extra, ...routes }, { preload });
  // The ear: while Jetski runs this pane, the canvas can reach its
  // conversations (lib/relay.mjs). Only under the host — a pane opened by
  // hand has no conversations to hand anything to.
  if (process.env.ANTIGRAVITY_LS_ADDRESS) startRelay({ home: isocanHome() });
  server.listen(port, "127.0.0.1", () => {
    console.log(`isocan pane: http://127.0.0.1:${server.address().port}/?workspace=<folder>`);
  });
}

const invoked = (() => {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();
if (invoked) {
  main().catch((err) => {
    console.error(`isocan pane: ${messageOf(err)}`);
    process.exit(1);
  });
}
