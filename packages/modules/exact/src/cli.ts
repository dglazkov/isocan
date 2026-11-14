/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import guideText from "../agent-guide.md";
import type { Command } from "commander";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import * as record from "./core.ts";

/**
 * **`isocan exact`, registered** (exact phases 0–1). Every verb's work lives
 * in `cli-run.ts`, imported when the verb runs: this file is read at every
 * CLI start-up, and the map, the capture loop and the index builder have no
 * business on `isocan --version`'s path (`test/cli-bundle.test.ts`).
 */
const run = async () => {
  const verbs = await import("./cli-run.ts");
  verbs.bindCore(record);
  return verbs;
};

function register(host: CliHost): void {
  const exact = host.program
    .command("exact")
    .description("Exact apps on the canvas: a flow map kept true as you save (runs your Exact here)");

  exact
    .command("doctor [app]")
    .description("This machine's Exact for an app: checkout, commit, Bun, setup --check, Tamber's protocol")
    .option("--hosts <list>", "the hosts to check setup for, comma-separated", "web")
    .action(host.run(async (app: string | undefined, opts: { hosts?: string }, cmd: Command) => (await run()).doctor(host, app, opts, cmd)));

  const capture = (c: Command) => c
    .option("--canvas <canvas>")
    .option("--devices <list>", "the device row to capture: phone, tablet, desktop", "phone,tablet,desktop")
    .option("--schemes <list>", "light, dark", "light,dark")
    .option("--param <name=value>", "a route parameter for a screen with no exact.shots (repeatable; default 1)", (v: string, all: string[] = []) => [...all, v])
    .option("--force", "capture every screen even where nothing it depends on moved")
    .option("--hosts <list>", "where to capture: web, ios, macos", "web")
    .option("--sim <udid>", "an iOS simulator you made for this (`xcrun simctl create`), never a booted one");

  capture(exact
    .command("open <app>")
    .description("Lay an Exact app out as a flow map: index, screens per route and device, arrows, design system, anatomy"))
    .action(host.run(async (app: string, opts: import("./cli-run.ts").CaptureOptions, cmd: Command) => (await run()).open(host, app, opts, cmd)));

  capture(exact
    .command("live <app>")
    .description("Open the map, then keep it true on every save; findings as comments; live frames, drives and proposals for a paired browser"))
    .option("--max-passes <n>", "stop after this many passes after the first (default: run until ctrl-c)")
    .option("--quiet-ms <ms>", "how long the files must be still before a pass", "400")
    .option("--no-frames", "no dev loop and no bridge: nothing a browser can connect to")
    .option("--no-checks", "skip agent check (compile errors are still comments)")
    .option("--bridge-port <port>", "the bridge's loopback port (default: a free one)")
    .option("--design-port <port>", "Exact Design's port, for Open in Exact Design", "5173")
    .action(host.run(async (app: string, opts: import("./cli-run.ts").LiveOptions, cmd: Command) => (await run()).live(host, app, opts, cmd)));

  exact
    .command("wall <app> <route>")
    .description("A device wall: one route on every host and device, side by side")
    .option("--canvas <canvas>")
    .option("--scheme <scheme>", "light or dark", "light")
    .action(host.run(async (app: string, route: string, opts: { scheme?: string }, cmd: Command) => (await run()).wall(host, app, route, opts, cmd)));

  const where = (c: Command) => c
    .option("--canvas <canvas>")
    .option("--host <host>", "web, ios or macos", "web")
    .option("--device <device>", "phone, tablet or desktop (the web's)", "phone")
    .option("--scheme <scheme>", "light or dark", "light")
    .option("--sim <udid>", "for iOS: a simulator you made for this, by UDID");

  where(exact
    .command("film <app> <route>")
    .description("Film an interaction against Exact's virtual clock: a scrubbable APNG with the state at every frame"))
    .option("--do <op>", "the interaction first: tap <testId>, type <testId> \"<text>\" or back (repeatable)", (v: string, all: string[] = []) => [...all, v])
    .option("--over <ms>", "how long to film", "600")
    .option("--every <ms>", "the clock step between frames", "16")
    .option("--watch <testId>", "a node whose layout is read at every frame")
    .option("--out <file>", "also write the APNG here")
    .action(host.run(async (app: string, route: string, opts: import("./cli-run.ts").FilmOptions, cmd: Command) => (await run()).film(host, app, route, opts, cmd)));

  where(exact
    .command("inspect <app> <route>")
    .description("A route's screen as a cold driver sees it: tree --ax, layout, perf and logs"))
    .action(host.run(async (app: string, route: string, opts: { host?: string }, cmd: Command) => (await run()).inspect(host, app, route, opts, cmd)));

  exact
    .command("moment <film> <ms> <words...>")
    .description("Comment on a film at a moment, in ms; opening it scrubs the strip there")
    .option("--canvas <canvas>")
    .action(host.run(async (film: string, ms: string, words: string[], _opts: unknown, cmd: Command) => (await run()).moment(host, film, ms, words, cmd)));

  exact
    .command("run <app> <test>")
    .description("Run a test's storyboard with Exact's test runner on each host, a frame per step, each run a version")
    .option("--canvas <canvas>")
    .option("--hosts <list>", "web, ios, macos", "web")
    .option("--sim <udid>", "for iOS: a simulator you made for this")
    .option("--file <file>", "the *.test.contract, when two files have the test")
    .action(host.run(async (app: string, test: string, opts: import("./stories.ts").RunOptions, cmd: Command) => (await run()).runTest(host, app, test, opts, cmd)));

  exact
    .command("verify <app>")
    .description("Exact's verify on web and iOS, its screenshots as versions of their screens")
    .option("--canvas <canvas>")
    .option("--hosts <list>", "web, ios", "web")
    .option("--sim <udid>", "for iOS: a simulator you made for this")
    .action(host.run(async (app: string, opts: { hosts?: string; sim?: string }, cmd: Command) => (await run()).verifyApp(host, app, opts, cmd)));

  const repeat = (v: string, all: string[] = []) => [...all, v];
  exact
    .command("propose <screen>")
    .description("Propose a look change to a screen; only a person's Keep writes it")
    .option("--token <name=value>", "set a token (repeatable)", repeat)
    .option("--row <Style.row=value>", "set a style's row (repeatable)", repeat)
    .option("--op <json>", "a Tamber set-token, set-row or set-state (repeatable)", repeat)
    .option("--why <words>", "why, two sentences at most")
    .option("--cites <kind:ref>", "what prompted it (repeatable)", repeat)
    .option("--in <area>", "hang it in this area (a competition lane)")
    .option("--wait <seconds>", "wait for the pictures (0: no)", "540")
    .option("--canvas <canvas>")
    .action(host.run(async (screen: string, opts: import("./proposals.ts").ProposeOptions, cmd: Command) => (await run()).propose(host, screen, opts, cmd)));

  exact
    .command("branch <app> <ref>")
    .description("Capture a git ref or worktree's screens in a staging copy, beside the current ones")
    .option("--canvas <canvas>")
    .option("--hosts <list>", "web, ios", "web")
    .option("--sim <udid>")
    .option("--devices <list>", "", "phone")
    .option("--schemes <list>", "", "light")
    .action(host.run(async (app: string, ref: string, opts: import("./branch.ts").BranchOptions, cmd: Command) => (await run()).branch(host, app, ref, opts, cmd)));

  exact
    .command("check <app>")
    .description("Compiler diagnostics and agent check findings as comments on their screens, resolved when gone")
    .option("--canvas <canvas>")
    .option("--no-checks", "only the compiler's diagnostics")
    .action(host.run(async (app: string, opts: { checks?: boolean }, cmd: Command) => (await run()).check(host, app, opts, cmd)));
}

export const exactCli: CliModule = {
  core: record.exactModule,
  register,
  guide: guideText,
};

export default exactCli;
