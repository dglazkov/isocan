import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Reporter, TestModule, Vitest, TestRunEndReason } from "vitest/node";
import { filteredRun } from "./deep.ts";
import { laneOf, record } from "./timings.ts";

/**
 * **Every run records itself, because a habit is not a measurement.**
 *
 * Wired into `vitest.config.ts` beside the default reporter, so there is no
 * command to remember and no flag to pass: `npm test`, `npm run test:deep`,
 * `npm run test:ci`, a CI shard and one filtered file on a laptop all leave
 * the same line behind. `scripts/timings.mjs` reads them back.
 *
 * A reporter rather than a wrapper script for exactly that reason. Wrapping
 * `npm test` would measure the runs that go through the wrapper and miss every
 * bare `npx vitest`, which is most of what an agent actually types — and the
 * runs you forget to measure are the ones that tell you what is slow.
 *
 * It reports nothing to the screen. The default reporter already prints a
 * duration; this one is only here to remember it.
 */
export default class TimingReporter implements Reporter {
  private started = 0;
  private ctx!: Vitest;
  private revision: string | undefined;
  private dirty: boolean | undefined;

  onInit(ctx: Vitest): void {
    this.started = Date.now();
    this.ctx = ctx;
    try {
      this.revision = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: ctx.config.root, encoding: "utf8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      this.dirty = Boolean(execFileSync("git", ["status", "--porcelain"], {
        cwd: ctx.config.root, encoding: "utf8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"],
      }).trim());
    } catch { /* A non-git fixture can still report timings. */ }
  }

  onTestRunEnd(testModules: ReadonlyArray<TestModule> = [], errors: ReadonlyArray<unknown> = [], reason?: TestRunEndReason): void {
    try {
      const config = this.ctx.config;
      const shard = config.shard;
      const entry = {
        at: new Date().toISOString(),
        lane: laneOf(),
        ...(shard ? { shard: `${shard.index}/${shard.count}` } : {}),
        filtered: filteredRun() || Boolean(config.testNamePattern || config.changed || config.related?.length),
        files: testModules.length,
        tests: testModules.reduce((total, mod) => total + Array.from(mod.children.allTests()).length, 0),
        failed: testModules.filter((mod) => !mod.ok()).length,
        ms: Date.now() - this.started,
        ...(this.revision ? { revision: this.revision } : {}),
        ...(this.dirty === undefined ? {} : { dirty: this.dirty }),
        ...(process.env.GITHUB_RUN_ID ? { ciRun: `${process.env.GITHUB_RUN_ID}.${process.env.GITHUB_RUN_ATTEMPT ?? "1"}` } : {}),
        node: process.version,
        platform: `${process.platform}/${process.arch}`,
        workers: config.maxWorkers,
      };
      const dir = path.join(config.root, ".isocan");
      record(entry, path.join(dir, "timings.jsonl"));
      mkdirSync(dir, { recursive: true });
      // One artifact per CI runner, kept even for failures. Never read as a
      // partition input in this run; refresh the committed snapshot explicitly.
      writeFileSync(path.join(dir, "test-profile.json"), JSON.stringify({
        ...entry, reason, errors: errors.length,
        fileDurations: testModules.map((mod) => ({
          file: path.relative(config.root, mod.moduleId).split(path.sep).join("/"),
          ms: Math.round(mod.diagnostic().duration),
          passed: mod.ok(),
        })).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0),
      }, null, 2) + "\n");
    } catch {
      /* Never the reason a suite goes red — see `test/timings.ts`. */
    }
  }
}
