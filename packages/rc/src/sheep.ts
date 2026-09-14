import { INSTALL_SPEC } from "@isocan/core";
import type { SheepPlace } from "./rows.ts";
import type { RoomTurnEvent } from "./room.ts";
import { COLLAB_SKILL } from "./skill.ts";

/**
 * **`sheep` as a harness, over commands** (docs/projects/room/design.md,
 * "`SheepAgent` over `SheepCommands`"; the policy is sheep-harness's).
 *
 * The rc's turn is `open → ensureSession → prompt`. This file gives the room
 * those verbs over a sheep home instead of an ACP subprocess: a session is a
 * sheep (a pi session in a cell at a sheep home), `ensureSession` mints one
 * when neither the row nor the pasture's herd has one, and `prompt` is an
 * `attach` that waits its turn. The summons text is unchanged, so a sheep and
 * a local adapter receive identical content; the difference is where the
 * turn runs.
 *
 * What is here is the sheep's policy, written once: a pasture per agent named
 * `isocan-<agent>`, the setup script, the brief and the skill put into it, the
 * pass as the sheep's own secret with the pasture-secret fallback for a home
 * from before, a sheep resumed from the herd before one is born, tool beats
 * read from `attach`'s stream of entries, and withdrawal as `rm` with `abort`
 * for a home from before. How a host reaches a sheep home is not here: it is
 * `SheepCommands`, which the laptop implements over the `sheep` command
 * (`packages/cli/src/sheep.ts`) and another host however it can.
 *
 * The sheep's hands on the canvas are the `isocan` CLI in its container,
 * speaking to the home directly (`isocan setup --direct`), and its identity
 * is a pass the host mints for the agent's own actor. The pass rides into the
 * cell as the sheep's own secret, given at its mint, so it is environment for
 * the pasture's setup script and never in a prompt or a transcript. The
 * redeemed badge lives in `~/.isocan`, and the home keeps a sheep's `~` with
 * the sheep across the containers it rents per command (sheep#6). A home from
 * before that keeps `~` for one container, and there setup links `~/.isocan`
 * into the synced workspace instead, as every sheep born before it already
 * has.
 */
export const SHEEP_HARNESS = "sheep";

/** The name the pass has in a cell: setup's environment, and the secret the
 * sheep is given at its mint. */
const PASS_SECRET = "ISOCAN_PASS";

/** The pasture an agent's sheep are born into: one per agent, named for it.
 * The rc makes it and never removes it — a pasture is the shepherd's. */
function pastureFor(name: string): string {
  return `isocan-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

/** What every fresh container of an isocan sheep runs: the CLI on PATH, the
 * isocan home where the sheep keeps it, and the pass redeemed once. */
const SETUP_SCRIPT = `#!/bin/sh
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

const BRIEF = (name: string, canvasTitle: string): string => `# ${name}

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

/** The part of a pi transcript entry the rc reads: one line of `attach`'s
 * stream. */
export interface SheepEntry {
  id: string;
  timestamp: number;
  type: string;
  message?: { role?: string; content?: unknown };
}

/** The part of a sheep home's listing the rc reads. `secrets` is the names
 * the sheep was minted with; a home or a `sheep` from before per-sheep
 * secrets (sheep#5) lists none, or no field. `setup` is what the pasture's
 * setup is doing in the sheep's container or how it last ended, `null` for a
 * sheep no setup has ever run for (sheep#4); a home from before that has no
 * field. */
export interface SheepRow {
  id: string;
  name: string | null;
  pasture: string | null;
  secrets?: string[];
  setup?: { state: string } | null;
}

/** How an `attach` ended: the turn ran to its end, or it did not, and why. */
export type SheepReply = { ended: true } | { ended: false; why: string };

/** How an `rm` was answered: the sheep ended (and whether a running turn was
 * aborted first), or refused, in the home's own words. */
export type RmAnswer = { ended: true; aborted: boolean } | { ended: false; refusal: string };

/**
 * **A sheep home, as the verbs the rc speaks to it.** Every verb that fails
 * throws, in the host's words, except `rm`, whose refusal is an answer the
 * policy reads, and `pastures`, which lists what it can. `rm` throws only when
 * the home cannot be asked at all.
 */
export interface SheepCommands {
  /** The home's sheep (`sheep ls --json`). */
  sessions(): Promise<SheepRow[]>;
  /** One sheep from the listing, or null when the home no longer lists it. */
  session(id: string): Promise<SheepRow | null>;
  /** The pastures' names (`sheep pasture ls`). */
  pastures(): Promise<string[]>;
  pastureNew(name: string): Promise<void>;
  pasturePut(name: string, path: string, body: string): Promise<void>;
  /** The pasture's own secret (`sheep pasture secret set`). */
  pastureSecret(name: string, key: string, value: string): Promise<void>;
  /** A sheep minted idle, with no prompt, holding `secrets` as its own
   * (`sheep new --detach … --secret`). The new sheep's id; whether it kept
   * the secrets is read from the listing, not from here. */
  mint(opts: { name: string; pasture: string }, secrets: Record<string, string>): Promise<string>;
  /** One turn (`sheep attach --wait --json`): each transcript entry as it
   * lands, then how the turn ended. */
  attach(id: string, text: string, onEntry: (entry: SheepEntry) => void): Promise<SheepReply>;
  rm(id: string): Promise<RmAnswer>;
  /** Stops a running turn (`sheep abort`); true when one was running. */
  abort(id: string): Promise<boolean>;
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
export function assistantText(entry: SheepEntry): string {
  if (entry.type !== "message" || entry.message?.role !== "assistant" || !Array.isArray(entry.message.content)) return "";
  return (entry.message.content as Array<{ type?: string; text?: unknown }>)
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");
}

/** The tool calls in transcript entries, oldest first. */
export function toolCalls(entries: SheepEntry[]): string[] {
  const titles: string[] = [];
  for (const entry of entries) {
    if (entry.type !== "message" || entry.message?.role !== "assistant" || !Array.isArray(entry.message.content)) continue;
    for (const part of entry.message.content as Array<{ type?: string; name?: string; arguments?: unknown }>) {
      if (part.type === "toolCall" && part.name) titles.push(toolTitle(part.name, part.arguments));
    }
  }
  return titles;
}

export interface SheepBirth {
  /** The pass address the sheep redeems — minted by the host, who holds the
   * agent's claim — and the pass's id, which the room keeps on the rc row so
   * withdrawal can ask which badge redeemed it. Called once, only when a
   * sheep is being born. */
  pass: () => Promise<{ address: string; passId: string }>;
  canvasTitle: string;
}

/** The verbs `AcpAgentProcess` has, over a sheep home. */
export class SheepAgent {
  /** The id of the pass minted for the sheep this agent just birthed, or
   * null when `ensureSession` resumed one. The room writes it to the row. */
  bornPass: string | null = null;

  /** Where this agent's sheep live, as the row keeps it; the room writes it
   * back. */
  readonly place: SheepPlace;
  /** The place, said: the address, or which local home. */
  readonly where: string;
  private readonly commands: SheepCommands;
  private readonly name: string;
  private readonly narrate: (line: string) => void;
  private readonly birth: SheepBirth;

  constructor(opts: {
    commands: SheepCommands;
    name: string;
    place: SheepPlace;
    where: string;
    narrate?: (line: string) => void;
    birth: SheepBirth;
  }) {
    this.commands = opts.commands;
    this.name = opts.name;
    this.place = opts.place;
    this.where = opts.where;
    this.narrate = opts.narrate ?? (() => {});
    this.birth = opts.birth;
  }

  private get pasture(): string {
    return pastureFor(this.name);
  }

  /** A pasture per agent, made once; a second birth of the same name finds
   * it. The pass is not here: it is the sheep's own secret, given at the
   * mint. */
  private async ensurePasture(): Promise<string> {
    const name = this.pasture;
    const exists = (await this.commands.pastures()).includes(name);
    if (!exists) {
      this.narrate(`making pasture ${name}`);
      await this.commands.pastureNew(name);
    } else {
      // A pasture outlives its sheep (withdrawal keeps it), so a birth into
      // one that exists is a re-enrolment or a retry, and the sheep is new.
      this.narrate(`pasture ${name} already exists; the sheep born into it is new and does not remember an earlier one`);
    }
    this.narrate(`putting setup.sh, BRIEF.md and the collab skill in pasture ${name}`);
    await this.putTree(name);
    return name;
  }

  /** The pasture's tree: the setup script, the brief and the skill. Put at
   * every turn and not only at the birth — three calls, under a second — so
   * a sheep born under an earlier script or brief runs the current one in
   * its next container, which is how a sheep from before the home kept `~`
   * keeps its badge once the home does. */
  private async putTree(name: string): Promise<void> {
    await this.commands.pasturePut(name, "setup.sh", SETUP_SCRIPT);
    // BRIEF.md, by that name, is in the system prompt of every model call at
    // the home. The birth sends no prompt, so this is how the sheep learns
    // who it is before its first summons.
    await this.commands.pasturePut(name, "BRIEF.md", BRIEF(this.name, this.birth.canvasTitle));
    await this.commands.pasturePut(name, "skills/isocan/SKILL.md", COLLAB_SKILL);
  }

  /** The tree, refreshed for a resumed sheep. A refusal is said, not thrown:
   * the sheep has a tree, and the turn is worth more than a current one. */
  private async refreshTree(): Promise<void> {
    try {
      await this.putTree(this.pasture);
    } catch (err) {
      this.narrate(`pasture ${this.pasture} keeps its earlier setup.sh and brief: ${(err as Error).message}`);
    }
  }

  /**
   * The stored sheep if it still exists at the home; else one already in the
   * agent's pasture, which a row can forget (a row reaped, a machine
   * re-imaged) while the home remembers; else a fresh one, minted idle into
   * the pasture with no prompt, so no model turn is spent. A pass is minted
   * only on that last path, so a sheep that exists is never handed a second
   * one.
   */
  async ensureSession(_cwd: string, previous: string | null): Promise<{ sessionId: string; resumed: boolean }> {
    const sessions = await this.commands.sessions();
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
      // Minted and never asked: its first container is still to come. A home
      // from before sheep#4 has no `setup` field and says nothing.
      if (found.setup === null) {
        this.narrate(
          `sheep ${found.id} has never run setup, so its first container runs it before this summons ` +
            "(installing isocan, about two minutes)",
        );
      }
      await this.refreshTree();
      return { sessionId: found.id, resumed: true };
    }
    if (previous) this.narrate(`sheep ${previous} is gone from ${this.where} — a new one is born`);
    this.narrate(`birthing a sheep for ${this.name} at ${this.where}`);
    const pasture = await this.ensurePasture();
    // A pass is single-use and lives fifteen minutes. The sheep is minted idle
    // and the summons follows at once, so its first command, which rents a
    // container and runs setup, redeems the pass well inside that.
    this.narrate(`minting a pass for ${this.name} — single-use, fifteen minutes, the sheep's own secret, redeemed by its setup`);
    const { address, passId } = await this.birth.pass();
    const id = await this.commands.mint({ name: this.name, pasture }, { [PASS_SECRET]: address });
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
   * took it as its own secret is read from the home's listing, not from the
   * mint's answer: a `sheep` from before `--secret` takes the flag as a stray
   * word, a home from before per-sheep secrets drops the field, and both mint
   * the sheep and exit 0. Such a sheep is used, not ended: it is idle and
   * nothing of it has run, so the pass goes to the pasture's secret of the
   * same name, which setup reads when the sheep's first container starts.
   * That is the phase 1 birth's credential, and it stays in the pasture after
   * it is spent.
   */
  private async passKept(id: string, pasture: string, address: string): Promise<void> {
    const row = await this.commands.session(id);
    if (row?.secrets?.includes(PASS_SECRET)) return;
    try {
      await this.commands.pastureSecret(pasture, PASS_SECRET, address);
    } catch (err) {
      // A sheep with no pass anywhere would be resumed from the herd and fail
      // every turn, so it is ended rather than left.
      await this.commands.rm(id).catch(() => null);
      throw new Error(`sheep ${id} did not keep its pass, and ${(err as Error).message}`);
    }
    this.narrate(
      `${this.where} cannot keep a secret for one sheep (this \`sheep\` or its home predates it), ` +
        `so the pass is pasture ${pasture}'s ${PASS_SECRET} secret instead, and stays there once spent`,
    );
  }

  /**
   * One turn: the summons goes to the sheep, and how the attach ends is the
   * stop. The attach queues behind a turn already running at the cell, and
   * streams the turn's entries as they land (sheep#7): each assistant entry's
   * tool calls become "tool" events, the beat the ACP path produces, and its
   * text a "chunk", so the reply is the assistant's text in the order it was
   * said. Every entry is taken at most once by id; the last assistant entry
   * is written again at the end by a `sheep` from before the stream, and by
   * no other.
   */
  async prompt(
    sessionId: string,
    text: string,
    onEvent?: (event: RoomTurnEvent) => void,
  ): Promise<{ stopReason: string; text: string }> {
    const seen = new Set<string>();
    const said: string[] = [];
    const reply = await this.commands.attach(sessionId, text, (entry) => {
      if (typeof entry?.id !== "string" || seen.has(entry.id)) return;
      seen.add(entry.id);
      for (const title of toolCalls([entry])) onEvent?.({ kind: "tool", detail: title });
      const spoken = assistantText(entry);
      if (spoken) {
        onEvent?.({ kind: "chunk", text: said.length === 0 ? spoken : `\n${spoken}` });
        said.push(spoken);
      }
    });
    return { stopReason: reply.ended ? "end_turn" : reply.why, text: said.join("\n") };
  }

  close(): void {
    /* nothing runs here between turns: the sheep rests in its cell */
  }
}

/**
 * **End a sheep for good** (sheep-harness phase 2) — withdrawal's half at the
 * sheep home, and the one place every withdrawal path comes to.
 *
 * `rm` aborts a running turn, releases the container, and drops the sheep's
 * rows; the pasture stays, and that is said. A refusal is read against the
 * home's own listing rather than its wording, because homes word it
 * differently: a sheep the home no longer lists is already ended (a second
 * withdrawal racing the first), and one it still lists is at a home deployed
 * before sheep's end verb, which gets `abort` and a sentence saying what
 * remains. `where` is the place, said.
 */
export async function endSheep(
  commands: SheepCommands,
  target: { name: string; sessionId: string; where: string },
  narrate: (line: string) => void,
): Promise<void> {
  const { name, sessionId: id, where } = target;
  const kept = () => narrate(`pasture ${pastureFor(name)} stays — it is yours`);
  narrate(`ending sheep ${id} at ${where}`);
  let rm: RmAnswer;
  try {
    rm = await commands.rm(id);
  } catch (err) {
    narrate(`sheep ${id} is still at ${where}: ${(err as Error).message}`);
    return;
  }
  if (rm.ended) {
    if (rm.aborted) narrate("the running turn was aborted first");
    narrate(`sheep ${id} ended — its container and workspace are gone`);
    kept();
    return;
  }
  let listed: boolean | null = null;
  try {
    listed = (await commands.sessions()).some((s) => s.id === id);
  } catch {
    /* no list: unknown */
  }
  if (listed === false) {
    narrate(`sheep ${id} was already ended — ${where} no longer lists it`);
    kept();
    return;
  }
  if (await commands.abort(id).catch(() => false)) narrate("its running turn was aborted");
  narrate(
    listed
      ? `sheep ${id} is still at ${where}: this home cannot end a sheep (sheep rm: ${rm.refusal}); \`sheep ls\` lists it`
      : `sheep ${id} may still be at ${where}: sheep rm refused (${rm.refusal}) and \`sheep ls\` did not answer`,
  );
  kept();
}
