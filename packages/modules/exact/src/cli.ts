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
    .description("Exact apps on the canvas: check this machine's Exact, lay an app out as a flow map, and keep it true as you save (runs your Exact here)");

  exact
    .command("doctor [app]")
    .description("This machine's Exact for an app: the checkout and its commit, Bun against Exact's pin, setup --check, and Tamber's protocol")
    .option("--hosts <list>", "the hosts to check setup for, comma-separated", "web")
    .action(host.run(async (app: string | undefined, opts: { hosts?: string }, cmd: Command) => (await run()).doctor(host, app, opts, cmd)));

  const capture = (c: Command) => c
    .option("--canvas <canvas>")
    .option("--devices <list>", "the device row to capture: phone, tablet, desktop", "phone,tablet,desktop")
    .option("--schemes <list>", "light, dark", "light,dark")
    .option("--param <name=value>", "a route parameter's value for a screen with no exact.shots yet (repeatable); unnamed ones are 1", (v: string, all: string[] = []) => [...all, v])
    .option("--force", "capture every screen even where nothing it depends on moved")
    .option("--hosts <list>", "where to capture: web, ios, macos (the web draws every device; iOS a simulator's phone, macOS a window)", "web")
    .option("--sim <udid>", "the iOS simulator to capture and drive on — one you made for this (`xcrun simctl create`), never a booted one somebody else may own");

  capture(exact
    .command("open <app>")
    .description("Lay an Exact app out as a flow map: its index, a screen per route at phone, tablet and desktop in light and dark, the arrows its router can take, its design system and an anatomy card per Contract file"))
    .action(host.run(async (app: string, opts: import("./cli-run.ts").CaptureOptions, cmd: Command) => (await run()).open(host, app, opts, cmd)));

  capture(exact
    .command("live <app>")
    .description("Open the map, then keep it true: re-index on every save, recapture only what the save could change, post a version only where pixels moved; compile errors and agent check findings become comments; and serve live frames to a paired browser on this machine"))
    .option("--max-passes <n>", "stop after this many passes after the first (default: run until ctrl-c)")
    .option("--quiet-ms <ms>", "how long the files must be still before a pass", "400")
    .option("--no-frames", "no dev loop and no bridge: captures, comments and versions only — nothing a browser can connect to")
    .option("--no-checks", "skip agent check both on recaptured routes (compile errors are still comments)")
    .option("--bridge-port <port>", "the bridge's loopback port, the first number of the pairing code (default: a free one)")
    .option("--design-port <port>", "Exact Design's port, for Open in Exact Design", "5173")
    .action(host.run(async (app: string, opts: import("./cli-run.ts").LiveOptions, cmd: Command) => (await run()).live(host, app, opts, cmd)));

  exact
    .command("wall <app> <route>")
    .description("A device wall: one route's screens on every host and device on this canvas, side by side, kept up to date by open and live")
    .option("--canvas <canvas>")
    .option("--scheme <scheme>", "light or dark", "light")
    .action(host.run(async (app: string, route: string, opts: { scheme?: string }, cmd: Command) => (await run()).wall(host, app, route, opts, cmd)));

  exact
    .command("check <app>")
    .description("The compiler's diagnostics and agent check both, as comments on the screens they concern (each with exact.source), resolved when gone; says moved where a comment's file changed")
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
