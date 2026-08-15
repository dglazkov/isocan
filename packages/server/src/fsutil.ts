import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Crash-safe write: temp file in the same directory, fsync, rename over the
 * target. Readers see either the old or the new content, never a torn write.
 */
export async function writeFileAtomic(filePath: string, data: string | Buffer): Promise<void> {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.tmp-${randomBytes(6).toString("hex")}`);
  const handle = await fs.open(tmp, "w");
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, filePath);
}

/** Append one line with fsync — the oplog's durability guarantee. */
export async function appendLineDurable(filePath: string, line: string): Promise<void> {
  const handle = await fs.open(filePath, "a");
  try {
    await handle.writeFile(line + "\n");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function readJsonLines<T>(filePath: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}
