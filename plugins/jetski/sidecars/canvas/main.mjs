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
import { bindingFor, isocanHome, personEnv, resolveCli, runIsocan, workspacePaths } from "../../lib/workspace.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/** How long a harness scan is believed. It reads PATH and config.json, which
 * change rarely, and the pane asks on every workspace change. */
const HARNESS_TTL_MS = 60_000;

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
 * default, whether that can run, and whether its model reaches it. */
function reach(preset, scan) {
  const runsOn = preset.harness ?? scan?.default ?? null;
  const row = scan?.harnesses?.find((r) => r.name === runsOn) ?? null;
  return {
    ...preset,
    runsOn,
    runnable: Boolean(row?.runnable),
    // Null when there is nothing to pin, or when the CLI is too old to say.
    pinsModel: preset.model && typeof row?.pinsModel === "boolean" ? row.pinsModel : null,
  };
}

/**
 * The pane's routes, over an injected environment and command runner so a
 * test can hold them to what they run. Every handler takes the request's
 * data — `workspaceUris` as the host pushed them, plus the route's own
 * fields — and returns JSON, or throws a sentence.
 */
export function createPane({ env = process.env, run = runIsocan, now = Date.now } = {}) {
  const home = isocanHome(env);
  let scanned = null;

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
    let presets = [];
    let presetsError = null;
    try {
      presets = loadPresets(env).map((preset) => reach(preset, scan));
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

  return {
    routes: {
      "/api/workspace": workspace,
      "/api/embed": embed,
      "/api/bind": bind,
      "/api/model-agent": modelAgent,
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
