import type { Actor, CanvasContents, Operation, Canvas } from "@isocan/core";

/**
 * **The browser's replica, made durable** (phase 10).
 *
 * The journey's rule 6 is that "offline in the browser is the service worker's
 * job — cached shell, durable browser replica, queued ops — so per-viewer
 * state has exactly one home, and every replica (tab or daemon) reconnects
 * with the same seq-cursor gesture." The shell is `public/sw.js`; this is the
 * second clause. A tab already WAS a replica — `canvasStore` applies the
 * shared reducer to a seq-numbered stream exactly as a daemon does — and what
 * it lacked was a disk. This is the disk.
 *
 * What is kept is deliberately the same three things a daemon's store keeps
 * for a canvas, in the same relationship:
 *
 * - the **confirmed** state — what the home said, at `lastSeq` and not one op
 *   further. Never the optimistic view: an optimistic canvas persisted as
 *   truth is a replica that has quietly forked, and the seq it carries would
 *   be a claim about state the home has never seen.
 * - **`lastSeq`** — the cursor, which is the entire reconnect gesture. A
 *   restored tab presents it in `?since=` and gets the evening, exactly as
 *   `HomeLink.dial` does from the daemon's end.
 * - the **queue** — writes made with nobody to send them to, in the order they
 *   were made, each already carrying the idempotency key it will be sent
 *   with. Persisting the key is the load-bearing half: a tab that reloaded
 *   offline mints a new `clientId` and would otherwise have no way to say
 *   "this is the op I already told you about".
 *
 * **IndexedDB, hand-rolled, no dependency.** `localStorage` is out on two
 * counts — it is synchronous on the main thread, and 5 MiB is a real ceiling
 * for a canvas with any history of comments in it. A wrapper library is out
 * for the reason the root `package.json` explains at length: this repo
 * duplicates the CLI's runtime deps so a git install resolves (#47), so a new
 * dependency is never just a dependency. What is actually needed here is one
 * object store, `get`, `put` and `delete` — about forty lines, written once,
 * against an API that has not changed in a decade.
 */

/** One canvas, as this browser holds it between visits. */
export interface StoredReplica {
  canvasId: string;
  /** The home's truth at `lastSeq` — never the optimistic view. */
  project: Canvas;
  canvas: CanvasContents;
  lastSeq: number;
  queue: StoredWrite[];
  /** ISO, for a human reading the database in devtools. */
  savedAt: string;
}

/** A write this tab made and the home has not confirmed. */
export interface StoredWrite {
  /** The idempotency key, minted when the gesture happened and kept through
   * reloads — see `PostOpRequest.opId`. */
  opId: string;
  actor: Actor;
  op: Operation;
  at: number;
  /** Set once the home has answered with a seq; the write retires when the
   * confirmed cursor reaches it. */
  seq?: number;
}

/**
 * The three calls this module needs from a key-value store, named as an
 * interface so a test can hand it a Map.
 *
 * Not because IndexedDB is hard to fake, but because it is not there at all in
 * the runtime the tests run in — and a durable replica whose durability is
 * only ever exercised in a browser is a durable replica nobody checks.
 */
export interface ReplicaStore {
  get(key: string): Promise<StoredReplica | null>;
  put(key: string, value: StoredReplica): Promise<void>;
  delete(key: string): Promise<void>;
}

const DB_NAME = "isocan";
const DB_VERSION = 1;
const STORE = "replicas";

/** How long a burst of confirmed ops is allowed to run before it is written
 * down. Matches the instinct the map records for CloudStore's debounced
 * snapshots: the oplog is truth and a snapshot is a fast start, so putting a
 * whole-canvas write on the latency path of every op would be paying a
 * database round trip for data that is derived. A queued write is NOT
 * debounced (see `rememberQueue`) — that one is not derived from anything. */
const SAVE_DEBOUNCE_MS = 400;

let store: ReplicaStore | null = null;
let opened = false;

/** Hand this module somewhere to write — a test's Map, or nothing at all. */
export function setReplicaStore(next: ReplicaStore | null): void {
  store = next;
  opened = true;
}

function backing(): ReplicaStore | null {
  if (!opened) {
    opened = true;
    store = typeof indexedDB === "undefined" ? null : indexedDbStore();
  }
  return store;
}

/**
 * IndexedDB as a promise-shaped key-value store.
 *
 * Every operation opens against the same lazily-created connection, and every
 * failure resolves rather than rejects: a browser in private mode, a user who
 * has blocked site data, or a database that will not upgrade must cost this
 * tab exactly nothing. A replica that cannot be written down is a tab that
 * behaves as it did before phase 10 — which is a working tab.
 */
function indexedDbStore(): ReplicaStore {
  let db: Promise<IDBDatabase | null> | null = null;
  const connect = (): Promise<IDBDatabase | null> => {
    if (db) return db;
    db = new Promise<IDBDatabase | null>((resolve) => {
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch {
        return resolve(null);
      }
      request.onupgradeneeded = () => {
        const upgrading = request.result;
        if (!upgrading.objectStoreNames.contains(STORE)) upgrading.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return db;
  };

  const run = <T>(
    mode: IDBTransactionMode,
    work: (objects: IDBObjectStore) => IDBRequest,
  ): Promise<T | null> =>
    connect().then(
      (open) =>
        new Promise<T | null>((resolve) => {
          if (!open) return resolve(null);
          let request: IDBRequest;
          try {
            request = work(open.transaction(STORE, mode).objectStore(STORE));
          } catch {
            return resolve(null);
          }
          request.onsuccess = () => resolve(request.result as T);
          request.onerror = () => resolve(null);
        }),
    );

  return {
    get: (key) => run<StoredReplica>("readonly", (objects) => objects.get(key)),
    put: (key, value) => run("readwrite", (objects) => objects.put(value, key)).then(() => {}),
    delete: (key) => run("readwrite", (objects) => objects.delete(key)).then(() => {}),
  };
}

/** What this browser last knew about a canvas, or null if it has never held
 * it (or cannot remember, which is the same answer to the caller). */
export async function loadReplica(canvasId: string): Promise<StoredReplica | null> {
  const backer = backing();
  if (!backer) return null;
  try {
    const found = await backer.get(canvasId);
    return found && found.canvasId === canvasId ? found : null;
  } catch {
    return null;
  }
}

const pending = new Map<string, ReturnType<typeof setTimeout>>();
const latest = new Map<string, StoredReplica>();

/**
 * Write it down. Debounced per canvas, and the last write of a burst wins.
 *
 * `immediate` is for the half that is not derived: a queued op is the only
 * copy of a person's work in the world, and four hundred milliseconds is long
 * enough to close a laptop in.
 */
export function saveReplica(record: StoredReplica, immediate = false): void {
  const backer = backing();
  if (!backer) return;
  latest.set(record.canvasId, record);
  const flush = () => {
    pending.delete(record.canvasId);
    const value = latest.get(record.canvasId);
    if (value) void backer.put(value.canvasId, value).catch(() => {});
  };
  const timer = pending.get(record.canvasId);
  if (immediate) {
    if (timer) clearTimeout(timer);
    flush();
    return;
  }
  if (timer) return;
  pending.set(record.canvasId, setTimeout(flush, SAVE_DEBOUNCE_MS));
}

/** Forget a canvas — it was deleted, or the home says there is none here.
 * Keeping a replica of a canvas that no longer exists is how a tab shows a
 * person work nobody else can see. */
export async function forgetReplica(canvasId: string): Promise<void> {
  const backer = backing();
  const timer = pending.get(canvasId);
  if (timer) clearTimeout(timer);
  pending.delete(canvasId);
  latest.delete(canvasId);
  if (backer) await backer.delete(canvasId).catch(() => {});
}

/** Write everything that is waiting on a debounce, now. Called when the page
 * is being hidden: `visibilitychange` is the last reliable moment a tab gets,
 * and `unload` is not one. */
export function flushReplicaWrites(): void {
  for (const canvasId of [...pending.keys()]) {
    const timer = pending.get(canvasId);
    if (timer) clearTimeout(timer);
    pending.delete(canvasId);
    const value = latest.get(canvasId);
    const backer = backing();
    if (value && backer) void backer.put(value.canvasId, value).catch(() => {});
  }
}
