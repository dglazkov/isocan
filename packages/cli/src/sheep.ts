import { spawn } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readConfigFile } from "@isocan/server";
import {
  SHEEP_HARNESS,
  SheepAgent,
  type RmAnswer,
  type SheepBirth,
  type SheepCommands,
  type SheepEntry,
  type SheepPlace,
  type SheepRow,
} from "@isocan/rc";
import type { AdapterSpec } from "./harnesses.ts";

/**
 * **`sheep` as a harness, on this machine** (the spike, 10 Sep 2026; the
 * harness proper, sheep-harness phase 1; the policy moved into `isocan/rc` in
 * the room's phase 2).
 *
 * What a sheep is to the rc — a pasture per agent, the setup script, the
 * brief, the pass as the sheep's own secret, a sheep resumed from the herd
 * before one is born, the beats from `attach`'s stream, withdrawal as `rm`
 * with `abort` for a home from before — is `SheepAgent` and `endSheep` in
 * `packages/rc/src/sheep.ts`, over `SheepCommands`. What stays here is the
 * laptop's half: where a sheep home is on this machine, and the commands
 * spoken to it by spawning `sheep`.
 *
 * Nothing here is configured by hand. `sheep` is found on the PATH, and which
 * home its sessions live at is sheep's own rule — the kennel, a `.sheep/` at
 * or above the directory, else `~/.sheep` — walked from the agent's directory
 * at birth and then carried on the rc row, so a summons from anywhere resumes
 * the same sheep at the same home. The one thing a scan cannot know is what a
 * cell calls this machine, and only a local sheep home ever needs it:
 * `config.json`'s `loopbackFromCell`, which defaults to Docker's
 * `host.docker.internal` on the daemon's own port.
 */
export { SHEEP_HARNESS };

/** The transcript readers, where `sheep.test.ts` has always found them. */
export { assistantText, toolCalls, toolTitle } from "@isocan/rc";

/** The line that puts `sheep` on a machine that has none. */
const SHEEP_INSTALL = "npm install -g github:dglazkov/sheep#release";

/** Where an agent's sheep live — the type is the room module's, because the
 * rc row carries one; finding it on this machine stays here. */
export type { SheepPlace } from "@isocan/rc";

/**
 * The kennel for a directory, by sheep's own rule: the first `.sheep/` at
 * or above `from`, else `<homeDir>/.sheep`, whether or not it exists. Pure
 * over `isDir`, so a table can walk it.
 */
export function findKennel(from: string, homeDir: string, isDir: (p: string) => boolean): string {
  let current = path.resolve(from);
  for (;;) {
    const candidate = path.join(current, ".sheep");
    if (isDir(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.join(homeDir, ".sheep");
}

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** The home a kennel's config names — `local`, an address, or null when it
 * names none. The token beside it is sheep's and is never read. */
export function kennelHome(kennel: string): string | null {
  try {
    const cfg = JSON.parse(readFileSync(path.join(kennel, "config"), "utf8")) as { home?: unknown; local?: unknown };
    if (cfg.local === true) return "local";
    return typeof cfg.home === "string" && cfg.home ? cfg.home : null;
  } catch {
    return null;
  }
}

/** Where a directory's sheep would live today, or null when its kennel
 * names no home. */
export function sheepPlaceFor(cwd: string, env: NodeJS.ProcessEnv = process.env): SheepPlace | null {
  const kennel = findKennel(cwd, env.HOME || os.homedir(), isDirectory);
  const home = kennelHome(kennel);
  return home ? { kennel, home } : null;
}

/** A place, said: the address, or which local home. */
export function describePlace(place: SheepPlace): string {
  return place.home === "local" ? `the local sheep home in ${path.dirname(place.kennel)}` : place.home;
}

/** A place said with its kennel, for the scan's table and the rc's start. */
export function placeLine(place: SheepPlace): string {
  return place.home === "local" ? describePlace(place) : `${place.home} (kennel ${place.kennel})`;
}

function isLoopback(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "[::1]" || host === "::1";
  } catch {
    return false;
  }
}

/** A loopback home address, said the way a container reaches it. Anything
 * else is already an address a cell can use. */
export function homeAddressForCell(origin: string, loopbackFromCell?: string): string {
  if (!isLoopback(origin)) return origin;
  const url = new URL(origin);
  if (loopbackFromCell) {
    const as = new URL(loopbackFromCell);
    url.protocol = as.protocol;
    url.host = as.host;
  } else {
    url.hostname = "host.docker.internal";
  }
  return url.toString().replace(/\/$/, "");
}

export async function loopbackFromCell(isocanHome: string): Promise<string | undefined> {
  const raw = await readConfigFile<{ loopbackFromCell?: string }>(isocanHome);
  return typeof raw.loopbackFromCell === "string" && raw.loopbackFromCell ? raw.loopbackFromCell : undefined;
}

/** Why an agent on the sheep harness cannot run here: no `sheep`. */
export function noSheepLine(name: string): string {
  return (
    `${name} names sheep, and this machine has no \`sheep\` on its PATH — ${SHEEP_INSTALL}, ` +
    "then `sheep home local` or `sheep home join <address>` for a home"
  );
}

type Narrate = (line: string) => void;

async function runSheep(
  command: string[],
  place: SheepPlace,
  args: string[],
  opts: { stdin?: string; onStdout?: (chunk: string) => void; narrate?: Narrate },
): Promise<{ code: number; stdout: string; stderr: string }> {
  // The kennel is the whole rule: run where it is found, and never let a
  // SHEEP_HOME in the person's environment send the rc to another home.
  const env = { ...process.env };
  delete env.SHEEP_HOME;
  delete env.SHEEP_TOKEN;
  return new Promise((resolve, reject) => {
    const [cmd, ...pre] = command;
    const child = spawn(cmd!, [...pre, ...args], {
      cwd: path.dirname(place.kennel),
      env,
      stdio: [opts.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout!.setEncoding("utf8");
    child.stderr!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => {
      out += chunk;
      opts.onStdout?.(chunk);
    });
    let pending = "";
    child.stderr!.on("data", (chunk: string) => {
      err += chunk;
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) opts.narrate?.(line);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (pending.trim()) opts.narrate?.(pending);
      resolve({ code: code ?? 1, stdout: out, stderr: err });
    });
    if (opts.stdin !== undefined) {
      // A `sheep` that does not read stdin (one from before `new --secret`)
      // can exit before the write lands; that is its answer, not a crash.
      child.stdin!.on("error", () => {});
      child.stdin!.end(opts.stdin);
    }
  });
}

/**
 * **`SheepCommands` over the `sheep` command**, run beside the place's kennel
 * with `SHEEP_HOME` and `SHEEP_TOKEN` stripped. What sheep says on stderr
 * while it works — `queued`, and `setup running (1m 40s)` from a home that
 * reports its setup (sheep#4) — reaches `narrate` as it comes; `rm` and
 * `abort` are always quiet, and a withdrawal passes no `narrate` at all.
 */
export function sheepCommands(place: SheepPlace, opts: { command?: string[]; narrate?: Narrate } = {}): SheepCommands {
  const command = opts.command ?? [SHEEP_HARNESS];
  const narrate = opts.narrate ?? (() => {});
  const sheep = (args: string[], more: Parameters<typeof runSheep>[3] = {}) =>
    runSheep(command, place, args, { narrate, ...more });
  const quiet = { narrate: () => {} };
  const sessions = async (): Promise<SheepRow[]> => {
    const ls = await sheep(["ls", "--json"]);
    if (ls.code !== 0) throw new Error(`sheep ls failed at ${describePlace(place)}: ${ls.stderr.trim()}`);
    try {
      return JSON.parse(ls.stdout) as SheepRow[];
    } catch {
      throw new Error(`sheep ls --json printed no list: ${ls.stdout.slice(0, 200)}`);
    }
  };
  return {
    sessions,
    session: async (id) => (await sessions()).find((s) => s.id === id) ?? null,
    pastures: async () => (await sheep(["pasture", "ls"])).stdout.split("\n").map((line) => line.split("\t")[0]!),
    pastureNew: async (name) => {
      const made = await sheep(["pasture", "new", name]);
      if (made.code !== 0) throw new Error(`sheep pasture new failed: ${made.stderr.trim()}`);
    },
    pasturePut: async (name, p, body) => {
      const r = await sheep(["pasture", "put", name, p], { stdin: body });
      if (r.code !== 0) throw new Error(`sheep pasture put ${p} failed: ${r.stderr.trim()}`);
    },
    pastureSecret: async (name, key, value) => {
      const r = await sheep(["pasture", "secret", "set", name, key], { stdin: `${value}\n` });
      if (r.code !== 0) throw new Error(`sheep pasture secret set failed: ${r.stderr.trim()}`);
    },
    mint: async ({ name, pasture }, secrets) => {
      // One line of stdin per `--secret` name, in order.
      const keys = Object.keys(secrets);
      const born = await sheep(
        ["new", "--detach", "--name", name, "--pasture", pasture, ...keys.flatMap((k) => ["--secret", k])],
        keys.length > 0 ? { stdin: keys.map((k) => `${secrets[k]}\n`).join("") } : {},
      );
      if (born.code !== 0) throw new Error(`sheep new failed: ${born.stderr.trim()}`);
      const id = born.stdout.split("\n")[0]?.trim();
      if (!id) throw new Error(`sheep new printed no id: ${born.stderr.trim()}`);
      return id;
    },
    attach: async (id, text, onEntry) => {
      // One pi entry per line (sheep#7); a line that is not one is skipped.
      const take = (line: string) => {
        if (!line.trim()) return;
        let entry: SheepEntry;
        try {
          entry = JSON.parse(line) as SheepEntry;
        } catch {
          return;
        }
        onEntry(entry);
      };
      let pending = "";
      const r = await sheep(["attach", "--wait", "--json", id, "--", text], {
        onStdout: (chunk) => {
          pending += chunk;
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";
          for (const line of lines) take(line);
        },
      });
      take(pending);
      return r.code === 0 ? { ended: true } : { ended: false, why: `sheep exit ${r.code}` };
    },
    rm: async (id): Promise<RmAnswer> => {
      let rm: Awaited<ReturnType<typeof runSheep>>;
      try {
        rm = await runSheep(command, place, ["rm", "--json", id], quiet);
      } catch (err) {
        throw new Error(
          `\`sheep\` would not run here (${(err as Error).message}) — ` +
            `${SHEEP_INSTALL}, then \`sheep rm ${id}\` in ${path.dirname(place.kennel)}`,
        );
      }
      if (rm.code !== 0) return { ended: false, refusal: rm.stderr.trim().replace(/^sheep:\s*/, "") || `exit ${rm.code}` };
      let aborted = false;
      try {
        aborted = (JSON.parse(rm.stdout) as { aborted?: unknown }).aborted === true;
      } catch {
        /* a plain `<id>\tended` says as much */
      }
      return { ended: true, aborted };
    },
    abort: async (id) => {
      const r = await runSheep(command, place, ["abort", id], quiet);
      return r.code === 0 && /\taborted\b/.test(r.stdout);
    },
  };
}

/** What a sheep's birth needs on this machine: the module's, and where the
 * canvas lives as this machine reaches it, since a station cannot reach a
 * loopback one. */
export type CellBirth = SheepBirth & { canvasOrigin: string };

/**
 * **The module's `SheepAgent`, for a row on this machine.** Refuses, in one
 * sentence naming both homes, what cannot work: a kennel with no home, a
 * kennel re-pointed since the sheep was born, and a station asked to reach a
 * canvas on this machine's daemon. An enrolment is an offer and another
 * machine may honour it, so all three are said at the summons and never at
 * `rc add`.
 */
export async function openSheep(
  spec: AdapterSpec,
  opts: { name: string; cwd: string; stored?: SheepPlace | null; narrate?: Narrate; birth: CellBirth },
): Promise<SheepAgent> {
  const { name, birth } = opts;
  const kennel = opts.stored?.kennel ?? findKennel(opts.cwd, process.env.HOME || os.homedir(), isDirectory);
  const home = kennelHome(kennel);
  if (!home) {
    throw new Error(
      `${name}'s sheep have no home: the kennel at ${kennel} names none — ` +
        `\`sheep home local\` or \`sheep home join <address>\` in ${path.dirname(kennel)}`,
    );
  }
  const place = { kennel, home };
  if (opts.stored && opts.stored.home !== home) {
    throw new Error(
      `${name}'s sheep live at ${describePlace(opts.stored)}, and the kennel at ${kennel} now names ` +
        `${describePlace(place)} — point the kennel back, or withdraw and re-enrol ${name} to start over at the new home`,
    );
  }
  if (home !== "local" && isLoopback(birth.canvasOrigin)) {
    throw new Error(
      `${name}'s sheep live at ${home}, a station, which cannot reach "${birth.canvasTitle}" on this ` +
        `machine's daemon (${birth.canvasOrigin}) — move the canvas to a home with an address, or make the ` +
        `sheep home a local one (\`sheep home local\` in ${path.dirname(kennel)})`,
    );
  }
  return new SheepAgent({
    commands: sheepCommands(place, { command: [spec.command, ...spec.args], ...(opts.narrate ? { narrate: opts.narrate } : {}) }),
    name,
    place,
    where: describePlace(place),
    ...(opts.narrate ? { narrate: opts.narrate } : {}),
    birth: { pass: birth.pass, canvasTitle: birth.canvasTitle },
  });
}
