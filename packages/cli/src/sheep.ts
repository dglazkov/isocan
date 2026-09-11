import { spawn } from "node:child_process";
import { INSTALL_SPEC } from "@isocan/core";
import { readConfigFile } from "@isocan/server";
import type { TurnEvent } from "./acp.ts";
import type { AdapterSpec } from "./harnesses.ts";

/**
 * **`sheep` as a harness — the spike (10 Sep 2026).**
 *
 * The rc's turn is `spawn(adapter) → ensureSession → prompt`, and only the
 * first of those is laptop-shaped. This file gives the rc the same three
 * verbs over the `sheep` command instead of an ACP subprocess: a session is
 * a sheep (a pi session in a cell at a sheep home), `ensureSession` mints
 * one when the row has none, and `prompt` is `sheep attach --wait <id> --
 * <summons>`. The summons text is unchanged, so a sheep and a local adapter
 * receive identical content; the difference is where the turn runs.
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
 * Config (`~/.isocan/config.json`):
 *
 *   "sheep": {
 *     "command": ["node", "/path/to/sheep/packages/cli/bin/sheep.js"],
 *     "kennel": "/path/to/dir/with/.sheep",
 *     "homeAs": "http://host.docker.internal:4441"   // optional: what the cell calls a loopback home
 *   }
 */
export const SHEEP_HARNESS = "sheep";

export interface SheepConfig {
  command: string[];
  kennel: string;
  homeAs?: string;
}

export async function sheepConfig(home: string): Promise<SheepConfig | null> {
  const raw = await readConfigFile<{ sheep?: Partial<SheepConfig> }>(home);
  const cfg = raw.sheep;
  if (!cfg?.command?.length || !cfg.kennel) return null;
  return { command: cfg.command, kennel: cfg.kennel, ...(cfg.homeAs ? { homeAs: cfg.homeAs } : {}) };
}

/** The spec `adapterFor` hands back for the sheep harness. */
export async function sheepAdapter(home: string): Promise<Omit<AdapterSpec, "harness"> | null> {
  const cfg = await sheepConfig(home);
  if (!cfg) return null;
  return { command: cfg.command[0]!, args: cfg.command.slice(1) };
}

/** A loopback home address, said the way a container reaches it. */
export function homeAddressForCell(origin: string, cfg: SheepConfig): string {
  try {
    const url = new URL(origin);
    if (cfg.homeAs && (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1")) {
      const as = new URL(cfg.homeAs);
      url.protocol = as.protocol;
      url.host = as.host;
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    /* fall through */
  }
  return origin;
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
`;

interface Narrate {
  (line: string): void;
}

async function runSheep(
  cfg: SheepConfig,
  args: string[],
  opts: { stdin?: string; onStdout?: (chunk: string) => void; narrate?: Narrate },
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const [cmd, ...pre] = cfg.command;
    const child = spawn(cmd!, [...pre, ...args], {
      cwd: cfg.kennel,
      env: process.env,
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
   * the agent's claim. Called once, only when a pasture is being made. */
  pass: () => Promise<string>;
  canvasTitle: string;
  /** The collab skill's text, put in the pasture as a skill. */
  skill?: string;
}

/** The same three verbs `AcpAgentProcess` has, over `sheep`. */
export class SheepAgent {
  private constructor(
    private readonly cfg: SheepConfig,
    private readonly name: string,
    private readonly narrate: Narrate,
    private readonly birth: SheepBirth,
  ) {}

  static async spawn(
    spec: AdapterSpec,
    opts: { home: string; name: string; narrate?: Narrate; birth: SheepBirth },
  ): Promise<SheepAgent> {
    const cfg = await sheepConfig(opts.home);
    if (!cfg) throw new Error(`harness "${spec.harness}" needs a "sheep" block in config.json`);
    return new SheepAgent(cfg, opts.name, opts.narrate ?? (() => {}), opts.birth);
  }

  private get pasture(): string {
    return `isocan-${this.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  }

  private async sheep(args: string[], opts: Parameters<typeof runSheep>[2] = {}) {
    return runSheep(this.cfg, args, { narrate: this.narrate, ...opts });
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
    }
    // The tree is re-put every birth: cheap, and it keeps the script current.
    const put = async (path: string, body: string) => {
      const r = await this.sheep(["pasture", "put", name, path], { stdin: body });
      if (r.code !== 0) throw new Error(`sheep pasture put ${path} failed: ${r.stderr.trim()}`);
    };
    await put("setup.sh", SETUP_SCRIPT);
    await put("brief.md", BRIEF(this.name, this.birth.canvasTitle));
    if (this.birth.skill) await put("skills/isocan/SKILL.md", this.birth.skill);
    // A pass is single-use and lives fifteen minutes, so it is minted at
    // the moment of birth, and only then.
    const address = await this.birth.pass();
    const secret = await this.sheep(["pasture", "secret", "set", name, "ISOCAN_PASS"], { stdin: `${address}\n` });
    if (secret.code !== 0) throw new Error(`sheep pasture secret set failed: ${secret.stderr.trim()}`);
    return name;
  }

  /** The stored sheep, if it still exists at the home; otherwise a fresh
   * one is born into the agent's pasture with an opening prompt. */
  async ensureSession(_cwd: string, previous: string | null): Promise<{ sessionId: string; resumed: boolean }> {
    if (previous) {
      const ls = await this.sheep(["ls"]);
      if (ls.stdout.split("\n").some((line) => line.split("\t")[0] === previous)) {
        return { sessionId: previous, resumed: true };
      }
      this.narrate(`sheep ${previous} is gone from the home — a new one is born`);
    }
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
    return { sessionId: id, resumed: false };
  }

  /** One turn: the summons goes to the sheep, its reply streams back as
   * chunks, and the exit is the stop. `--wait` queues behind a running
   * turn (the birth's, on a first summons) and streams when it starts. */
  async prompt(
    sessionId: string,
    text: string,
    onEvent?: (event: TurnEvent) => void,
  ): Promise<{ stopReason: string; text: string }> {
    const r = await this.sheep(["attach", "--wait", sessionId, "--", text], {
      onStdout: (chunk) => onEvent?.({ kind: "chunk", text: chunk }),
    });
    return { stopReason: r.code === 0 ? "end_turn" : `sheep exit ${r.code}`, text: r.stdout };
  }

  close(): void {
    /* nothing runs here between turns: the sheep rests in its cell */
  }
}
