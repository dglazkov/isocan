import { beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collect, home, spawnCli, type Run } from "./rc-fixture.ts";

/**
 * **A fake `sheep` on the PATH, and a kennel beside the test's home.**
 *
 * `sheep` is found on the PATH and its home by the kennel walk, never by a
 * config block — so the fake is a shim on a PATH of its own that answers
 * from a state file and records every call it was given, and a `.sheep/`
 * beside the home names the sheep home.
 *
 * Shared by `rc-sheep.test.ts` (birth, resume, the scan) and
 * `rc-sheep-withdrawal.test.ts` (phase 2's endings), which are two files
 * rather than one describe so the runner can overlap them: the withdrawal
 * cases alone are 38 s of the 90 s that used to be one serial file.
 */
const fakeSheep = fileURLToPath(new URL("./fake-sheep.mjs", import.meta.url));

/** Written by `useSheepHome()`'s hook; read as a live binding by importers. */
export let env: Record<string, string>;
export let stateFile: string;

/** Install the hook. Called once at the top level of each sheep test file,
 * after `useRcHome()` — it builds on that home. */
export function useSheepHome(): void {
  beforeEach(async () => {
    const bin = path.join(home, "bin");
    await fs.mkdir(bin, { recursive: true });
    await fs.writeFile(path.join(bin, "sheep"), `#!/bin/sh\nexec "${process.execPath}" "${fakeSheep}" "$@"\n`, { mode: 0o755 });
    await fs.mkdir(path.join(home, ".sheep"), { recursive: true });
    await kennel({ local: true });
    stateFile = path.join(home, "sheep-state.json");
    env = { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`, FAKE_SHEEP_STATE: stateFile };
  });
}

export const kennel = (config: object) => fs.writeFile(path.join(home, ".sheep", "config"), JSON.stringify(config));
export const sheepState = async () => JSON.parse(await fs.readFile(stateFile, "utf8"));
/** The pass a sheep was minted with: its own secret, never the pasture's. */
export const sheepPass = async (id = "s_1") => (await sheepState()).sheepSecrets?.[id]?.ISOCAN_PASS as string | undefined;
export const sheepCalls = async (): Promise<Array<{ argv: string[]; cwd: string; stdin?: string }>> =>
  (await fs.readFile(`${stateFile}.calls`, "utf8").catch(() => ""))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
/** The CLI, with the fake `sheep` on its PATH. */
export const run = (...args: string[]): Promise<Run> => collect(spawnCli(args, env));
