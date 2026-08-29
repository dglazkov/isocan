import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * **A stream read without an encoding will one day eat a character.**
 *
 * `out += chunk` on a raw stream concatenates BUFFERS onto a string, decoding
 * each one alone. A UTF-8 character split across a chunk boundary becomes two
 * half-characters, and lands as `���`.
 *
 * It is the perfect flake: whether it fires depends on where the OS chose to
 * split the stream, which depends on how busy the machine is. It passed here
 * every time and failed on CI, on a 61KB guide, with exactly ONE em-dash
 * mangled out of dozens:
 *
 *     - prints — and opens — the address of that ONE item
 *     + prints — and opens ��� the address of that ONE item
 *
 * It had been recorded as "the flake family" for a week. It is not the whole
 * family — the daemon-and-HTTP ones are a separate animal — but it is one
 * member of it caught and named, which is more than a rerun ever produces.
 *
 * The fix is one line per stream, and it is not a workaround:
 * `setEncoding("utf8")` puts a `StringDecoder` in the way, which holds a
 * partial character back until its bytes arrive. `cli/src/main.ts` already
 * does this when it reads stdin — the tests had not copied the idiom.
 */
const roots = ["packages/cli/test", "packages/server/test", "packages/web/test", "packages/core/test", "test"];
const repo = fileURLToPath(new URL("..", import.meta.url));

describe("every stream that is read as text says so first", () => {
  it("has no chunk concatenated onto a string without an encoding", () => {
    const offenders: string[] = [];
    for (const root of roots) {
      let files: string[] = [];
      try {
        files = readdirSync(`${repo}${root}`, { recursive: true, encoding: "utf8" });
      } catch {
        continue; // a package without tests is not a failure
      }
      for (const rel of files) {
        if (!rel.endsWith(".ts")) continue;
        const lines = readFileSync(`${repo}${root}/${rel}`, "utf8").split("\n");
        lines.forEach((line, i) => {
          const reads = /\.on\("data", \((?:chunk|data)\) => \(\w+ \+= (?:chunk|data)\)\)/.test(line);
          if (!reads) return;
          // The encoding must be set on the SAME stream, and the honest place
          // for that is the line before — near enough to read as one act.
          const before = lines[i - 1] ?? "";
          if (!/setEncoding\("utf8"\)/.test(before)) {
            offenders.push(`${root}/${rel}:${i + 1} — ${line.trim()}`);
          }
        });
      }
    }
    expect(
      offenders,
      "setEncoding(\"utf8\") on the stream first, or a split character comes back as ���",
    ).toEqual([]);
  });

  it("shows what the bug actually is, so the rule is not folklore", () => {
    // Three lines, and the whole CI failure. Kept because a guard whose
    // reason nobody can reproduce becomes a rule people route around.
    const em = Buffer.from("opens — the", "utf8");
    const split = 7; // mid-em-dash: it is three bytes starting at 6
    let concatenated = "";
    concatenated += em.subarray(0, split);
    concatenated += em.subarray(split);
    expect(concatenated).toBe("opens ��� the");
    expect(Buffer.concat([em.subarray(0, split), em.subarray(split)]).toString("utf8")).toBe(
      "opens — the",
    );
  });
});
