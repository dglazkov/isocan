/**
 * **The voice agent, as a command — one entry point, two ways in.**
 *
 * There is deliberately only one of these. A person starts the agent with a
 * command they can remember (`npm start -w @isocan/voice-agent`, or
 * `npx voice-agent`), and `isocan rc` starts *the same file* with `--acp` when
 * a summons arrives. Two entry points would mean two things that had to agree
 * about the port, the home, the identity and the page, and the day they drifted
 * is the day the summons opened a second microphone nobody was talking into.
 *
 * What each mode is:
 *
 * - **no flags — the standing server.** Claims who this microphone is, opens
 *   the page, captures audio, holds the key and the operations. It lives as
 *   long as the person wants it to, which is the point: a microphone is not a
 *   turn.
 * - **`--acp`** — the adapter the rc spawns. It speaks ACP over stdio and hands
 *   a summons to the standing server, starting one detached if none is up. It
 *   prints nothing on stdout but JSON-RPC.
 *
 * This used to be a verb of the CLI (`isocan voice`), and the reason it is not
 * any more is the same reason the page is not a route of the web app: neither
 * the app nor the CLI needs to know how the voice agent works in order to
 * point at it. `isocan rc` points at it, through the harness registry, exactly
 * as it points at pi or Claude Code.
 */
import { resolveCanvas, resolveCanvasRef, resolveCtx } from "@isocan/api";
import { readRcAgents } from "./rc-rows.ts";
import {
  DEFAULT_VOICE_PORT,
  VOICE_HARNESS,
  claimVoiceIdentity,
  enrolmentForVoice,
  isocanHome,
  readVoiceIdentity,
  runVoiceAdapter,
  startVoiceServer,
} from "./voice-harness.ts";

export interface VoiceArgs {
  acp: boolean;
  help: boolean;
  /** The agent the microphone speaks as, else the injected session, else Voice. */
  name?: string;
  port?: number;
  /** The daemon port to connect to, when not the default. */
  daemonPort?: number;
  /** The Live model for this run; wins over the choice stored by the page. */
  model?: string;
  /** The canvas to send to; else `ISOCAN_CANVAS`, else this directory's. */
  canvas?: string;
}

/** What `--help` prints, and what an unknown flag is refused with — the same
 * list, so the two cannot drift apart. */
export const USAGE = [
  "voice-agent — the isocan voice agent: a harness and the page you talk to",
  "",
  "  voice-agent                     the standing server: page, microphone, operations",
  "  voice-agent --acp               speak ACP on stdio — what `isocan rc` spawns",
  "                                  (--port and --model belong to the run, not to it)",
  "",
  "  --as <name>                     the agent the microphone speaks as (default:",
  "                                  the injected session, else Voice)",
  `  --port <n>                      the loopback port the page is served on (default ${DEFAULT_VOICE_PORT})`,
  "  --daemon-port <n>               the daemon port to connect to",
  "  --model <name>                  the Gemini Live model this run talks through",
  "  --canvas <ref>                  the canvas to send to (default: this directory's)",
  "",
  "The harness is reached through `isocan rc`: it starts this file with --acp on a",
  "summons, attaches to a standing one if there is one, and starts one if not.",
].join("\n");

/** The flags, spelled once. `--port` and `--voice-port` are the same thing:
 * the detached server and the docs name it differently, and a second spelling
 * is cheaper than a flag that silently does nothing. */
export function parseVoiceArgs(argv: readonly string[]): VoiceArgs {
  const args: VoiceArgs = { acp: false, help: false };
  const need = (i: number, flag: string): string => {
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) throw new Error(`${flag} needs a value`);
    return next;
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!;
    if (flag === "--acp") { args.acp = true; continue; }
    if (flag === "--help" || flag === "-h") { args.help = true; continue; }
    if (flag === "--as" || flag === "--name") { args.name = need(i, flag); i++; continue; }
    if (flag === "--port" || flag === "--voice-port") {
      const raw = need(i, flag);
      const port = Number(raw);
      if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`${flag} needs a port number, got "${raw}"`);
      args.port = port;
      i++;
      continue;
    }
    if (flag === "--daemon-port") {
      const raw = need(i, flag);
      const port = Number(raw);
      if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`${flag} needs a port number, got "${raw}"`);
      args.daemonPort = port;
      i++;
      continue;
    }
    if (flag === "--model") { args.model = need(i, flag); i++; continue; }
    if (flag === "--canvas") { args.canvas = need(i, flag); i++; continue; }
    throw new Error(`unknown flag "${flag}"\n\n${USAGE}`);
  }
  return args;
}

/**
 * **What this harness is called when nobody said.**
 *
 * The order matters, and `ISOCAN_SESSION_ID` is deliberately not in it. It used
 * to be the name — `agent:<name>` was the key, so the session the rc injected
 * WAS the agent's name. It is not any more: the rc injects the machine key
 * (`agent:<mac>`, `agent-key.ts`), whose session half is a MAC and not a word
 * anybody answers to, and a harness that read it as a name would ask the desk
 * for an actor called `hfLOA8VWETJXrYl3xCqLqu1rlUyvRHxF`.
 *
 * So: the record first (it survives a rename, which is the whole reason the
 * record exists), then the enrolment record — the row `isocan rc add` wrote,
 * which names the canvas and the actor the rc will summon — and only then the
 * default, which is what a first run on a fresh machine gets. `--as` wins over
 * all of it, because a person typing a name is asking for it.
 */
async function voiceName(home: string, canvas?: string): Promise<string> {
  const remembered = await readVoiceIdentity(home).catch(() => null);
  if (remembered?.name) return remembered.name;
  const rows = await readRcAgents(home).catch(() => []);
  // No name hint: the row decides — the single voice row standing on this
  // canvas (or on any canvas, when the environment names none).
  const row = enrolmentForVoice(rows, { name: "", ...(canvas ? { canvas } : {}) });
  return row?.name ?? "Voice";
}

/**
 * **The conversation a summons injected, spelled the way a key is.**
 *
 * The rc hands a turn `ISOCAN_HARNESS=agent` and `ISOCAN_SESSION_ID=<mac>` —
 * the halves of `agent:<mac>`, this machine's key (`agent-key.ts`) — plus
 * `ISOCAN_CANVAS`. Read as a key rather than as a name, because that is what
 * it is; nothing here knows what the agent is called, and the daemon does.
 */
function injectedKey(): string | null {
  const session = process.env.ISOCAN_SESSION_ID;
  if (!session) return null;
  const harness = process.env.ISOCAN_HARNESS ?? "isocan";
  return `${harness}:${session}`;
}

/**
 * **The standing server, started here rather than through the CLI.**
 *
 * Everything it needs it resolves itself, the way the harness already resolves
 * its own canvas and identity: `connect()` reads the same home, the same
 * daemon and the same ambient session key every other client does, so a
 * harness started by a person and one started by the rc speak as the same
 * collaborator when they are given the same identity.
 */
export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const args = parseVoiceArgs(argv);
  if (args.help) {
    console.log(USAGE);
    return;
  }
  const home = isocanHome();
  const canvas = args.canvas ?? process.env.ISOCAN_CANVAS;
  const say = (line: string) => console.log(`voice: ${line}`);
  const name = args.name ?? (await voiceName(home, canvas));

  if (args.acp) {
    // **The adapter is not the run.** It attaches to whichever microphone is
    // standing (or starts one on the default port) and hands it a summons, so
    // `--port` and `--model` typed here would be promises nothing keeps — the
    // standing server settled both when it started. Refused rather than
    // silently dropped, which is what they used to be.
    if (args.port !== undefined || args.model !== undefined) {
      throw new Error(
        "`--port` and `--model` are the standing server's flags: `voice-agent --acp` is the adapter the rc spawns, " +
          "and it attaches to the harness that is already running (or starts one on the default port)",
      );
    }
    await runVoiceAdapter({ home, name, ...(canvas ? { canvas } : {}) });
    return;
  }

  const ctx = await resolveCtx({
    interactive: false,
    ...(args.daemonPort !== undefined ? { port: args.daemonPort } : {}),
  });
  const targetCanvas = canvas ? await resolveCanvasRef(ctx.client, canvas) : await resolveCanvas(ctx);
  const who = await claimVoiceIdentity({
    home,
    client: ctx.client,
    name,
    injected: injectedKey(),
    canvasId: targetCanvas.id,
    onLine: say,
  });
  const server = await startVoiceServer({
    home,
    port: args.port ?? DEFAULT_VOICE_PORT,
    identity: { session: who.session, harness: who.harness },
    canvas: targetCanvas.id,
    ...(args.daemonPort !== undefined ? { daemonPort: args.daemonPort } : {}),
    ...(args.model ? { model: args.model } : {}),
    onLine: say,
  });
  console.log(`\n  ${server.state.name} is listening on the canvas — talk at ${server.state.url}\n`);

  // Standing is not being summonable: the microphone speaks either way, and an
  // actor the rc has no row for is one nobody can invite. Said once, at start,
  // with the command that fixes it.
  const roster = await readRcAgents(home).catch(() => []);
  if (!roster.some((row) => row.canvasId === targetCanvas.id && row.actorId === who.actor.id)) {
    console.log(
      `  not enrolled as a harness yet — the microphone speaks as ${who.actor.name} either way, but nothing can summon it.\n` +
        `  to invite it:  isocan rc add ${who.actor.name} --harness ${VOICE_HARNESS}\n`,
    );
  }

  await new Promise<void>((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
  await server.close();
  console.log("voice harness stopped");
}
