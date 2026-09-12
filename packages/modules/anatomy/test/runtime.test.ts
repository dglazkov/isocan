import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("builds a portable workspace with declared proposals and a stylesheet loader", async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "anatomy-runtime-"));
  try {
    const built = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/module-build.mjs", "anatomy", "--out", out],
      {
        cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
        encoding: "utf8",
      },
    );
    expect(built.status, built.stderr).toBe(0);
    const manifest = JSON.parse(
      await fs.readFile(path.join(out, "manifest.json"), "utf8"),
    );
    expect(manifest).toMatchObject({
      engines: ">=0.2.1",
      proposed: ["host", "workspaces"],
      web: "dist/web.js",
      cli: "dist/cli.mjs",
    });
    const web = await fs.readFile(path.join(out, manifest.web), "utf8");
    expect(web).toContain('new URL("./web.css",import.meta.url)');
    expect(web).toContain("link.onload=resolve");
    expect(await fs.readFile(path.join(out, "dist/web.css"), "utf8")).toContain(
      ".anatomy-workspace",
    );
    const cli = await fs.readFile(path.join(out, manifest.cli), "utf8");
    expect(cli).toContain("globalThis.isocan.core");
  } finally {
    await fs.rm(out, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}, 120_000);
