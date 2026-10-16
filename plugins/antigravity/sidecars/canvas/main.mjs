#!/usr/bin/env node
/**
 * **The Isocan Canvas pane** — an Antigravity sidecar (`docs/projects/antigravity/design.md`
 * §6, phase 3).
 *
 * Antigravity starts this with the sidecar's directory as the cwd, a loopback port,
 * and a token every non-GET call must carry; the page it serves is framed in
 * the AuxPane beside the chat. It owns no canvas logic. Every route is one or
 * two `isocan` commands, run as the PERSON (`personEnv`) in the workspace
 * folder the host names — so the pane can do nothing the CLI cannot, and a
 * folder the host did not name is never guessed at.
 *
 * Under Antigravity the routes ride the host's Sidecar SDK (`sidecar_sdk`, which
 * Antigravity's loader resolves). Anywhere else — a test, somebody running it by
 * hand — the same table is served by a plain loopback server that keeps the
 * same token rule.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { conversationsOn, readConversations, recordConversation } from "../../lib/antigravity.mjs";
import { startRelay } from "../../lib/relay.mjs";
import { bindingFor, isocanHome, markerSource, personEnv, resolveCli, runIsocan, workspacePaths } from "../../lib/workspace.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where the sidecar's own files (`public/index.html`) live on disk right now.
 *
 * When the pane boots through `<home>/current/...`, Node's ESM loader resolves
 * `import.meta.url` to `<home>/builds/<boot-sha>/...`. After three auto-upgrades
 * in `direct` mode (`no daemon.json` for `liveBuildShas`), `pruneBuilds`
 * removes `<boot-sha>` while this long-lived sidecar is still running.
 * Following `<home>/current` whenever `bootDir` sits inside `<home>/builds/`
 * keeps `public/index.html` readable across upgrades.
 */
export function sidecarDir(env = process.env, bootDir = here) {
  try {
    const home = path.resolve(isocanHome(env));
    const builds = path.join(home, "builds") + path.sep;
    if (path.resolve(bootDir).startsWith(builds) || !fs.existsSync(bootDir)) {
      const current = path.join(home, "current", "node_modules", "isocan", "plugins", "antigravity", "sidecars", "canvas");
      if (fs.existsSync(current)) return current;
    }
  } catch {
    // Fall back to bootDir below.
  }
  return bootDir;
}

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
const messageOf = (err) => (err instanceof Error ? err.message : String(err));

/** A canvas reference as a person pastes it: an address (`…/p/prj_…`, a pass
 * fragment and all) reduces to its id; anything else — an id, a title — is
 * handed to `isocan use` as typed, which reads both. */
export function canvasRef(raw) {
  const typed = text(raw);
  if (!typed) return null;
  return /\/p\/(prj_[A-Za-z0-9_-]+)/.exec(typed)?.[1] ?? typed;
}

/** Whether an address is this machine's own daemon — framed from anywhere
 * but this machine (Antigravity Web on a laptop, the daemon on a workstation) it
 * cannot load, and the pane says so rather than showing a blank frame. */
export function isLoopback(address) {
  try {
    const host = new URL(address).hostname.replace(/^\[|\]$/g, "");
    return host === "localhost" || host.endsWith(".localhost") || host === "::1" || /^127\./.test(host);
  } catch {
    return false;
  }
}

/** The canvas as an ordinary tab, for the pane's "Open in browser ↗": the
 * embed address with its pass and its embed switches taken off. `isocan embed
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

/** Live agent sessions on `canvasId` in `~/.isocan/sessions/<actorId>.json`,
 * including their hostbridge cues (`bridge`) so CLI commands can steer the
 * framed canvas. */
export function canvasSessions(home, canvasId) {
  if (!home || !canvasId) return [];
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

  return sessions;
}

/**
 * The pane's routes, over an injected environment and command runner so a
 * test can hold them to what they run. Every handler takes the request's
 * data — `workspaceUris` as the host pushed them, plus the route's own
 * fields — and returns JSON, or throws a sentence.
 */
export function createPane({ env = process.env, run = runIsocan, now = Date.now } = {}) {
  const home = isocanHome(env);

  const exec = (args, cwd, timeoutMs = 20_000) => run(args, { cwd, env: personEnv(env, home), timeoutMs });
  const execJson = async (args, cwd, timeoutMs) => JSON.parse((await exec(["--json", ...args], cwd, timeoutMs)).stdout);

  function where(data) {
    let paths = workspacePaths(data?.workspaceUris);
    const convId = text(data?.conversationId);
    if (paths.length === 0 && convId) {
      const known = readConversations(home)[convId];
      if (known?.root) paths = [known.root];
    }
    const binding = bindingFor(paths, home);
    if (binding && convId && Array.isArray(data?.workspaceUris) && data.workspaceUris.length > 0) {
      try {
        recordConversation(home, convId, { canvasId: binding.canvasId, title: binding.title ?? null, root: binding.root }, now());
      } catch { /* best-effort cache */ }
    }
    return { paths, binding };
  }

  function bound(data) {
    const { binding } = where(data);
    if (!binding) throw new Error("this workspace is not bound to a canvas yet");
    return binding;
  }

  /** What the pane shows: the folder, its canvas if it has one, and the live
   * sessions on it (so hostbridge cues from the CLI reach the frame). Reads
   * local files; changes nothing. */
  async function workspace(data) {
    const { paths, binding } = where(data);
    const cli = resolveCli(env) !== null;
    const live = canvasSessions(home, binding?.canvasId);
    const conversations = binding ? conversationsOn(home, binding.canvasId, now()) : [];
    const sessions = live.map((sess) => {
      const convo = conversations.find((c) => c.actorId && c.actorId === sess.actorId);
      return convo
        ? { ...sess, harness: sess.harness ?? "antigravity", conversationId: convo.conversationId }
        : sess;
    });
    return {
      workspace: binding?.workspace ?? paths[0] ?? null,
      bound: Boolean(binding),
      canvasId: binding?.canvasId ?? null,
      title: binding?.title ?? null,
      root: binding?.root ?? null,
      markerHome: binding?.home ?? null,
      cli,
      sessions,
      conversations,
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
    if (!folder) throw new Error("Antigravity has not said which folder this workspace is");
    if (binding) throw new Error(`this workspace is already bound, by ${markerSource(binding.root, home)}`);
    let ref = canvasRef(data?.ref);
    if (!ref) ref = (await execJson(["canvas", "new", text(data?.title) ?? path.basename(folder)], folder)).canvasId;
    const { stdout } = await exec(["use", ref], folder);
    return { ...(await workspace(data)), said: stdout.trim() };
  }

  return {
    routes: {
      "/api/workspace": workspace,
      "/api/embed": embed,
      "/api/bind": bind,
    },
  };
}

/** The page, read per request so an edit (or an upgrade under `<home>/current`)
 * shows on the next load. */
function page(env = process.env, bootDir = here) {
  return fs.readFileSync(path.join(sidecarDir(env, bootDir), "public", "index.html"), "utf8");
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
 * `sidecar_sdk`'s own `SidecarApp.run()` calls `JSON.stringify(handler(data))`
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
 * The same route table on one loopback server, inside Antigravity and outside it:
 * GET serves the page (and `/preload.js` when the host provides it),
 * everything else is POST, carries the token when one is set, and awaits the
 * handler before serialising its answer.
 */
export function createServer(routes, { token = process.env.ANTIGRAVITY_SIDECAR_UI_TOKEN, preload = "", env = process.env, bootDir = here } = {}) {
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
      try {
        const html = page(env, bootDir);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(html);
      } catch (err) {
        return send(500, { error: messageOf(err) });
      }
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
  // The ear: while Antigravity runs this pane, the canvas can reach its
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
