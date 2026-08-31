import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * **Every write to the open canvas goes through the echoing door.**
 *
 * `sendOp` posts and waits. `sendEchoed` applies the op locally first, so the
 * canvas answers the instant somebody acts and the home confirms behind them.
 * The difference is invisible on a fast connection, which is exactly why it
 * keeps shipping: it was reported twice, as "⌘Enter and nothing is added" and
 * as "I hit delete, nothing happened, then I reloaded and it was gone".
 *
 * Both times a single path was fixed and the sweep was left undone — and the
 * second report came from one of the paths that had been left. So this is the
 * guard rather than another promise: a canvas write that does not echo has to
 * be argued for HERE, by name, with a reason.
 */
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const files = execFileSync("git", ["ls-files", "packages/web/src"], {
  cwd: repo,
  encoding: "utf8",
})
  .split("\n")
  .filter((f) => /\.tsx?$/.test(f));

/**
 * The writes that legitimately do NOT echo, each because the op is not about
 * the canvas this tab has open — so there is no local state for an echo to
 * apply to, and `sendEchoed` would fall through to `sendOp` anyway.
 */
const ALLOWED: Record<string, string> = {
  "packages/web/src/lib/api.ts": "defines sendOp",
  "packages/web/src/stores/canvasStore.ts": "sendEchoed's own post, and the offline flush",
  "packages/web/src/lib/identitycolor.ts": "actor.setColor is identity, not canvas state (canvasId is null)",
  "packages/web/src/pages/CanvasListPage.tsx":
    "project.create/update/delete on canvases this tab does not have open",
};

describe("writes to the open canvas", () => {
  it("all go through sendEchoed", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (ALLOWED[file]) continue;
      const src = readFileSync(repo + file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      if (/\bsendOp\(/.test(src)) offenders.push(file);
    }
    expect(
      offenders,
      "these post without a local echo — the gesture will look like it did nothing " +
        "on a slow connection. Use `sendEchoed`, or add the file to ALLOWED with the reason.",
    ).toEqual([]);
  });

  it("has a list of exceptions that all still exist", () => {
    /* An allow-list that names a deleted file is an exemption nobody can see
       has stopped applying — and the next file with that name inherits it. */
    for (const file of Object.keys(ALLOWED)) {
      expect(files, `${file} is exempted but no longer exists`).toContain(file);
    }
  });

  it("found files at all", () => {
    /* A guard that scans nothing passes forever. */
    expect(files.length).toBeGreaterThan(50);
  });
});
