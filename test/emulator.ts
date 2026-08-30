import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import net from "node:net";
import path from "node:path";

/**
 * The Firestore emulator, started once per `npm test` run and killed with it.
 *
 * Vitest `globalSetup`: runs in the main process, before any worker is
 * forked, so what it puts in `process.env` is what every worker inherits —
 * which matters because `FIRESTORE_EMULATOR_HOST` is read by the client
 * library itself, in the worker, and there is no other way to hand it over.
 *
 * Three tiers, and the third is the one that answers "everybody forgets":
 *
 *  1. `FIRESTORE_EMULATOR_HOST` already set — a developer running their own.
 *     Use it, start nothing, kill nothing.
 *  2. Otherwise, if the component and a 21+ JRE are both here, start one on a
 *     free port and take it down at the end. The developer does nothing.
 *  3. Otherwise the cloud suites SKIP, naming what is missing in the test
 *     titles themselves — and `ISOCAN_REQUIRE_EMULATOR=1` (which CI sets)
 *     turns that skip into a failure, so a contributor can get a green run
 *     that says out loud what it did not check while CI cannot.
 *
 * With the host set, the client library uses an insecure channel and never
 * loads a credential, so a test run physically cannot reach a real project.
 * `cloud-fixture.ts` re-asserts that, and the `demo-` project id prefix, on
 * the way in.
 */

/** Named so the skip lines can say precisely what did not run and why. */
export const SKIP_REASON_ENV = "ISOCAN_EMULATOR_SKIP_REASON";

/**
 * The emulator's floor. It was 17 until recently and the tooling notes that
 * say so are wrong: the current component refuses with "The java executable
 * on your PATH is not a Java 21+ JRE". Worth being explicit about, because
 * the machine this was built on has 17 on `PATH` and 21 installed keg-only
 * beside it — which is the normal state of any machine that runs more than
 * one JVM thing.
 */
const MIN_JAVA = 21;

let child: ChildProcess | null = null;

export async function setup(): Promise<void> {
  if (process.env.FIRESTORE_EMULATOR_HOST) return; // tier 1

  const gcloud = findGcloud();
  if (!gcloud) {
    return skip("no gcloud CLI on PATH (install the Google Cloud SDK)");
  }
  if (!hasEmulatorComponent(gcloud)) {
    return skip("no Firestore emulator (gcloud components install cloud-firestore-emulator)");
  }
  const java = findJava();
  if (!java) {
    return skip(
      `no Java ${MIN_JAVA}+ JRE (the Firestore emulator needs one; set JAVA_HOME or install openjdk@${MIN_JAVA})`,
    );
  }

  const port = await freePort();
  const host = `127.0.0.1:${port}`;
  child = spawn(gcloud, ["emulators", "firestore", "start", `--host-port=${host}`], {
    // The JRE goes in FRONT of whatever is on PATH rather than replacing it:
    // `gcloud` is a Python program that shells out to `java`, and it needs the
    // rest of the environment intact. Sanitizing PATH here would break gcloud
    // itself, and pointing it at a 17 that happens to be first would break the
    // emulator — hence in front, not instead.
    env: { ...process.env, PATH: `${path.dirname(java)}${path.delimiter}${process.env.PATH ?? ""}` },
    // Its own process group, so the kill below takes the JVM with it. Killing
    // the gcloud wrapper alone leaves a java process holding the port, which
    // is exactly the orphan `test/setup.ts` exists to complain about.
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  // A launcher that dies on the spot — a busy port, a JRE it rejects after
  // all — should not cost thirty seconds of polling before we say so.
  let died: number | null = null;
  child.once("exit", (code) => {
    died = code ?? -1;
  });

  if (!(await waitUntilReady(port, 30_000, () => died !== null))) {
    stop();
    return skip(
      died !== null
        ? `the Firestore emulator exited immediately (status ${died})`
        : `the Firestore emulator did not come up on ${host} within 30s`,
    );
  }
  // Belt to `teardown`'s braces. Vitest calls teardown on a clean finish and
  // on Ctrl+C; an unhandled throw somewhere in the runner is the case it does
  // not cover, and the thing left behind would be a JVM holding a port. Only a
  // SIGKILL of the runner itself can still orphan one — the same residual hole
  // `test/setup.ts` describes for daemons, and it is one command to check:
  // `ps ax | grep cloud-firestore-emulator`.
  process.once("exit", stop);
  process.env.FIRESTORE_EMULATOR_HOST = host;
}

/**
 * SIGTERM first, SIGKILL for anything still breathing — the same posture
 * `stopDaemons` takes, and for the same reason: a JVM takes a second or two
 * to honor a SIGTERM, and a run that walked away at the first signal would
 * sometimes leave one holding a port.
 */
export async function teardown(): Promise<void> {
  const group = child?.pid;
  stop();
  if (!group) return;
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline && groupAlive(group)) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (groupAlive(group)) {
    try {
      process.kill(-group, "SIGKILL");
    } catch {
      // gone between the check and the signal
    }
  }
}

function stop(): void {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM"); // the group: gcloud AND the JVM
  } catch {
    // already gone
  }
  child = null;
}

function groupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

function skip(reason: string): void {
  process.env[SKIP_REASON_ENV] = reason;
}

/** `Ok` on `GET /` is the emulator saying it has finished booting — better
 * than sleeping, and it is what the log line promises. */
async function waitUntilReady(
  port: number,
  timeoutMs: number,
  giveUp: () => boolean,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !giveUp()) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(500) });
      if (res.ok) {
        await res.text().catch(() => {});
        return true;
      }
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

/**
 * **A port below every ephemeral floor, like everything else this suite
 * listens on** — and for the reason the flake family finally gave up.
 *
 * This asked the kernel (`listen(0)`), read the number, closed, and handed it
 * over — which is a guess, and a guess out of exactly the range the kernel is
 * also allocating to outgoing connections. That is what produced `EADDRINUSE`
 * on a bind and `ETIMEDOUT` on a LOOPBACK connect, with the event loop
 * measured idle while it happened.
 *
 * `ports.ts` could not help here and still cannot: this runs in globalSetup,
 * before any worker exists, so there is no `VITEST_POOL_ID` to slice by. So it
 * takes its own band BELOW the workers' — 19000, under `ports.ts`'s 20000 —
 * and scans it. Nothing in this run can collide with it, and nothing the OS
 * hands out can land in it.
 */
const EMULATOR_PORT_BASE = 19_000;
const EMULATOR_PORT_TRIES = 100;

function bindable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
}

export async function freePort(): Promise<number> {
  for (let i = 0; i < EMULATOR_PORT_TRIES; i += 1) {
    const port = EMULATOR_PORT_BASE + i;
    if (await bindable(port)) return port;
  }
  throw new Error(
    `no free port in ${EMULATOR_PORT_BASE}..${EMULATOR_PORT_BASE + EMULATOR_PORT_TRIES - 1} — ` +
      "something outside this run is holding the whole band",
  );
}

function findGcloud(): string | null {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, "gcloud");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** The component unpacks into the SDK's own `platform/` directory. Asking the
 * filesystem is instant; `gcloud components list` is a network round trip. */
function hasEmulatorComponent(gcloud: string): boolean {
  const roots = [
    process.env.CLOUDSDK_ROOT_DIR,
    path.dirname(path.dirname(realpathSyncSafe(gcloud))),
    path.dirname(path.dirname(gcloud)),
  ];
  return roots.some(
    (root) => root && existsSync(path.join(root, "platform", "cloud-firestore-emulator")),
  );
}

function realpathSyncSafe(target: string): string {
  try {
    return realpathSync(target);
  } catch {
    return target;
  }
}

/**
 * A Java executable of at least {@link MIN_JAVA}, or null.
 *
 * In this order because it is the order of confidence: an explicit
 * `JAVA_HOME` is somebody's decision, `java_home -v` is macOS's registry (and
 * is EMPTY on a Homebrew-only machine, so it cannot be relied on alone), the
 * fixed paths are where the two package managers put it, and `java` on PATH
 * is last precisely because a machine with several JVMs usually has the wrong
 * one first.
 */
function findJava(): string | null {
  const candidates: string[] = [];
  if (process.env.JAVA_HOME) candidates.push(path.join(process.env.JAVA_HOME, "bin", "java"));
  const registry = spawnSync("/usr/libexec/java_home", ["-v", String(MIN_JAVA)], {
    encoding: "utf8",
  });
  if (registry.status === 0 && registry.stdout.trim()) {
    candidates.push(path.join(registry.stdout.trim(), "bin", "java"));
  }
  candidates.push(
    `/opt/homebrew/opt/openjdk@${MIN_JAVA}/bin/java`,
    `/usr/local/opt/openjdk@${MIN_JAVA}/bin/java`,
    "/opt/homebrew/opt/openjdk/bin/java",
    `/usr/lib/jvm/temurin-${MIN_JAVA}-jdk-amd64/bin/java`,
    `/usr/lib/jvm/java-${MIN_JAVA}-openjdk-amd64/bin/java`,
  );
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (dir) candidates.push(path.join(dir, "java"));
  }
  for (const candidate of candidates) {
    if (existsSync(candidate) && javaMajor(candidate) >= MIN_JAVA) return candidate;
  }
  return null;
}

/** `java -version` writes to STDERR — every time, on every JVM, forever. */
function javaMajor(java: string): number {
  const probe = spawnSync(java, ["-version"], { encoding: "utf8" });
  const match = /version "(\d+)/.exec(`${probe.stderr ?? ""}${probe.stdout ?? ""}`);
  return match ? Number(match[1]) : 0;
}
