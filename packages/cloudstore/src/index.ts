import { Firestore } from "@google-cloud/firestore";
import type { Desk, Store } from "@isocan/server";
import { CloudStore } from "./cloud-store.ts";
import { CloudDesk } from "./cloud-desk.ts";
import { GcsObjects } from "./gcs-objects.ts";

export { CloudStore } from "./cloud-store.ts";
export type { CloudStoreOptions } from "./cloud-store.ts";
export { CloudDesk } from "./cloud-desk.ts";
export { GcsObjects } from "./gcs-objects.ts";
export type { ObjectStat, ObjectStore } from "./objects.ts";
export * as naming from "./naming.ts";

export interface CloudBackingOptions {
  bucket: string;
  projectId?: string;
}

/**
 * The hosted home's two ledgers, both on Google Cloud.
 *
 * This is the only export `daemon.ts` reaches for, and it is reached by
 * DYNAMIC import — so nothing that installs the CLI ever loads a line of
 * this package or the ~43 MiB of client libraries behind it.
 *
 * The store and the desk share ONE Firestore instance, and therefore one gRPC
 * channel: two would be two connections to the same database for no reason.
 * That makes shutdown neither one's to do alone, so both get the same
 * idempotent `shutdown` and whichever closes last terminates the channel.
 * Without it the channel keeps the event loop alive and the process never
 * exits — which on Cloud Run is a container that will not drain and in a test
 * run is a worker that hangs forever.
 */
export function openCloudBacking(options: CloudBackingOptions): { store: Store; desk: Desk } {
  const firestore = new Firestore(options.projectId ? { projectId: options.projectId } : {});
  const objects = GcsObjects.open(options.bucket, options.projectId);
  const shutdown = onceOnly(() => firestore.terminate());
  return {
    store: new CloudStore({ firestore, objects, shutdown }),
    desk: new CloudDesk({ firestore, shutdown }),
  };
}

function onceOnly(work: () => Promise<void>): () => Promise<void> {
  let started: Promise<void> | null = null;
  return () => (started ??= work());
}
