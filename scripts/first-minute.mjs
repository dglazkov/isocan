#!/usr/bin/env node
/**
 * **What isocan costs in a small sandbox, measured rather than guessed.**
 *
 *   node scripts/first-minute.mjs                 # today's pushed `release`
 *   node scripts/first-minute.mjs --local         # the `release` ref on this machine
 *   node scripts/first-minute.mjs --json          # the same numbers, machine-readable
 *
 * The debt is #332: an agent in a hosted sandbox waits 35 s for an install and
 * 2 to 4 s for every command, where the same commands on a laptop cost 0.3 s.
 * A laptop cannot show that, so the numbers in
 * `docs/projects/first-minute/design.md` came from somebody else's sandbox and
 * could not be re-taken after a change. This takes them here: a container with
 * four cores, a cold disk and no tsx cache, close to the one #332 was measured
 * in, and three numbers out of it —
 *
 *   1. install seconds and package count for `npm install -g <spec>`;
 *   2. seconds for `isocan --version`, cold and warm;
 *   3. how many files that one command opens.
 *
 * **Why the file count is the number that survives.** Seconds are this
 * machine's; a laptop's Docker is not a hosted sandbox and will not reproduce
 * 3.3 s. Opens are the work itself, and they are what a sandbox charges for:
 * the likely reason #332's sandbox turns 0.3 s into 3.3 s is that it
 * intercepts file system calls, so 456 module loads cost what 456 syscalls
 * cost there and not what they cost on an SSD. A phase that halves the opens
 * has halved the thing the sandbox is charging for, whatever the local clock
 * says.
 *
 * **What the container is not.** gVisor's `runsc` would be the closer model
 * and is not installed on this machine (`docker info` lists `runc` only), so
 * `--runtime` exists and is unused; the run says which runtime it used.
 */
import { spawnSync } from "node:child_process";
import { promises as fs, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

/** The published spec a stranger types. `--local` replaces it with this machine's `release`. */
export const RELEASE_SPEC = "github:dglazkov/isocan#release";

/** The image tag; built on first use and reused, because apt is not part of the measurement. */
const IMAGE = "isocan-first-minute:node22";

/**
 * Node 22 because #332's sandbox has Node 22. `git` because npm's git
 * installer needs it, `strace` because the file count is the number that
 * survives, `ca-certificates` because the install fetches over TLS.
 */
const DOCKERFILE = `FROM node:22-slim
RUN apt-get update \\
 && apt-get install -y --no-install-recommends git strace ca-certificates \\
 && rm -rf /var/lib/apt/lists/*
`;

/**
 * **The measurement, as it runs inside the container**, piped to bash on
 * stdin. It lives in `scripts/lib/first-minute-sandbox.sh` because shell and
 * JavaScript spell `${...}` the same way and one of them has to win.
 */
const MEASURE = readFileSync(new URL("./lib/first-minute-sandbox.sh", import.meta.url), "utf8");

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: "utf8", ...opts });

function dockerAvailable() {
  const done = run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  return done.status === 0 ? done.stdout.trim() : "";
}

/** Build the image once. Quiet unless it has work to do, which is the first run and after an edit. */
async function ensureImage() {
  const present = run("docker", ["image", "inspect", IMAGE, "--format", "{{.Id}}"]);
  if (present.status === 0) return;
  console.error(`first-minute: building ${IMAGE} (once)`);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-first-minute-image-"));
  try {
    await fs.writeFile(path.join(dir, "Dockerfile"), DOCKERFILE);
    const built = run("docker", ["build", "-t", IMAGE, dir], { stdio: "inherit" });
    if (built.status !== 0) throw new Error("docker build failed");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/**
 * **A bare clone of this machine's `release`, for `--local`.** The container
 * has to install the way a stranger does — npm cloning a git ref — and it
 * cannot clone the working tree: in a worktree `.git` is a file pointing
 * outside anything we could mount. So the ref is cloned to a temp bare repo
 * first, and that is what the container installs from.
 */
export async function bareReleaseClone(ref = "release") {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-first-minute-repo-"));
  const target = path.join(dir, "isocan.git");
  const gitDir = run("git", ["rev-parse", "--git-common-dir"], { cwd: repo }).stdout.trim();
  const source = path.isAbsolute(gitDir) ? gitDir : path.join(repo, gitDir);
  const cloned = run("git", ["clone", "--bare", "--single-branch", "--branch", ref, source, target]);
  if (cloned.status !== 0) {
    await fs.rm(dir, { recursive: true, force: true });
    throw new Error(
      `no local \`${ref}\` to install from — \`npm run release -- --no-push\` builds one.\n${cloned.stderr.trim()}`,
    );
  }
  return { dir, target };
}

/** One container, one set of numbers. */
export function measure({ spec, runs = 3, cpus = 4, runtime = "", mount = "" }) {
  const args = [
    "run",
    "--rm",
    "-i",
    `--cpus=${cpus}`,
    // strace needs to attach, and Docker's default seccomp profile blocks
    // ptrace. Neither changes what the CLI itself is allowed to do.
    "--cap-add=SYS_PTRACE",
    "--security-opt",
    "seccomp=unconfined",
    ...(runtime ? ["--runtime", runtime] : []),
    ...(mount ? ["-v", `${mount}:/repo.git:ro`] : []),
    IMAGE,
    "bash",
    "-s",
    "--",
    spec,
    String(runs),
  ];
  const done = spawnSync("docker", args, { encoding: "utf8", input: MEASURE, stdio: ["pipe", "pipe", "inherit"] });
  if (done.status !== 0) throw new Error(`docker run failed (${done.status})`);
  const line = (done.stdout || "").split("\n").find((l) => l.startsWith("FIRST-MINUTE "));
  if (!line) throw new Error("the container printed no result line");
  return JSON.parse(line.slice("FIRST-MINUTE ".length));
}

const s = (ms) => `${(ms / 1000).toFixed(2)} s`;

export function report(result, { spec, runtime, cpus }) {
  if (!result.ok) return `first-minute: ${result.stage} failed after ${s(result.installMs)}`;
  const lines = [
    `spec           ${spec}`,
    `container      ${runtime || "runc"}, ${cpus} cores, node 22, cold disk`,
    "",
    `install        ${s(result.installMs)}   ${result.packages} packages, ${result.treeMb} MB installed` +
      (result.hasDocs ? ", docs/ included" : ""),
    `--version      ${s(result.coldMs)} cold, ${s(result.warmMs)} warm   (node -e '' is ${s(result.nodeFloorMs)})`,
    `file opens     ${result.opens < 0 ? "strace unavailable" : `${result.opens}, ${result.opensFound} found`}`,
  ];
  return lines.join("\n");
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name, fallback) => {
    const at = argv.indexOf(`--${name}`);
    return at === -1 ? fallback : argv[at + 1];
  };
  const json = argv.includes("--json");
  const local = argv.includes("--local");
  const runs = Number(flag("runs", 3));
  const cpus = Number(flag("cpus", 4));
  const runtime = flag("runtime", "");

  const server = dockerAvailable();
  if (!server) throw new Error("no docker daemon — this script needs one to have a sandbox at all");

  await ensureImage();

  let clone = null;
  let spec = flag("spec", RELEASE_SPEC);
  if (local) {
    clone = await bareReleaseClone(flag("ref", "release"));
    spec = "git+file:///repo.git";
  }
  try {
    const result = measure({ spec, runs, cpus, runtime, mount: clone?.target ?? "" });
    console.log(
      json
        ? JSON.stringify({ ...result, spec: local ? "local release" : spec, runtime: runtime || "runc", cpus }, null, 2)
        : report(result, { spec: local ? `local \`release\` (${spec})` : spec, runtime, cpus }),
    );
    if (!result.ok) process.exitCode = 1;
  } finally {
    if (clone) await fs.rm(clone.dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`first-minute: ${err.message}`);
    process.exit(1);
  });
}
