import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));

/**
 * **A fake key must not look like a real one** (lessons.md #107).
 *
 * Secret scanners match by SHAPE: a provider's prefix and length. A test key
 * written to look real — `AIzaSy` and thirty-five characters, say — is
 * reported as a leaked credential, and every report is a person stopping to
 * prove a fixture is a fixture. On 2 Oct 2026 a "Secrets detected" alert did
 * exactly that for the keys project's tests, none of which held a real key.
 *
 * So a fake key is plainly fake: `fake-gemini-…`, `sk-ant-fake_…`. The
 * `sk-ant-` prefix is allowed because `textProviderFor` reads it to choose
 * Claude, but never followed by a body as long as a real key's.
 *
 * The patterns are assembled from pieces so this file does not match itself.
 */
const SHAPES: [string, RegExp][] = [
  ["Google API key", new RegExp("AI" + "za[0-9A-Za-z_-]{35}")],
  ["Anthropic key", new RegExp("sk-" + "ant-(api|admin)\\d\\d-")],
  ["Anthropic-length key", new RegExp("sk-" + "ant-[A-Za-z0-9_-]{40,}")],
  ["OpenAI key", new RegExp("sk-" + "(proj-)?[A-Za-z0-9]{40,}")],
  ["GitHub token", new RegExp("(gh" + "[pousr]_[A-Za-z0-9]{30,}|github" + "_pat_[A-Za-z0-9_]{30,})")],
  ["AWS access key", new RegExp("AK" + "IA[0-9A-Z]{16}")],
  ["Slack token", new RegExp("xo" + "x[abprs]-[0-9]{6,}-")],
  ["private key", new RegExp("-----BEGIN [A-Z ]*PRIV" + "ATE KEY-----")],
];

describe("no file in the repository holds a credential-shaped string", () => {
  it("every tracked text file is free of real key shapes", () => {
    const files = execFileSync("git", ["ls-files", "-z"], { cwd: repo, encoding: "utf8", timeout: 30_000 })
      .split("\0")
      .filter(Boolean)
      // Lockfiles carry integrity hashes, not keys; binaries are not text.
      .filter((f) => !/(^|\/)package-lock\.json$|\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|mp3|wav|webm|mp4|pdf|zip|gz)$/i.test(f));
    const found: string[] = [];
    for (const file of files) {
      let text: string;
      try {
        text = readFileSync(path.join(repo, file), "utf8");
      } catch {
        continue; // deleted in the working tree, or a submodule
      }
      text.split("\n").forEach((line, i) => {
        for (const [name, shape] of SHAPES) {
          if (shape.test(line)) found.push(`${file}:${i + 1} looks like a ${name}`);
        }
      });
    }
    expect(found, "use a plainly fake value — `fake-gemini-…`, `sk-ant-fake_…` — never a real-looking one").toEqual([]);
  });

  it("would catch the shape that was reported", () => {
    // Without this, a typo in a pattern makes the guard above pass on anything.
    const reported = "AI" + "zaSyTESTONLY" + "0".repeat(28);
    expect(SHAPES.some(([, shape]) => shape.test(reported))).toBe(true);
    expect(SHAPES.some(([, shape]) => shape.test("sk-ant-fake_CLI_DO_NOT_PRINT_wxyz"))).toBe(false);
    expect(SHAPES.some(([, shape]) => shape.test("fake-gemini-acme_CLI_DO_NOT_PRINT_1234567890gemi"))).toBe(false);
  });
});
