import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const user = { id: "usr_kit", name: "Kit" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-cli-dualface-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...user, createdAt: new Date().toISOString() }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function isocan(...args: string[]): Promise<Run> {
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  env.GEMINI_API_KEY = "";
  const child: ChildProcess = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk) => (stdout += chunk));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

async function json(...args: string[]): Promise<any> {
  const run = await isocan("--json", ...args);
  if (run.code !== 0) {
    throw new Error(`isocan ${args.join(" ")} failed (${run.code}): ${run.stderr || run.stdout}`);
  }
  return JSON.parse(run.stdout);
}

describe("CLI dual-face artifacts", () => {
  it("adds an artifact with --visual and allows reading both faces with isocan get", async () => {
    await fs.writeFile(path.join(home, "design.md"), "# Design System\n\nTokens and colors.");
    await fs.writeFile(
      path.join(home, "design-system.html"),
      "<!DOCTYPE html><html><body><h1>Visualizer</h1></body></html>",
    );

    const added = await json("add", "design.md", "--visual", "design-system.html");
    expect(added.itemId).toBeDefined();

    const item = await json("show", added.itemId);
    expect(item.properties.file).toBe("design.md");
    expect(item.properties.visualFile).toBe("design-system.html");
    expect(item.versions[0].visual).toBeDefined();
    expect(item.versions[0].visual.filename).toBe("design-system.html");

    // Default get returns the source face
    const src = await isocan("get", added.itemId);
    expect(src.code).toBe(0);
    expect(src.stdout).toContain("# Design System");

    // --visual get returns the visual face
    const vis = await isocan("get", added.itemId, "--visual");
    expect(vis.code).toBe(0);
    expect(vis.stdout).toContain("<h1>Visualizer</h1>");
  });

  it("automatically inlines local images for HTML files into visual face while preserving clean source face", async () => {
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    await fs.writeFile(path.join(home, "pixel.png"), png1x1);
    const html = `<!DOCTYPE html><html><body><img src="./pixel.png"></body></html>`;
    await fs.writeFile(path.join(home, "index.html"), html);

    const added = await json("add", "index.html");
    expect(added.itemId).toBeDefined();

    const item = await json("show", added.itemId);
    expect(item.versions[0].visual).toBeDefined();

    const src = await isocan("get", added.itemId);
    expect(src.stdout).toBe(html);

    const vis = await isocan("get", added.itemId, "--visual");
    expect(vis.stdout).toContain("data:image/png;base64,");
    expect(vis.stdout).not.toContain("src=\"./pixel.png\"");
  });

  it("updates visual face with isocan edit --visual", async () => {
    await fs.writeFile(path.join(home, "notes.md"), "# Notes v1");
    await fs.writeFile(path.join(home, "view-v1.html"), "<div>v1</div>");
    await fs.writeFile(path.join(home, "view-v2.html"), "<div>v2</div>");

    const added = await json("add", "notes.md", "--visual", "view-v1.html");

    // Edit visual face
    const edited = await isocan("edit", added.itemId, "--visual", "view-v2.html");
    expect(edited.code).toBe(0);

    const vis = await isocan("get", added.itemId, "--visual");
    expect(vis.stdout).toBe("<div>v2</div>");

    const src = await isocan("get", added.itemId);
    expect(src.stdout).toBe("# Notes v1");
  });

  it("sets --visual-file property with isocan set", async () => {
    await fs.writeFile(path.join(home, "notes.md"), "# Notes");
    const added = await json("add", "notes.md");

    const setRes = await isocan("set", added.itemId, "--visual-file", "preview.html");
    expect(setRes.code).toBe(0);

    const item = await json("show", added.itemId);
    expect(item.properties.visualFile).toBe("preview.html");
  });
});
