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
 * agent instead. The pass rides into the cell as the sheep's own secret,
 * given at its mint, so it is environment for the pasture's setup script
 * and never in a prompt or a transcript. The redeemed badge lives in
 * `~/.isocan`, and the home keeps a sheep's `~` with the sheep across the
 * containers it rents per command (sheep#6). A home from before that keeps
 * `~` for one container, and there setup links `~/.isocan` into the synced
 * workspace instead, as every sheep born before it already has.
 *
 * While a turn runs, `sheep attach --json` streams the turn's entries as
 * they land (sheep#7), so the face's tool beats come from the one client
 * that holds the turn, and what sheep says on stderr while it holds it —
 * `queued`, and `setup running (1m 40s)` from a home that reports its
 * setup (sheep#4) — is narrated as it comes.
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

/** The name the pass has in a cell: setup's environment, and the secret
 * `sheep new --secret` gives the sheep at its mint. */
export const PASS_SECRET = "ISOCAN_PASS";

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
 * isocan home where the sheep keeps it, and the pass redeemed once. */
export const SETUP_SCRIPT = `#!/bin/sh
set -e
# The badge lands in ~/.isocan. A sheep home keeps ~ (/home/sheep) with the
# sheep across containers; a home from before that keeps ~ for one container
# only, and a sheep born before it has its badge in the synced workspace
# already. In either of those cases ~/.isocan is a link into the workspace.
H="\${HOME:-/root}"
if [ "$H" != /home/sheep ] || [ -d /workspace/.isocan-home ]; then
  mkdir -p /workspace/.isocan-home
  rm -rf "$H/.isocan"
  ln -s /workspace/.isocan-home "$H/.isocan"
fi
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

/** The part of `sheep ls --json`'s rows the rc reads. `secrets` is the
 * names the sheep was minted with; a home or a `sheep` from before
 * per-sheep secrets (sheep#5) lists none, or no field. `setup` is what the
 * pasture's setup is doing in the sheep's container or how it last ended,
 * `null` for a sheep no setup has ever run for (sheep#4); a home from
 * before that has no field. */
interface SheepRow {
  id: string;
  name: string | null;
  pasture: string | null;
  secrets?: string[];
  setup?: { state: string } | null;
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

/** An assistant entry's text, the parts joined; empty for any other entry. */
export function assistantText(entry: PiEntry): string {
  if (entry.type !== "message" || entry.message?.role !== "assistant" || !Array.isArray(entry.message.content)) return "";
  return (entry.message.content as Array<{ type?: string; text?: unknown }>)
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");
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

  /** A pasture per agent, made once; a second birth of the same name finds
   * it. The pass is not here: it is the sheep's own secret, given at the
   * mint. */
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
    this.narrate(`putting setup.sh, BRIEF.md${this.birth.skill ? " and the collab skill" : ""} in pasture ${name}`);
    await this.putTree(name);
    return name;
  }

  /** The pasture's tree: the setup script, the brief and the skill. Put at
   * every turn and not only at the birth — three calls, under a second —
   * so a sheep born under an earlier script or brief runs the current one
   * in its next container, which is how a sheep from before the home kept
   * `~` keeps its badge once the home does. */
  private async putTree(name: string): Promise<void> {
    const put = async (p: string, body: string) => {
      const r = await this.sheep(["pasture", "put", name, p], { stdin: body });
      if (r.code !== 0) throw new Error(`sheep pasture put ${p} failed: ${r.stderr.trim()}`);
    };
    await put("setup.sh", SETUP_SCRIPT);
    // BRIEF.md, by that name, is in the system prompt of every model call
    // at the home. The birth sends no prompt, so this is how the sheep
    // learns who it is before its first summons.
    await put("BRIEF.md", BRIEF(this.name, this.birth.canvasTitle));
    if (this.birth.skill) await put("skills/isocan/SKILL.md", this.birth.skill);
  }

  /** The tree, refreshed for a resumed sheep. A refusal is said, not
   * thrown: the sheep has a tree, and the turn is worth more than a
   * current one. */
  private async refreshTree(): Promise<void> {
    try {
      await this.putTree(this.pasture);
    } catch (err) {
      this.narrate(`pasture ${this.pasture} keeps its earlier setup.sh and brief: ${(err as Error).message}`);
    }
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
   * re-imaged) while the home remembers; else a fresh one, minted idle into
   * the pasture with no prompt, so no model turn is spent. A pass is minted
   * only on that last path, so a sheep that exists is never handed a second
   * one.
   */
  async ensureSession(_cwd: string, previous: string | null): Promise<{ sessionId: string; resumed: boolean }> {
    const sessions = await this.sessions();
    if (previous && sessions.some((s) => s.id === previous)) {
      await this.refreshTree();
      return { sessionId: previous, resumed: true };
    }
    const herd = sessions.filter((s) => s.pasture === this.pasture);
    const found = herd.find((s) => s.name === this.name) ?? herd[0];
    if (found) {
      this.narrate(
        `sheep ${found.id} is already in pasture ${this.pasture}` +
          `${previous ? ` (the row named ${previous}, which the home no longer has)` : ""} — resuming it rather than birthing a second`,
      );
      // Minted and never asked: its first container is still to come. A
      // home from before sheep#4 has no `setup` field and says nothing.
      if (found.setup === null) {
        this.narrate(
          `sheep ${found.id} has never run setup, so its first container runs it before this summons ` +
            "(installing isocan, about two minutes)",
        );
      }
      await this.refreshTree();
      return { sessionId: found.id, resumed: true };
    }
    if (previous) this.narrate(`sheep ${previous} is gone from ${describePlace(this.place)} — a new one is born`);
    this.narrate(`birthing a sheep for ${this.name} at ${describePlace(this.place)}`);
    const pasture = await this.ensurePasture();
    // A pass is single-use and lives fifteen minutes. The sheep is minted
    // idle and the summons follows at once, so its first command, which
    // rents a container and runs setup, redeems the pass well inside that.
    this.narrate(`minting a pass for ${this.name} — single-use, fifteen minutes, the sheep's own secret, redeemed by its setup`);
    const { address, passId } = await this.birth.pass();
    const born = await this.sheep(
      ["new", "--detach", "--name", this.name, "--pasture", pasture, "--secret", PASS_SECRET],
      { stdin: `${address}\n` },
    );
    if (born.code !== 0) throw new Error(`sheep new failed: ${born.stderr.trim()}`);
    const id = born.stdout.split("\n")[0]?.trim();
    if (!id) throw new Error(`sheep new printed no id: ${born.stderr.trim()}`);
    this.bornPass = passId;
    await this.passKept(id, pasture, address);
    this.narrate(
      `sheep ${id} minted — no turn spent; its first container runs setup before this summons ` +
        "(installing isocan, about two minutes)",
    );
    return { sessionId: id, resumed: false };
  }

  /**
   * Makes sure the new sheep's setup will find the pass. Whether the sheep
   * took it as its own secret is read from the home's listing, not from
   * `sheep new`'s answer: a `sheep` from before `--secret` takes the flag
   * as a stray word, a home from before per-sheep secrets drops the field,
   * and both mint the sheep and exit 0. Such a sheep is used, not ended: it
   * is idle and nothing of it has run, so the pass goes to the pasture's
   * secret of the same name, which setup reads when the sheep's first
   * container starts. That is the phase 1 birth's credential, and it stays
   * in the pasture after it is spent.
   */
  private async passKept(id: string, pasture: string, address: string): Promise<void> {
    const row = (await this.sessions()).find((s) => s.id === id);
    if (row?.secrets?.includes(PASS_SECRET)) return;
    const secret = await this.sheep(["pasture", "secret", "set", pasture, PASS_SECRET], { stdin: `${address}\n` });
    if (secret.code !== 0) {
      // A sheep with no pass anywhere would be resumed from the herd and
      // fail every turn, so it is ended rather than left.
      await this.sheep(["rm", id], { narrate: () => {} }).catch(() => null);
      throw new Error(`sheep ${id} did not keep its pass, and sheep pasture secret set failed: ${secret.stderr.trim()}`);
    }
    this.narrate(
      `${describePlace(this.place)} cannot keep a secret for one sheep (this \`sheep\` or its home predates it), ` +
        `so the pass is pasture ${pasture}'s ${PASS_SECRET} secret instead, and stays there once spent`,
    );
  }

  /**
   * One turn: the summons goes to the sheep, and the exit is the stop.
   * `--wait` queues behind a turn already running at the cell. `--json`
   * streams the turn's entries as they land, one pi entry per line
   * (sheep#7): each assistant entry's tool calls become "tool" events, the
   * beat the ACP path produces, and its text a "chunk", so the reply is
   * the assistant's text in the order it was said. Nothing else is read
   * while the turn runs. What sheep says on stderr while it holds the turn
   * — `queued`, and `setup running (1m 40s)` from a home that reports its
   * setup (sheep#4) — reaches the narration as it comes; a home from before
   * that says nothing of setup, and neither does the rc.
   */
  async prompt(
    sessionId: string,
    text: string,
    onEvent?: (event: TurnEvent) => void,
  ): Promise<{ stopReason: string; text: string }> {
    const seen = new Set<string>();
    const said: string[] = [];
    const take = (line: string) => {
      if (!line.trim()) return;
      let entry: PiEntry;
      try {
        entry = JSON.parse(line) as PiEntry;
      } catch {
        return;
      }
      // Every entry is written at most once by id; the last assistant
      // entry is written again at the end by a `sheep` from before the
      // stream, and by no other.
      if (typeof entry?.id !== "string" || seen.has(entry.id)) return;
      seen.add(entry.id);
      for (const title of toolCalls([entry])) onEvent?.({ kind: "tool", detail: title });
      const spoken = assistantText(entry);
      if (spoken) {
        onEvent?.({ kind: "chunk", text: said.length === 0 ? spoken : `\n${spoken}` });
        said.push(spoken);
      }
    };
    let pending = "";
    const r = await this.sheep(["attach", "--wait", "--json", sessionId, "--", text], {
      onStdout: (chunk) => {
        pending += chunk;
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) take(line);
      },
    });
    take(pending);
    return { stopReason: r.code === 0 ? "end_turn" : `sheep exit ${r.code}`, text: said.join("\n") };
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
