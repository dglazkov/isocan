import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfigFromFile } from "vite";

/**
 * **The header's build tag, checked against the build that serves the page.**
 *
 * The tag is how Paul knows which branch and commit he is looking at, so the
 * thing worth testing is not that the string is non-empty but that it is the
 * checkout's own identity and the invocation that actually produced it. The
 * config is loaded from its own path, found from this file rather than from
 * `process.cwd()`, because a wrong cwd would otherwise decide what this test
 * measures. (`import.meta.dirname` and not `new URL(…, import.meta.url)`: Vite
 * rewrites the URL form into a dev-server URL under the jsdom tests — see
 * `page.ts`.)
 */
const config = path.join(import.meta.dirname, "..", "vite.config.ts");
const checkout = path.join(import.meta.dirname, "..", "..", "..");

describe("voice build metadata", () => {
  it.each(["serve", "build"] as const)("records %s and its invocation time", async (command) => {
    const before = Date.now();
    const loaded = await loadConfigFromFile(
      { command, mode: command === "serve" ? "development" : "production" },
      config,
    );
    const after = Date.now();
    const info = JSON.parse(loaded!.config.define!.__VOICE_BUILD_INFO__ as string);
    expect(info.command).toBe(command);
    expect(Date.parse(info.startedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(info.startedAt)).toBeLessThanOrEqual(after);
    expect(info.commit).toBe(execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: checkout, encoding: "utf8" }).trim());
    expect(info.branch).toBe(execFileSync("git", ["branch", "--show-current"], { cwd: checkout, encoding: "utf8" }).trim() || "(detached)");
    expect(info).not.toHaveProperty("version"); // 0.1.0 is not a revision counter.
  });
});
