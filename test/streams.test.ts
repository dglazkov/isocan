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

/**
 * **The other half of the flake family, and what is honestly known about it.**
 *
 * The split-character bug above is one member, caught and fixed with proof.
 * The rest — `fetch failed` in a test that runs two daemons, a badge that
 * will not vouch, two writers racing — are NOT diagnosed. Recorded here
 * rather than in a commit message nobody will find, because the next person
 * to see one should start from what is known instead of from scratch.
 *
 * What is known, 29 Aug 2026:
 *
 * - Seven failures in seven different files over a week, always in tests that
 *   spin up a daemon, and every one of them passing in isolation afterwards.
 * - NOT reproducible on demand: four consecutive full runs green, including
 *   one under twenty spinners on fourteen cores. CPU oversubscription alone
 *   does not do it, which kills the most obvious hypothesis.
 * - NOT a shared test home: every suite uses `mkdtemp`.
 * - NOT port collision by construction: `test/ports.ts` gives each worker a
 *   private slice below every ephemeral floor, and probes `bindable()` first.
 * - The suite is KNOWN to be load-sensitive in a different way — `testTimeout`
 *   was raised from 5s to 30s after five tests failed at 5.0–5.5s under 24×
 *   oversubscription, which is written up in `vitest.config.ts`.
 *
 * The lead worth following next: the failures cluster in tests that run TWO
 * daemons and have one talk to the other (`grants`, `pass`, `rehome`,
 * `home`), which is the most timing-sensitive shape in the suite.
 */
describe("the next fetch failure will explain itself", () => {
  it("says which request, which syscall, and how long it tried", () => {
    // `TypeError: fetch failed` names no address, no code and no duration —
    // the least useful sentence this suite can produce, and the reason seven
    // sightings could never be told apart.
    const setup = readFileSync(fileURLToPath(new URL("./setup.ts", import.meta.url)), "utf8");
    const giveUp = setup.slice(setup.indexOf("const where ="), setup.indexOf("throw err;", setup.indexOf("const where =")));
    expect(giveUp, "the address").toMatch(/\$\{where\}/);
    expect(giveUp, "the syscall and code").toMatch(/cause\?\.syscall/);
    expect(giveUp, "how long, and how many tries").toMatch(/gave up after \$\{took\}ms/);
  });
});
