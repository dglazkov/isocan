import { promises as fs } from "node:fs";
import readline from "node:readline/promises";
import type { Actor } from "@isocan/core";
import { newActorId } from "@isocan/core";
import { paths } from "@isocan/server";

interface IdentityFile extends Actor {
  createdAt: string;
  // Future: an `auth` block (provider, tokens). Actor.id stays the stable key.
}

export async function readIdentity(home: string): Promise<Actor | null> {
  try {
    const raw = JSON.parse(await fs.readFile(paths.identityFile(home), "utf8")) as IdentityFile;
    return { id: raw.id, name: raw.name };
  } catch {
    return null;
  }
}

export async function writeIdentity(home: string, name: string): Promise<Actor> {
  const existing = await readIdentity(home);
  const identity: IdentityFile = {
    id: existing?.id ?? newActorId(),
    name,
    createdAt: new Date().toISOString(),
  };
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(paths.identityFile(home), JSON.stringify(identity, null, 2));
  return { id: identity.id, name: identity.name };
}

/** First-run flow: prompt on a TTY, otherwise fail with instructions. */
export async function requireIdentity(home: string): Promise<Actor> {
  const existing = await readIdentity(home);
  if (existing) return existing;
  if (!process.stdin.isTTY) {
    throw new Error(
      "no identity configured — run `isocan identity --name \"Your Name\"` first",
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
