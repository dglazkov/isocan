import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import type { Actor } from "@isocan/core";
import { newActorId } from "@isocan/core";
import { paths } from "@isocan/server";

interface IdentityFile extends Actor {
  createdAt: string;
  // Future: an `auth` block (provider, tokens). Actor.id stays the stable key.
}

/**
 * Two parties share this machine, and they are not the same person.
 *
 * The HOME identity (`~/.isocan/identity.json`) belongs to whoever owns the
 * machine — you. A DIRECTORY identity (`<dir>/.isocan/identity.json`, found by
 * walking up from the working directory) belongs to the agent working there.
 * Commands speak as the directory identity when there is one, so an agent
 * naming itself never renames the human, and the human's canvas is never
 * created under the agent's name.
 *
 * One slot per machine was the old design, and the skill told agents to claim
 * it — so the last agent to introduce itself became the user.
 */
export interface ResolvedIdentity {
  actor: Actor;
  /** "directory" = an agent's, in a working directory. "home" = the human's. */
  source: "directory" | "home";
  file: string;
}

export const localIdentityFile = (dir: string) => path.join(dir, ".isocan", "identity.json");

async function readFrom(file: string): Promise<Actor | null> {
  try {
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as IdentityFile;
    return raw.id && raw.name ? { id: raw.id, name: raw.name } : null;
  } catch {
    return null;
  }
}

export async function readIdentity(home: string): Promise<Actor | null> {
  return readFrom(paths.identityFile(home));
}

/**
 * The nearest directory identity at or above `cwd` — an agent that named
 * itself in a project still speaks as itself from a subdirectory of it.
 *
 * Two floors under the walk. The isocan home is never a directory identity:
 * `~/.isocan/identity.json` is the human's slot by definition. And the walk
 * stops below `$HOME`, because everything above it belongs to the person, not
 * to a piece of work — without that, `ISOCAN_HOME=/tmp/x isocan …` in any
 * project would climb out and adopt the real user's name as if an agent had
 * left it there.
 */
export async function findLocalIdentity(
  cwd: string,
  home: string,
): Promise<{ actor: Actor; file: string } | null> {
  const isocanHome = path.resolve(home);
  const userHome = path.resolve(os.homedir());
  let dir = path.resolve(cwd);
  for (;;) {
    if (dir !== userHome && path.join(dir, ".isocan") !== isocanHome) {
      const file = localIdentityFile(dir);
      const actor = await readFrom(file);
      if (actor) return { actor, file };
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === userHome) return null;
    dir = parent;
  }
}

/** Who this command speaks as: the agent working here, else the human. */
export async function resolveIdentity(
  home: string,
  cwd: string,
): Promise<ResolvedIdentity | null> {
  const local = await findLocalIdentity(cwd, home);
  if (local) return { actor: local.actor, source: "directory", file: local.file };
  const actor = await readIdentity(home);
  return actor ? { actor, source: "home", file: paths.identityFile(home) } : null;
}

async function write(file: string, actor: Actor): Promise<Actor> {
  const identity: IdentityFile = { ...actor, createdAt: new Date().toISOString() };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(identity, null, 2));
  return actor;
}

/** Rename in place — the actor id is the stable key, so your history stays
 * yours — unless `fresh`, which makes you a new person entirely. */
export async function writeIdentity(home: string, name: string, fresh = false): Promise<Actor> {
  const existing = fresh ? null : await readIdentity(home);
  return write(paths.identityFile(home), { id: existing?.id ?? newActorId(), name });
}

export async function writeLocalIdentity(
  dir: string,
  name: string,
  fresh = false,
): Promise<Actor> {
  const file = localIdentityFile(dir);
  const existing = fresh ? null : await readFrom(file);
  return write(file, { id: existing?.id ?? newActorId(), name });
}

/** First-run flow: prompt on a TTY, otherwise fail with instructions. */
export async function requireIdentity(home: string, cwd: string): Promise<Actor> {
  const existing = await resolveIdentity(home, cwd);
  if (existing) return existing.actor;
  if (!process.stdin.isTTY) {
    throw new Error(
      'no identity configured — run `isocan identity --name "Your Name"` first',
    );
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const name = (await rl.question("Welcome to isocan! What should we call you? ")).trim();
  rl.close();
  if (!name) throw new Error("a name is required");
  const actor = await writeIdentity(home, name);
  console.error(`Hi ${actor.name} — identity saved to ${paths.identityFile(home)}`);
  return actor;
}
