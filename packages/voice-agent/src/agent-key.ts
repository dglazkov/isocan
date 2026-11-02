import { createHmac, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * **The key this machine claims an agent's actor under — this package's copy
 * of the CLI's rule** (room phase 3.5, `packages/cli/src/agent-key.ts`).
 *
 * It is here for one reason: **the microphone has to present the key the rc
 * injects.** A person starts this harness by hand and it claims its actor; the
 * person (or the page) then enrols that agent with `isocan rc add`, which
 * claims the actor under this machine's key; a summoned turn injects the same
 * key. When the harness claimed `agent:<name>` instead, the second claim met
 * its own first claim as somebody else's — "Voice is taken here (claimed by
 * another session just now)" — and the agent could not be enrolled or summoned
 * for as long as the desk remembers a claim, which is half an hour. Deriving
 * the CLI's key here is what makes those three moments one claim.
 *
 * **The file is the interface, so it is named rather than inlined.** The key is
 * `agent:<mac>`: HMAC-SHA256 over `isocan agent key\n<name>`, keyed by the
 * secret in `~/.isocan/agent-secret` (32 bytes, base64url, mode 0600, written
 * once and never replaced — a new secret would leave every agent enrolled from
 * here unclaimable, which is why a file that fails to decode is an error rather
 * than something to overwrite). `packages/cli/src/agent-key.ts` is the
 * authority on all of that; a change there has to change here in the same
 * commit, and `packages/cli/test/agent-key.test.ts` is where the CLI pins it.
 *
 * The secret is a file in the home, exactly like `rc-agents.json` — the same
 * argument that lets this package read the enrolment record itself lets it read
 * this, and it keeps the package from depending on the CLI being installed to
 * know who it is.
 */

export const AGENT_SECRET_FILE = "agent-secret";
const AGENT_HARNESS = "agent";
const PREFIX = `${AGENT_HARNESS}:`;
/** 24 bytes of the MAC: 192 bits, 32 base64url characters. */
const MAC_BYTES = 24;
const SECRET_BYTES = 32;

export const agentSecretFile = (home: string): string => path.join(home, AGENT_SECRET_FILE);

/** The session half of an agent key, as `ISOCAN_SESSION_ID` carries it beside
 * `ISOCAN_HARNESS=agent`. */
export function agentSessionOf(key: string): string {
  return key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key;
}

const secrets = new Map<string, Promise<Buffer>>();

function decodeSecret(file: string, text: string): Buffer {
  const secret = Buffer.from(text.trim(), "base64url");
  if (secret.length < SECRET_BYTES) {
    throw new Error(
      `${file} does not hold a usable agent secret. It is what this machine's agent keys are derived from; ` +
        "a new one would leave every agent enrolled from here unclaimable by this machine, so it is not replaced — " +
        "restore it, or move it aside and re-add the agents",
    );
  }
  return secret;
}

async function readOrCreateSecret(home: string): Promise<Buffer> {
  const file = agentSecretFile(home);
  try {
    return decodeSecret(file, await fs.readFile(file, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  // Created whole or not at all: written beside the name, then linked into
  // place, which fails if another process (the CLI, a second harness) got
  // there first. That process's secret is the one kept.
  await fs.mkdir(home, { recursive: true });
  const fresh = randomBytes(SECRET_BYTES);
  const temp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}`;
  await fs.writeFile(temp, `${fresh.toString("base64url")}\n`, { mode: 0o600, flag: "wx" });
  try {
    await fs.link(temp, file);
    return fresh;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    return decodeSecret(file, await fs.readFile(file, "utf8"));
  } finally {
    await fs.rm(temp, { force: true });
  }
}

function machineSecret(home: string): Promise<Buffer> {
  let secret = secrets.get(home);
  if (!secret) {
    secret = readOrCreateSecret(home);
    secrets.set(home, secret);
    secret.catch(() => secrets.delete(home));
  }
  return secret;
}

/** The session key this machine claims `name`'s actor under — the same key the
 * rc injects into a summoned turn, so a harness started by hand, an enrolment
 * made from the CLI and a summons are all one conversation. */
export async function machineAgentKey(home: string, name: string): Promise<string> {
  const mac = createHmac("sha256", await machineSecret(home))
    .update(`isocan agent key\n${name}`, "utf8")
    .digest()
    .subarray(0, MAC_BYTES)
    .toString("base64url");
  return `${PREFIX}${mac}`;
}
