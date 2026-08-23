import { randomBytes } from "node:crypto";
import { Firestore } from "@google-cloud/firestore";
import { CloudDesk } from "../src/cloud-desk.ts";
import { CloudStore } from "../src/cloud-store.ts";
import { MemoryObjects } from "./memory-objects.ts";

/**
 * Everything the cloud suites need to reach a Firestore, and the one gate
 * that decides whether they may.
 *
 * ## The gate
 *
 * `test/emulator.ts` starts an emulator once per run when it can, and leaves
 * a reason in the environment when it cannot. This turns that into a decision
 * each cloud test file makes for itself:
 *
 *  - emulator present → run everything;
 *  - absent and `ISOCAN_REQUIRE_EMULATOR=1` → ONE failing test that says so,
 *    because a silent skip on the branch everybody installs from is the
 *    failure mode this whole arrangement exists to prevent;
 *  - absent otherwise → register every case as SKIPPED with the reason in the
 *    describe title, so the run's own output is a precise list of what was
 *    not checked.
 *
 * ## The safety rail
 *
 * A test run must be incapable of reaching a real project. Two independent
 * conditions, asserted on the way in rather than assumed: `FIRESTORE_EMULATOR_HOST`
 * must be set (with it, the client library uses an insecure channel and never
 * loads a credential at all), and the project id must start with `demo-`,
 * which is the Firebase convention for an emulator-only project. A
 * misconfigured run fails here rather than somewhere expensive.
 */

export const SKIP_REASON_ENV = "ISOCAN_EMULATOR_SKIP_REASON";

export type CloudGate = { ok: true; skip?: undefined } | { ok: false; skip: string };

export function cloudGate(): CloudGate {
  if (process.env.FIRESTORE_EMULATOR_HOST) return { ok: true };
  return {
    ok: false,
    skip:
      process.env[SKIP_REASON_ENV] ??
      "no Firestore emulator (gcloud components install cloud-firestore-emulator)",
  };
}

export function requireEmulator(): boolean {
  return process.env.ISOCAN_REQUIRE_EMULATOR === "1";
}

/**
 * A project id nothing else in this run will touch. The emulator serves
 * arbitrary project ids with no provisioning, so isolation is free and
 * parallel vitest workers are safe — the same move `fs.mkdtemp` makes for the
 * file backing.
 */
export function demoProjectId(): string {
  return `demo-isocan-${process.pid}-${randomBytes(4).toString("hex")}`;
}

export function connect(projectId = demoProjectId()): Firestore {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error("refusing to connect: FIRESTORE_EMULATOR_HOST is not set");
  if (!projectId.startsWith("demo-")) {
    throw new Error(`refusing to connect to a non-demo project: ${projectId}`);
  }
  return new Firestore({ projectId });
}

export interface CloudFixture {
  store: CloudStore;
  objects: MemoryObjects;
  firestore: Firestore;
  projectId: string;
}

/**
 * A `CloudStore` over a fresh emulator project.
 *
 * `snapshotEveryOps: 1` in the fixtures that ask for it — the debounce is
 * exercised on purpose by `cloud-store.test.ts`, and everywhere else it would
 * only be a source of ordering questions that have nothing to do with the
 * case under test.
 */
export function makeCloudStore(
  options: {
    projectId?: string;
    objects?: MemoryObjects;
    snapshotEveryOps?: number;
    snapshotEveryMs?: number;
  } = {},
): CloudFixture {
  const projectId = options.projectId ?? demoProjectId();
  const firestore = connect(projectId);
  const objects = options.objects ?? new MemoryObjects();
  const store = new CloudStore({
    firestore,
    objects,
    snapshotEveryOps: options.snapshotEveryOps ?? 1,
    snapshotEveryMs: options.snapshotEveryMs ?? 5_000,
    shutdown: () => firestore.terminate(),
  });
  return { store, objects, firestore, projectId };
}

export function makeCloudDesk(projectId = demoProjectId()): {
  desk: CloudDesk;
  firestore: Firestore;
  projectId: string;
} {
  const firestore = connect(projectId);
  return {
    desk: new CloudDesk({ firestore, shutdown: () => firestore.terminate() }),
    firestore,
    projectId,
  };
}
