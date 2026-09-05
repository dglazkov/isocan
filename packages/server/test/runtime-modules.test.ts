import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SERVING_ROUTE } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { moduleFile, readRuntimeModules } from "../src/modules.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Runtime modules, served** (`docs/projects/modules/design.md`, phase 3).
 * The daemon reads `~/.isocan/modules/*` per request: a loaded module's
 * manifest is on `/api/serving`, its files are under `/modules/<slug>/` with
 * the type every static asset gets and no long cache; a refused module is
 * neither listed nor served; and nothing outside a module's directory can be
 * reached through it.
 */
let home: string;
let daemon: Daemon;
let base: string;

async function writeModule(slug: string, manifest: Record<string, unknown>, files: Record<string, string> = {}) {
  const dir = path.join(home, "modules", slug);
  await fs.mkdir(path.join(dir, "dist"), { recursive: true });
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest));
  for (const [rel, body] of Object.entries(files)) await fs.writeFile(path.join(dir, rel), body);
  return dir;
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-modules-"));
  await writeModule(
    "hello",
    { name: "@acme/hello", version: "1.2.0", engines: ">=0.1.0", kinds: [{ id: "greeting", mimes: ["text/x-greeting"], label: "Greetings", noun: "greeting" }], web: "dist/web.js" },
    { "dist/web.js": "export default { core: { name: '@acme/hello' } };\n" },
  );
  await writeModule("future", { name: "@acme/future", version: "9.0.0", engines: ">=9.0.0", web: "dist/web.js" }, { "dist/web.js": "export default {};\n" });
  await fs.mkdir(path.join(home, "modules", "junk"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
});

let badge: TestBadge;
const get = (url: string) => fetch(`${base}${url}`, { headers: badge.headers });

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

describe("what the home advertises", () => {
  it("lists a loaded module's manifest and not a refused one", async () => {
    const rows = readRuntimeModules(home);
    expect(rows.map((r) => [r.manifest.name, r.refused])).toEqual([
      ["@acme/future", "needs isocan >=9.0.0, and this is 0.1.0"],
      ["@acme/hello", null],
    ]);
    const serving = (await (await get(SERVING_ROUTE)).json()) as { modules?: { name: string }[] };
    expect(serving.modules?.map((m) => m.name)).toEqual(["@acme/hello"]);
  });

  it("serves a loaded module's files as what they are, without a long cache", async () => {
    const res = await get("/modules/hello/dist/web.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/javascript");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.text()).toContain("@acme/hello");
  });

  it("serves nothing for a refused module, an unknown one, or a path that walks out", async () => {
    expect((await get("/modules/future/dist/web.js")).status).toBe(404);
    expect((await get("/modules/nope/dist/web.js")).status).toBe(404);
    await fs.writeFile(path.join(home, "identity.json"), "{}");
    expect(moduleFile(home, "hello", "../../identity.json")).toBeNull();
    expect(moduleFile(home, "hello", "dist/../../hello/dist/web.js")).toMatch(/dist\/web\.js$/);
    expect(moduleFile(home, "future", "dist/web.js")).toBeNull();
  });
});
