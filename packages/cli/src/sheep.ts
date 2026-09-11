import { spawn } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { INSTALL_SPEC } from "@isocan/core";
import { readConfigFile } from "@isocan/server";
import type { TurnEvent } from "./acp.ts";
import type { AdapterSpec } from "./harnesses.ts";

/**
 * **`sheep` as a harness** (the spike, 10 Sep 2026; the harness proper,
 * phase 1).
 *
 * The rc's turn is `spawn(adapter) → ensureSession → prompt`, and only the
 * first of those is laptop-shaped. This file gives the rc the same three
 * verbs over the `sheep` command instead of an ACP subprocess: a session is
 * a sheep (a pi session in a cell at a sheep home), `ensureSession` mints
 * one when neither the row nor the pasture's herd has one, and `prompt` is
 * `sheep attach --wait <id> -- <summons>`. The summons text is unchanged,
 * so a sheep and a local adapter receive identical content; the difference
 * is where the turn runs.
 *
 * The sheep's hands on the canvas are the `isocan` CLI in its container,
 * speaking to the home directly (`isocan setup --direct`), and its
 * identity is a pass the rc mints for the agent's own actor — the same
 * pass that puts a person's second machine on a canvas, minted for the
 * agent instead. The pass rides into the cell as a pasture secret, so it
 * is environment for the pasture's setup script and never in a prompt or
 * a transcript. The redeemed badge lives in the synced workspace
 * (`/workspace/.isocan-home`, symlinked from `~/.isocan`) so it outlives
 * the container, which the home rents per command.
 *
 * Nothing here is configured by hand. `sheep` is found on the PATH, and
 * which home its sessions live at is sheep's own rule — the kennel, a
 * `.sheep/` at or above the directory, else `~/.sheep` — walked from the
 * agent's directory at birth and then carried on the rc row, so a summons
 * from anywhere resumes the same sheep at the same home. The one thing a
 * scan cannot know is what a cell calls this machine, and only a local
 * sheep home ever needs it: `config.json`'s `loopbackFromCell`, which
 * defaults to Docker's `host.docker.internal` on the daemon's own port.
 */
export const SHEEP_HARNESS = "sheep";

/** The line that puts `sheep` on a machine that has none. */
export const SHEEP_INSTALL = "npm install -g github:dglazkov/sheep#release";

/** Where an agent's sheep live: the kennel sheep reads, and the home that
 * kennel named at birth — an address, or `local` for the home under the
 * kennel itself, whose port changes with every start. */
export interface SheepPlace {
  kennel: string;
  home: string;
}

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

/** The pasture an agent's sheep are born into: one per agent, named for it.
 * The rc makes it and never removes it — a pasture is the shepherd's. */
export function pastureFor(name: string): string {
  return `isocan-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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

/** What every fresh container of an isocan sheep runs: the CLI on PATH, the
 * home directory in the synced workspace, and the pass redeemed once. */
export const SETUP_SCRIPT = `#!/bin/sh
set -e
mkdir -p /workspace/.isocan-home
rm -rf /root/.isocan
ln -s /workspace/.isocan-home /root/.isocan
if ! command -v isocan >/dev/null 2>&1; then
  echo "setup: installing isocan" >&2
  npm install -g ${INSTALL_SPEC} --no-audit --no-fund >/tmp/isocan-install.log 2>&1 || { tail -20 /tmp/isocan-install.log >&2; exit 1; }
fi
if [ ! -f /workspace/.isocan/project.json ]; then
  if [ -z "$ISOCAN_PASS" ]; then echo "setup: no ISOCAN_PASS and no binding" >&2; exit 1; fi
  echo "setup: redeeming the pass" >&2
  cd /workspace && isocan setup --direct --no-open --no-install "$ISOCAN_PASS" >&2
fi
isocan whoami >&2 || true
`;

export const BRIEF = (name: string, canvasTitle: string): string => `# ${name}

You are ${name}, an agent enrolled on the isocan canvas "${canvasTitle}".
You run in a cell; your workspace is /workspace and the \`isocan\` command
in your shell speaks to the canvas's home directly. You are already
identified: \`isocan whoami\` says who you are, and every op you run
appears on the canvas live.

Each prompt you receive is a summons: activity addressed to you. Address it
through the CLI (\`isocan --agent-help\` is the protocol; \`isocan comment
reply <threadId> "…"\` answers a comment), and then stop. Never run
\`isocan wait\`: your session rests when your turn ends, and the next
summons wakes you.

The first command after a quiet spell can take a couple of minutes: the
cell's container was released, and a fresh one runs setup (installing
isocan) before your command runs. Wait for it. If a command fails because
the container could not start, do not sleep and retry: if \`isocan\` still
answers, say on the thread that the cell could not start its container,
and end your turn.
`;

/** The home's idle period: a cell quiet this long has had its container
 * released, so the next command rents a fresh one and setup runs first.
 * The station's default; the home does not say which it uses. */
export const QUIET_MS = 10 * 60_000;

/** How often a running turn's transcript is read for tool calls. */
const TOOL_POLL_MS = 3_000;

interface Narrate {
  (line: string): void;
}

/** The part of a pi transcript entry the rc reads. */
interface PiEntry {
  id: string;
  timestamp: number;
  type: string;
  message?: { role?: string; content?: unknown };
}

/** The part of `sheep ls --json`'s rows the rc reads. */
interface SheepRow {
  id: string;
  name: string | null;
  pasture: string | null;
}

/**
 * A tool call from a pi transcript, said the way an ACP title reads: the
 * tool, then its first string argument (a command, a path). The face's
 * inferred status is this line.
 */
export function toolTitle(name: string, args: unknown): string {
  const first =
    args && typeof args === "object"
      ? Object.values(args as Record<string, unknown>).find((v): v is string => typeof v === "string" && v.trim() !== "")
      : undefined;
  return first ? `${name} ${first.split("\n")[0]!.trim()}` : name;
}

/** The tool calls in transcript entries, oldest first. */
export function toolCalls(entries: PiEntry[]): string[] {
  const titles: string[] = [];
  for (const entry of entries) {
    if (entry.type !== "message" || entry.message?.role !== "assistant" || !Array.isArray(entry.message.content)) continue;
    for (const part of entry.message.content as Array<{ type?: string; name?: string; arguments?: unknown }>) {
      if (part.type === "toolCall" && part.name) titles.push(toolTitle(part.name, part.arguments));
    }
  }
  return titles;
}

function parseLines<T>(stdout: string): T[] {
  const out: T[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      /* not an entry */
    }
  }
  return out;
}

function ago(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} hour${hours === 1 ? "" : "s"}` : `${Math.round(hours / 24)} days`;
}

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
      child.stdin!.end(opts.stdin);
    }
  });
}

export interface SheepBirth {
  /** The pass address the sheep redeems — minted by the caller, who holds
   * the agent's claim — and the pass's id, which the caller keeps on the rc
   * row so withdrawal can ask which badge redeemed it. Called once, only
   * when a sheep is being born. */
  pass: () => Promise<{ address: string; passId: string }>;
  canvasTitle: string;
  /** Where the canvas lives, as this machine reaches it: a station cannot
   * reach a loopback one. */
  canvasOrigin: string;
  /** The collab skill's text, put in the pasture as a skill. */
  skill?: string;
}

/** The same three verbs `AcpAgentProcess` has, over `sheep`. */
export class SheepAgent {
  /** The id of the pass minted for the sheep this agent just birthed, or
   * null when `ensureSession` resumed one. The caller writes it to the row. */
  bornPass: string | null = null;

  private constructor(
    private readonly command: string[],
    /** Where this agent's sheep live — the row's, or the directory's kennel
     * for a first birth. The caller writes it back to the row. */
    readonly place: SheepPlace,
    private readonly name: string,
    private readonly narrate: Narrate,
    private readonly birth: SheepBirth,
  ) {}

  /**
   * Refuses, in one sentence naming both homes, what cannot work: a
   * kennel with no home, a kennel re-pointed since the sheep was born, and
   * a station asked to reach a canvas on this machine's daemon. An
   * enrolment is an offer and another machine may honour it, so all three
   * are said at the summons and never at `rc add`.
   */
  static async spawn(
    spec: AdapterSpec,
    opts: { name: string; cwd: string; stored?: SheepPlace | null; narrate?: Narrate; birth: SheepBirth },
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
    return new SheepAgent([spec.command, ...spec.args], place, name, opts.narrate ?? (() => {}), birth);
  }

  private get pasture(): string {
    return pastureFor(this.name);
  }

  private async sheep(args: string[], opts: Parameters<typeof runSheep>[3] = {}) {
    return runSheep(this.command, this.place, args, { narrate: this.narrate, ...opts });
  }

  /** A pasture per agent: the setup script, the brief, the skill, and the
   * pass as a secret. Made once; a second birth of the same name finds it. */
  private async ensurePasture(): Promise<string> {
    const name = this.pasture;
    const listed = await this.sheep(["pasture", "ls"]);
    const exists = listed.stdout.split("\n").some((line) => line.split("\t")[0] === name);
    if (!exists) {
      this.narrate(`making pasture ${name}`);
      const made = await this.sheep(["pasture", "new", name]);
      if (made.code !== 0) throw new Error(`sheep pasture new failed: ${made.stderr.trim()}`);
    } else {
      // A pasture outlives its sheep (withdrawal keeps it), so a birth into
      // one that exists is a re-enrolment or a retry, and the sheep is new.
      this.narrate(`pasture ${name} already exists; the sheep born into it is new and does not remember an earlier one`);
    }
    // The tree is re-put every birth: cheap, and it keeps the script current.
    this.narrate(`putting setup.sh, brief.md${this.birth.skill ? " and the collab skill" : ""} in pasture ${name}`);
    const put = async (p: string, body: string) => {
      const r = await this.sheep(["pasture", "put", name, p], { stdin: body });
      if (r.code !== 0) throw new Error(`sheep pasture put ${p} failed: ${r.stderr.trim()}`);
    };
    await put("setup.sh", SETUP_SCRIPT);
    await put("brief.md", BRIEF(this.name, this.birth.canvasTitle));
    if (this.birth.skill) await put("skills/isocan/SKILL.md", this.birth.skill);
    // A pass is single-use and lives fifteen minutes, so it is minted at
    // the moment of birth, and only then.
    this.narrate(`minting a pass for ${this.name} — single-use, fifteen minutes, redeemed by the pasture's setup`);
    const { address, passId } = await this.birth.pass();
    const secret = await this.sheep(["pasture", "secret", "set", name, "ISOCAN_PASS"], { stdin: `${address}\n` });
    if (secret.code !== 0) throw new Error(`sheep pasture secret set failed: ${secret.stderr.trim()}`);
    this.bornPass = passId;
    return name;
  }

  private async sessions(): Promise<SheepRow[]> {
    const ls = await this.sheep(["ls", "--json"]);
    if (ls.code !== 0) throw new Error(`sheep ls failed at ${describePlace(this.place)}: ${ls.stderr.trim()}`);
    try {
      return JSON.parse(ls.stdout) as SheepRow[];
    } catch {
      throw new Error(`sheep ls --json printed no list: ${ls.stdout.slice(0, 200)}`);
    }
  }

  /**
   * The stored sheep if it still exists at the home; else one already in
   * the agent's pasture, which a row can forget (a row reaped, a machine
   * re-imaged) while the home remembers; else a fresh one, born into the
   * pasture with an opening prompt. A pass is minted only on that last
   * path, so a sheep that exists is never handed a second one.
   */
  async ensureSession(_cwd: string, previous: string | null): Promise<{ sessionId: string; resumed: boolean }> {
    const sessions = await this.sessions();
    if (previous && sessions.some((s) => s.id === previous)) {
      return { sessionId: previous, resumed: true };
    }
    const herd = sessions.filter((s) => s.pasture === this.pasture);
    const found = herd.find((s) => s.name === this.name) ?? herd[0];
    if (found) {
      this.narrate(
        `sheep ${found.id} is already in pasture ${this.pasture}` +
          `${previous ? ` (the row named ${previous}, which the home no longer has)` : ""} — resuming it rather than birthing a second`,
      );
      return { sessionId: found.id, resumed: true };
    }
    if (previous) this.narrate(`sheep ${previous} is gone from ${describePlace(this.place)} — a new one is born`);
    this.narrate(`birthing a sheep for ${this.name} at ${describePlace(this.place)}`);
    const pasture = await this.ensurePasture();
    const born = await this.sheep([
      "new",
      "--detach",
      "--name",
      this.name,
      "--pasture",
      pasture,
      "--",
      `You are ${this.name}. Read /pasture/brief.md, run \`isocan whoami\` to confirm who you are, and reply with one line saying you are ready.`,
    ]);
    if (born.code !== 0) throw new Error(`sheep new failed: ${born.stderr.trim()}`);
    const id = born.stdout.split("\n")[0]?.trim();
    if (!id) throw new Error(`sheep new printed no id: ${born.stderr.trim()}`);
    this.narrate(
      `sheep ${id} born — its opening prompt spends one model turn, and its first container runs setup ` +
        "before anything else (installing isocan, about two minutes); a summons waits behind both",
    );
    return { sessionId: id, resumed: false };
  }

  /** The transcript from an entry on (or its last entry, with no `since`). */
  private async entries(sessionId: string, since?: string): Promise<PiEntry[]> {
    const r = await this.sheep(["log", "--json", ...(since ? ["--since", since] : ["--last", "1"]), sessionId], {
      narrate: () => {},
    });
    return r.code === 0 ? parseLines<PiEntry>(r.stdout) : [];
  }

  /**
   * One turn: the summons goes to the sheep, its reply streams back as
   * chunks, and the exit is the stop. `--wait` queues behind a running
   * turn (the birth's, on a first summons) and streams when it starts.
   *
   * `sheep attach` streams only the reply's text, so the tool beats come
   * from the transcript, read every few seconds while the turn runs and
   * once more when it ends: each tool call becomes a "tool" event, the
   * same beat the ACP path produces. Before the turn, the transcript's
   * last entry says how long the cell has been quiet — past the home's
   * idle period its container is gone and setup runs first, which the rc
   * says as the guess it is.
   */
  async prompt(
    sessionId: string,
    text: string,
    onEvent?: (event: TurnEvent) => void,
  ): Promise<{ stopReason: string; text: string }> {
    const last = (await this.entries(sessionId)).at(-1);
    if (last && Date.now() - last.timestamp > QUIET_MS) {
      this.narrate(
        `the cell has been quiet for ${ago(Date.now() - last.timestamp)}, so its container is probably fresh and ` +
          "setup is probably running first (installing isocan, about two minutes) — a guess from the clock; the home does not say",
      );
    }
    let cursor = last?.id ?? new Date(Date.now() - 5_000).toISOString();
    const seen = new Set<string>();
    const readTools = async () => {
      const fresh = (await this.entries(sessionId, cursor)).filter((e) => !seen.has(e.id));
      for (const e of fresh) seen.add(e.id);
      if (fresh.length > 0) cursor = fresh.at(-1)!.id;
      for (const title of toolCalls(fresh)) onEvent?.({ kind: "tool", detail: title });
    };
    let stop = () => {};
    const stopped = new Promise<false>((resolve) => (stop = () => resolve(false)));
    const tick = () =>
      new Promise<true>((resolve) => {
        setTimeout(() => resolve(true), TOOL_POLL_MS).unref?.();
      });
    const poller = (async () => {
      while (await Promise.race([stopped, tick()])) await readTools().catch(() => {});
    })();
    try {
      const r = await this.sheep(["attach", "--wait", sessionId, "--", text], {
        onStdout: (chunk) => onEvent?.({ kind: "chunk", text: chunk }),
      });
      return { stopReason: r.code === 0 ? "end_turn" : `sheep exit ${r.code}`, text: r.stdout };
    } finally {
      stop();
      await poller;
      await readTools().catch(() => {});
    }
  }

  close(): void {
    /* nothing runs here between turns: the sheep rests in its cell */
  }
}

/**
 * **End a sheep for good** (sheep-harness phase 2) — withdrawal's half at
 * the sheep home, and the one place every withdrawal path comes to.
 *
 * `sheep rm --json` aborts a running turn, releases the container, and drops
 * the sheep's rows; the pasture stays, and that is said. A refusal is read
 * against the home's own listing rather than its wording, because homes
 * word it differently: a sheep the home no longer lists is already ended
 * (a second withdrawal racing the first), and one it still lists is at a
 * home deployed before sheep's end verb, which gets `sheep abort` and a
 * sentence saying what remains. Run beside the row's kennel, by
 * `runSheep`'s rules, never beside the directory's.
 */
export async function endSheep(
  target: { name: string; sessionId: string; place: SheepPlace },
  narrate: Narrate,
  command: string[] = [SHEEP_HARNESS],
): Promise<void> {
  const { name, sessionId: id, place } = target;
  const where = describePlace(place);
  const quiet = { narrate: () => {} };
  const kept = () => narrate(`pasture ${pastureFor(name)} stays — it is yours`);
  narrate(`ending sheep ${id} at ${where}`);
  let rm: Awaited<ReturnType<typeof runSheep>>;
  try {
    rm = await runSheep(command, place, ["rm", "--json", id], quiet);
  } catch (err) {
    narrate(
      `sheep ${id} is still at ${where}: \`sheep\` would not run here (${(err as Error).message}) — ` +
        `${SHEEP_INSTALL}, then \`sheep rm ${id}\` in ${path.dirname(place.kennel)}`,
    );
    return;
  }
  if (rm.code === 0) {
    let aborted = false;
    try {
      aborted = (JSON.parse(rm.stdout) as { aborted?: unknown }).aborted === true;
    } catch {
      /* a plain `<id>\tended` says as much */
    }
    if (aborted) narrate("the running turn was aborted first");
    narrate(`sheep ${id} ended — its container and workspace are gone`);
    kept();
    return;
  }
  const refusal = rm.stderr.trim().replace(/^sheep:\s*/, "") || `exit ${rm.code}`;
  const ls = await runSheep(command, place, ["ls", "--json"], quiet).catch(() => null);
  let listed: boolean | null = null;
  if (ls?.code === 0) {
    try {
      listed = (JSON.parse(ls.stdout) as SheepRow[]).some((s) => s.id === id);
    } catch {
      /* no list: unknown */
    }
  }
  if (listed === false) {
    narrate(`sheep ${id} was already ended — ${where} no longer lists it`);
    kept();
    return;
  }
  const abort = await runSheep(command, place, ["abort", id], quiet).catch(() => null);
  if (abort?.code === 0 && /\taborted\b/.test(abort.stdout)) narrate("its running turn was aborted");
  narrate(
    listed
      ? `sheep ${id} is still at ${where}: this home cannot end a sheep (sheep rm: ${refusal}); \`sheep ls\` lists it`
      : `sheep ${id} may still be at ${where}: sheep rm refused (${refusal}) and \`sheep ls\` did not answer`,
  );
  kept();
}
