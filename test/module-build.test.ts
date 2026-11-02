import { spawnSync } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

/**
 * **A module built for runtime loading** (`docs/projects/modules/design.md`,
 * phase 3). The build script writes the layout `isocan module add` installs
 * and the daemon serves, its manifest from the package and the core record,
 * and its code with every platform import rewritten to the host global — so
 * a served module carries no second React and no bare import nothing could
 * resolve.
 */
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-module-build-"));

afterAll(async () => {
  await fs.rm(out, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("scripts/module-build.mjs", () => {
  it("builds the mind map into a manifest, a guide and two halves that read the host", async () => {
    const built = spawnSync(process.execPath, ["--import", "tsx", "scripts/module-build.mjs", "mindmap", "--out", out], {
      cwd: repo,
      encoding: "utf8",
    });
    expect(built.status, built.stderr).toBe(0);
    const manifest = JSON.parse(await fs.readFile(path.join(out, "manifest.json"), "utf8"));
    expect(manifest).toMatchObject({
      name: "@isocan/mindmap",
      version: "0.1.0",
      engines: ">=0.1.0",
      propertyKeys: ["map", "mapParent"],
      web: "dist/web.js",
      cli: "dist/cli.mjs",
      guide: "agent-guide.md",
    });
    expect(existsSync(path.join(out, "agent-guide.md"))).toBe(true);
    for (const half of ["dist/web.js", "dist/cli.mjs"]) {
      const code = await fs.readFile(path.join(out, half), "utf8");
      expect(code, `${half} reaches the platform through the host`).toContain("globalThis.isocan.");
      expect(code, `${half} imports nothing it could not resolve`).not.toMatch(/from\s*["'](react|react\/jsx-runtime|react-dom|@isocan\/[a-z]+)["']/);
    }
    // The CLI half CARRIES its guide rather than finding it. It used to read
    // `../agent-guide.md` relative to `dist/cli.mjs`, which is the module's
    // root and happened to be right; the same expression in the bundled
    // isocan CLI points at nothing, because every folded-in file shares the
    // bundle's `import.meta.url` (`docs/projects/first-minute/design.md`). So
    // the import is the file's text, inlined at build time here and in
    // `scripts/release.mjs` — and the guide is still copied out beside it,
    // because `manifest.guide` is what a daemon serves and what
    // `runtime-modules.ts` prefers.
    const cli = await fs.readFile(path.join(out, "dist/cli.mjs"), "utf8");
    expect(cli, "the guide travels inside the built half").toContain("Mind maps");
    expect(cli, "and it does not go looking for it on disk").not.toContain("../agent-guide.md");
  }, 120_000);
});
