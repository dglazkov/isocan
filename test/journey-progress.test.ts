import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — the runner helper is a plain .mjs module.
import { walkJourneys, verifyJourneyCheckpoint } from "../scripts/lib/journey-progress.mjs";

const journey = (name: string, run: () => Promise<unknown>) => ({ name, what: `Acme ${name}`, run });
const scratch = () => mkdtempSync(path.join(tmpdir(), "isocan-journey-progress-"));
const load = (file: string) => JSON.parse(readFileSync(file, "utf8"));

describe("durable journey progress", () => {
  it("checkpoints setup, walk, provisional result and cleanup before declaring complete", async () => {
    const dir = scratch(), checkpoint = path.join(dir, "checkpoint.json");
    const states: unknown[] = [];
    try {
      const results = await walkJourneys([journey("one", async () => { states.push(load(checkpoint)); return { measured: 1 }; })], {
        checkpoint,
        rig: async () => {
          states.push(load(checkpoint));
          return { close: async () => { states.push(load(checkpoint)); } };
        },
      });
      expect(states).toMatchObject([
        { complete: false, active: { name: "one", stage: "setup" }, results: [] },
        { complete: false, active: { name: "one", stage: "walk" }, results: [] },
        { complete: false, active: { name: "one", stage: "cleanup" }, results: [{ ok: true, cleanupComplete: false }] },
      ]);
      expect(results[0].cleanupMs).toBeGreaterThanOrEqual(0);
      expect(verifyJourneyCheckpoint(checkpoint)).toMatchObject({ complete: true, failing: 0, active: null, results });
      expect(readdirSync(dir)).toEqual(["checkpoint.json"]);
    } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });

  it.each(["setup", "walk", "cleanup"])("records a %s failure and still walks the next journey", async (stage) => {
    const dir = scratch(), checkpoint = path.join(dir, "checkpoint.json");
    let rigs = 0, closes = 0;
    try {
      const results = await walkJourneys([
        journey("one", async () => { if (stage === "walk") throw new Error("assertion failed"); }),
        journey("two", async () => {}),
      ], {
        checkpoint,
        rig: async () => {
          const first = ++rigs === 1;
          if (first && stage === "setup") throw new Error("setup failed");
          return { close: async () => { closes++; if (first && stage === "cleanup") throw new Error("cleanup failed"); } };
        },
      });
      expect(results).toMatchObject([{ name: "one", ok: false, cleanupComplete: true }, { name: "two", ok: true }]);
      expect(closes).toBe(stage === "setup" ? 1 : 2);
      expect(load(checkpoint)).toMatchObject({ complete: true, failing: 1, active: null });
      expect(() => verifyJourneyCheckpoint(checkpoint)).toThrow("records 1 failing");
    } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });

  it("closes the owned rig even when writing its next checkpoint fails", async () => {
    const dir = scratch(), checkpoint = path.join(dir, "checkpoint.json");
    let closed = false;
    try {
      await expect(walkJourneys([journey("one", async () => {})], {
        checkpoint,
        rig: async () => {
          // Make the next write impossible after a rig has been acquired.
          rmSync(dir, { recursive: true, maxRetries: 5, retryDelay: 100 });
          return { close: async () => { closed = true; } };
        },
      })).rejects.toThrow();
      expect(closed).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });

  it.each(["cleanup", "next-setup", "next-walk"])("survives SIGKILL during %s with the known failure intact", async (hang) => {
    const dir = scratch(), checkpoint = path.join(dir, "checkpoint.json"), script = path.join(dir, "runner.mjs");
    const helper = new URL("../scripts/lib/journey-progress.mjs", import.meta.url).href;
    writeFileSync(script, `import { walkJourneys } from ${JSON.stringify(helper)};
const hang = () => new Promise(() => { setInterval(() => {}, 1000); });
let rigs = 0;
await walkJourneys([
  { name: 'one', what: 'Acme failure', run: async () => { throw new Error('known assertion failure'); } },
  { name: 'two', what: 'Acme second', run: async () => { ${hang === "next-walk" ? "process.send('checkpoint-written'); return hang();" : ""} } },
], { checkpoint: ${JSON.stringify(checkpoint)},
  rig: async () => { if (++rigs === 2 && ${JSON.stringify(hang)} === "next-setup") return hang(); return { close: async () => { ${hang === "cleanup" ? "return hang();" : ""} } }; },
  report: ({ stage, journey }) => { if (${hang === "cleanup" ? "stage === 'cleanup'" : hang === "next-setup" ? "stage === 'setup' && journey.name === 'two'" : "false"}) process.send('checkpoint-written'); },
});`);
    const child = spawn(process.execPath, [script], { stdio: ["ignore", "pipe", "pipe", "ipc"] });
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("fixture did not checkpoint")), 3000);
        child.once("message", () => { clearTimeout(timer); resolve(); });
        child.once("error", (error) => { clearTimeout(timer); reject(error); });
        child.once("exit", () => { clearTimeout(timer); reject(new Error("fixture exited before checkpoint")); });
      });
      child.kill("SIGKILL");
      expect((await exited).signal).toBe("SIGKILL");
      expect(load(checkpoint)).toMatchObject({
        complete: false, failing: 1,
        active: { name: hang === "cleanup" ? "one" : "two", stage: hang === "cleanup" ? "cleanup" : hang === "next-walk" ? "walk" : "setup" },
        results: [{ name: "one", ok: false, why: "known assertion failure", cleanupComplete: hang !== "cleanup" }],
      });
      expect(() => verifyJourneyCheckpoint(checkpoint)).toThrow("incomplete or inconsistent");
    } finally { child.kill("SIGKILL"); await exited; rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });

  it("refuses missing, malformed, inconsistent and unfinished evidence", async () => {
    const dir = scratch(), checkpoint = path.join(dir, "checkpoint.json");
    try {
      expect(() => verifyJourneyCheckpoint(checkpoint)).toThrow();
      writeFileSync(checkpoint, "{"); expect(() => verifyJourneyCheckpoint(checkpoint)).toThrow();
      await walkJourneys([journey("one", async () => {})], { checkpoint, rig: async () => ({ close: async () => {} }) });
      const clean = load(checkpoint);
      for (const changed of [{ complete: false }, { active: { name: "one", stage: "cleanup" } }, { selected: [] }, { failing: 1 }, { results: [] }, { results: [{ ...clean.results[0], cleanupComplete: false }] }]) {
        writeFileSync(checkpoint, JSON.stringify({ ...clean, ...changed }));
        expect(() => verifyJourneyCheckpoint(checkpoint)).toThrow("incomplete or inconsistent");
      }
    } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });
});

// Exercise the shipped CLI orchestration with synthetic journeys instead of
// launching Chrome: machine modes must keep progress off stdout.
it.each(["--json", "--failing", "--only"])("preserves %s output and exit semantics", async (mode) => {
  const dir = scratch(), checkpoint = path.join(dir, "checkpoint.json");
  const source = readFileSync(new URL("../scripts/journeys.mjs", import.meta.url), "utf8");
  const main = source.slice(source.indexOf("async function main()"), source.lastIndexOf("await main();"));
  const lines: string[] = [];
  const argv = mode === "--only" ? [mode, "missing", "--checkpoint", checkpoint] : [mode, "--checkpoint", checkpoint];
  const exit = { code: -1 };
  const invoke = new Function("io", `const { argv, asJson, arg, JOURNEYS, rig, walkJourneys, process, console } = io; ${main}; return main();`);
  try {
    await expect(invoke({ argv, asJson: mode === "--json", arg: (name: string) => { const i = argv.indexOf(name); return i < 0 ? null : argv[i + 1]; },
      JOURNEYS: [journey("one", async () => { throw new Error("known failure"); })],
      rig: async () => ({ close: async () => {} }), walkJourneys,
      process: { pid: process.pid, env: {}, exit: (code: number) => { exit.code = code; throw exit; } },
      console: { log: (value: unknown) => lines.push(String(value)), error: () => {} },
    })).rejects.toBe(exit);
    expect(exit.code).toBe(mode === "--json" ? 1 : mode === "--failing" ? 0 : 2);
    if (mode === "--json") expect(JSON.parse(lines.join("\n"))).toMatchObject({ failing: 1, results: [{ name: "one", ok: false }] });
    else if (mode === "--failing") expect(lines).toEqual(["1"]);
    else { expect(lines).toEqual([]); expect(readdirSync(dir)).toEqual([]); }
  } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
