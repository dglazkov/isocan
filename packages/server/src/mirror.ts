import { promises as fs } from "node:fs";
import path from "node:path";
import type { LogEntry } from "@isocan/core";
import { ProjectNotFoundError, type Engine } from "./engine.ts";
import type { Store } from "./store.ts";
import { hashesInOperation } from "./gc.ts";
import { readJson } from "./fsutil.ts";
import {
  RemoteError,
  readServiceAccountKey,
  systemRemote,
  batchWrites,
  type Remote,
  type RemoteWrite,
} from "./remote.ts";
import * as p from "./paths.ts";

/**
 * The daemon as the mirror's only writer (#70).
 *
 * A shared canvas has a second copy of itself in the host's Firestore project:
 * every confirmed entry of the oplog, and the bytes those entries name. Guests
 * read that copy — they have no daemon to ask — and #73's app replays it through
 * the same `@isocan/core` reducer the local app uses, which is the whole reason
 * the documents carry a `LogEntry` and not a rendering of one.
 *
 * Three properties are load-bearing, and each one is a design decision rather
 * than an implementation detail:
 *
 * **It is a follower, not a step.** Mirroring hangs off `engine.onEvent`, which
 * fires AFTER the oplog append and the snapshot write. Nothing here runs on the
 * engine's single-writer chain, so no round trip to Google is ever between a
 * person and their canvas. Firestore can be down for a day; the canvas does not
 * notice, and neither does anyone using it.
 *
 * **Events are a hint; the oplog is the truth.** The pump never trusts an event
 * to carry the entry it owes next — it asks `engine.getLog(id, cursor)` and
 * ships everything past the cursor. That collapses backfill and tailing into one
 * path: a canvas shared today has a cursor of 0, so its "tail" happens to be its
 * whole history. A missed event, a daemon that was off for a week, an outage
 * that ate an hour of writes — all one recovery, the one that runs constantly
 * and is therefore the one that works.
 *
 * **Behind is a state; broken is not.** No bucket (the host never linked
 * billing) mirrors ops and skips blobs. A 5xx backs off and retries. Even a
 * permanent refusal only parks THAT canvas, with a reason worth reading. There
 * is no failure mode here whose blast radius is the canvas itself.
 */

/** Doc ids sort as strings in Firestore, and the guest app pages through them
 * with `startAfter`, so seq order has to survive the spelling. Twelve digits is
 * a trillion ops — past any oplog, short of any float trouble. */
export function seqDocId(seq: number): string {
  return String(seq).padStart(12, "0");
}

export function opDocPath(projectId: string, seq: number): string {
  return `canvases/${projectId}/ops/${seqDocId(seq)}`;
}

/** Every blob one entry can name — its op AND its stored inverse, because an
 * inverse is what an actor's undo replays, and a guest undoing a delete must
 * find the bytes where the mirror said they would be. */
export function hashesInEntry(entry: LogEntry): string[] {
  const hashes = hashesInOperation(entry.envelope.op);
  return entry.inverse ? [...hashes, ...hashesInOperation(entry.inverse)] : hashes;
}

/** What a canvas's mirror is doing, for `isocan share` and #74's panel. */
export interface MirrorStatus {
  /** Always true here; the daemon answers `{mirroring: false}` for a canvas it
   * is not the host of, and the flag is what tells the two apart on the wire. */
  mirroring: true;
  projectId: string;
  firebaseProject: string;
  /** The last seq known to be in the mirror. */
  mirroredSeq: number;
  /** How many distinct blobs have been published. */
  blobs: number;
  /** Set while the pump owes the mirror something; cleared when it drains.
   * A parked canvas is still behind — it owes everything from here on. */
  behind: boolean;
  /** Set when the pump has given up rather than gone quiet. Retrying will not
   * help; something has to change first, and `error` says what. */
  parked?: true;
  /** Why the last attempt did not work, if it didn't. */
  error?: string;
  /** Why blobs are not being published, when ops are. */
  blobsUnavailable?: string;
}

/** The subset of the provisioning record the daemon reads. Deliberately
 * structural: the record is written by the CLI, and the daemon should depend on
 * the two fields it spends, not on the shape of the dance. */
interface RemoteRecordShape {
  firebaseProject?: string;
  keyFile?: string;
  storageBucket?: string;
  canvases?: Record<string, unknown>;
}

export interface MirrorOptions {
  home: string;
  engine: Engine;
  store: Store;
  /** The seam. Tests hand back a Firestore that lives in a variable; the
   * default builds the real REST client from the host's service-account key. */
  remoteFor?: (record: {
    firebaseProject: string;
    keyFile?: string;
    storageBucket?: string;
  }) => Promise<Remote | null>;
  /** Said out loud once per distinct problem — a mirror that narrates every
   * retry of a Firestore outage is a logfile nobody will read again. */
  notify?: (message: string) => void;
}

interface Canvas {
  projectId: string;
  firebaseProject: string;
  bucket?: string;
  remote: Remote;
  state: { lastMirroredSeq: number; uploaded: Set<string> };
  /** The serial pump. One canvas writes to its mirror in one order. */
  running: Promise<void>;
  /** Resolved when the pump drains — what `gc` waits on. */
  idle: Promise<void>;
  /**
   * Something happened that the current pass may not have seen.
   *
   * A wake is not a signal the pump can simply wait for, because most of the
   * time it is not waiting: it is mid-drain, uploading bytes and committing
   * documents, with `wake` null. An op landing in that window would have its
   * wake dropped on the floor — and the pass in flight would not carry it
   * either, since the pass decided what it owed by reading the log BEFORE that
   * op existed. So the pump would go to sleep two ops short and report itself
   * caught up. A flag is what survives the gap a callback falls through.
   */
  dirty: boolean;
  wake: (() => void) | null;
  stopped: boolean;
  failures: number;
  status: MirrorStatus;
}

const MAX_BACKOFF_MS = 60_000;

/**
 * Firestore refuses a property value over 1,048,487 bytes — a number learned
 * from Firestore rather than from the docs, by sending it one. The margin
 * leaves room for the rest of the document and for the day that ceiling moves.
 */
const MAX_INLINE_ENTRY_BYTES = 900_000;

export class Mirror {
  private canvases = new Map<string, Canvas>();
  private opening = new Map<string, Promise<void>>();
  private remotes = new Map<string, Remote | null>();
  private unsubscribe: (() => void) | null = null;
  /** Resolved once startup has finished deciding which canvases are ours. */
  private ready: Promise<void> = Promise.resolve();
  private closed = false;
  private readonly notify: (message: string) => void;

  constructor(private readonly options: MirrorOptions) {
    this.notify = options.notify ?? (() => {});
  }

  /**
   * Adopt every canvas this home is the host for, and start listening.
   *
   * Deliberately not `async`: `ready` must be assigned the moment this is
   * CALLED, not one microtask later, because the daemon starts the mirror
   * without waiting for it (a slow Firestore must not delay the port). Anything
   * asking "does this canvas owe the mirror something" in that window would
   * otherwise be told no — and the thing that asks is `gc`, whose answer to no
   * is to delete blobs.
   */
  start(): Promise<void> {
    this.unsubscribe = this.options.engine.onEvent((projectId, message) => {
      if (message.type === "project-deleted") return void this.stopCanvas(projectId);
      if (message.type === "op-applied") this.touch(this.canvases.get(projectId));
    });
    this.ready = this.adopt();
    return this.ready;
  }

  private async adopt(): Promise<void> {
    for (const projectId of await this.sharedCanvases()) {
      await this.open(projectId);
    }
  }

  /**
   * A canvas has just been shared. `isocan share` runs in the CLI, not in the
   * daemon, so the daemon is told rather than left to notice — a filesystem
   * watch would be a second way to learn the same fact, and two ways to learn
   * one fact is two ways to learn it wrong.
   */
  async notice(projectId: string): Promise<MirrorStatus | null> {
    // A parked canvas is exactly the one a host runs `isocan share` about, and
    // the message it printed told them to. So the poke is also the retry: drop
    // what gave up, and the credential cached with it, and try the whole thing
    // again from the record on disk — which is where whatever they just fixed
    // will have landed.
    if (this.canvases.get(projectId)?.status.parked) {
      const firebaseProject = this.canvases.get(projectId)!.firebaseProject;
      this.stopCanvas(projectId);
      this.remotes.delete(firebaseProject);
    }
    await this.open(projectId);
    return this.status(projectId);
  }

  /**
   * Resolves when this canvas owes the mirror nothing. What `Engine.gc` awaits:
   * compaction is free to drop entries the mirror already holds, but sweeping a
   * blob the mirror has never seen would strand it, and the window where that
   * is possible is exactly "still catching up".
   */
  async pending(projectId: string): Promise<void> {
    // Startup first: a canvas this daemon has not adopted YET owes the mirror
    // everything, and answering "nothing" during that window is how a sweep
    // deletes bytes that were never published.
    await this.ready.catch(() => {});
    await this.opening.get(projectId);
    const canvas = this.canvases.get(projectId);
    if (canvas) await canvas.idle;
  }

  status(projectId: string): MirrorStatus | null {
    return this.canvases.get(projectId)?.status ?? null;
  }

  statuses(): MirrorStatus[] {
    return [...this.canvases.values()].map((canvas) => canvas.status);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    const running = [...this.canvases.values()].map((canvas) => {
      canvas.stopped = true;
      canvas.wake?.();
      return canvas.running;
    });
    this.canvases.clear();
    await Promise.allSettled(running);
  }

  /* ── which canvases are ours ──────────────────────────────────────────── */

  /**
   * The canvases this home hosts, from the provisioning records under
   * `~/.isocan/remotes`. Asking the HOME rather than a directory marker is the
   * point: the marker travels with the repo, so a teammate's clone claims to
   * know where the canvas lives — and it does, but that teammate is not its
   * host and has neither the credential nor the authority to write its mirror.
   * A record here is this machine saying "I provisioned that", which is the
   * only question whose answer makes a daemon a writer.
   */
  private async sharedCanvases(): Promise<string[]> {
    const ids: string[] = [];
    for (const record of await this.records()) {
      for (const projectId of Object.keys(record.canvases ?? {})) ids.push(projectId);
    }
    return ids;
  }

  private async records(): Promise<RemoteRecordShape[]> {
    let names: string[];
    try {
      names = await fs.readdir(p.remotesDir(this.options.home));
    } catch {
      return [];
    }
    const records: RemoteRecordShape[] = [];
    for (const name of names.sort()) {
      // `<project>.key.json` and `<project>.deploy` share this directory.
      if (!name.endsWith(".json") || name.endsWith(".key.json")) continue;
      const record = await readJson<RemoteRecordShape>(
        path.join(p.remotesDir(this.options.home), name),
      );
      if (record?.firebaseProject) records.push(record);
    }
    return records;
  }

  private async recordFor(projectId: string): Promise<RemoteRecordShape | null> {
    for (const record of await this.records()) {
      if (record.canvases && projectId in record.canvases) return record;
    }
    return null;
  }

  /* ── opening a canvas ─────────────────────────────────────────────────── */

  private async open(projectId: string): Promise<void> {
    if (this.closed || this.canvases.has(projectId)) return;
    // Two pokes for one canvas must not open it twice: the second would be a
    // second pump writing the same seqs from its own cursor.
    const existing = this.opening.get(projectId);
    if (existing) return existing;
    const work = this.openNow(projectId).finally(() => this.opening.delete(projectId));
    this.opening.set(projectId, work);
    return work;
  }

  private async openNow(projectId: string): Promise<void> {
    const record = await this.recordFor(projectId);
    if (!record?.firebaseProject) return;
    const remote = await this.remoteFor(record);
    if (!remote) return;

    const stored = await this.options.store.readMirrorState(projectId);
    const canvas: Canvas = {
      projectId,
      firebaseProject: record.firebaseProject,
      ...(record.storageBucket !== undefined ? { bucket: record.storageBucket } : {}),
      remote,
      state: { lastMirroredSeq: stored.lastMirroredSeq, uploaded: new Set(stored.uploadedBlobs) },
      running: Promise.resolve(),
      idle: Promise.resolve(),
      dirty: false,
      wake: null,
      stopped: false,
      failures: 0,
      status: {
        mirroring: true,
        projectId,
        firebaseProject: record.firebaseProject,
        mirroredSeq: stored.lastMirroredSeq,
        blobs: stored.uploadedBlobs.length,
        behind: false,
        ...(record.storageBucket
          ? {}
          : {
              blobsUnavailable:
                "this project has no Cloud Storage bucket — ops are published, item content is not",
            }),
      },
    };
    if (this.closed) return;
    this.canvases.set(projectId, canvas);
    canvas.running = this.pump(canvas);
  }

  /** One `Remote` per FIREBASE project, not per canvas: the credential belongs
   * to the project, and several canvases in one project should share one cached
   * access token rather than mint one each. */
  private async remoteFor(record: RemoteRecordShape): Promise<Remote | null> {
    const firebaseProject = record.firebaseProject!;
    if (this.remotes.has(firebaseProject)) return this.remotes.get(firebaseProject)!;
    let remote: Remote | null = null;
    try {
      remote = this.options.remoteFor
        ? await this.options.remoteFor({
            firebaseProject,
            ...(record.keyFile !== undefined ? { keyFile: record.keyFile } : {}),
            ...(record.storageBucket !== undefined ? { storageBucket: record.storageBucket } : {}),
          })
        : await defaultRemote(record);
    } catch (err) {
      this.notify(`cannot use the credential for ${firebaseProject}: ${reasonOf(err)}`);
    }
    this.remotes.set(firebaseProject, remote);
    return remote;
  }

  /** Mark, then nudge. The mark is what a busy pump reads later; the nudge is
   * for the case where it is already asleep. */
  private touch(canvas: Canvas | undefined): void {
    if (!canvas) return;
    canvas.dirty = true;
    canvas.wake?.();
  }

  private stopCanvas(projectId: string): void {
    const canvas = this.canvases.get(projectId);
    if (!canvas) return;
    canvas.stopped = true;
    canvas.wake?.();
    this.canvases.delete(projectId);
  }

  /* ── the pump ─────────────────────────────────────────────────────────── */

  /**
   * Ship everything past the cursor, then sleep until something happens. The
   * loop is deliberately the same on the first pass over a year of history and
   * on the thousandth pass over one new op: backfill is not a mode.
   */
  private async pump(canvas: Canvas): Promise<void> {
    let settleIdle = () => {};
    const markBusy = () => {
      if (canvas.status.behind) return;
      canvas.status.behind = true;
      canvas.idle = new Promise<void>((resolve) => (settleIdle = resolve));
    };
    const markIdle = () => {
      canvas.status.behind = false;
      settleIdle();
    };

    markBusy();
    while (!canvas.stopped) {
      let drained = false;
      // Cleared BEFORE the log is read, never after: anything that lands from
      // here on re-dirties, and the pass below cannot have accounted for it.
      canvas.dirty = false;
      try {
        drained = await this.drain(canvas);
        canvas.failures = 0;
        delete canvas.status.error;
      } catch (err) {
        // A canvas that is gone is gone. The record under `remotes/` still
        // names it — deleting a canvas does not un-share it, and #72's
        // `unshare` is what tidies the remote — so without this a soft-deleted
        // project would have a pump retrying `project not found` forever.
        const permanent =
          err instanceof ProjectNotFoundError || (err instanceof RemoteError && err.permanent);
        const reason = reasonOf(err);
        // Said once per distinct problem: an outage that lasts an hour is one
        // piece of news, not two hundred.
        if (canvas.status.error !== reason) {
          this.notify(`${canvas.projectId} → ${canvas.firebaseProject}: ${reason}`);
        }
        canvas.status.error = reason;
        if (permanent) {
          // Retrying a revoked credential or a deleted project only makes the
          // same mistake more often. Park; `isocan share` re-opens the canvas.
          //
          // Parked is NOT idle. `behind` stays true, because this canvas owes
          // the mirror everything from here on and saying otherwise would make
          // `isocan share` report "caught up" about a canvas that has stopped,
          // and would let `gc` sweep blobs that were never published. What
          // resolves is only the promise gc waits on — a mirror that has given
          // up must not wedge the daemon's maintenance forever.
          canvas.status.parked = true;
          settleIdle();
          return;
        }
        canvas.failures += 1;
        await canvas.remote.sleep(backoffMs(canvas.failures));
        continue;
      }

      // More to ship, or something arrived while we were shipping — either way
      // go straight round again rather than claiming to be caught up.
      if (!drained || canvas.dirty) continue;
      markIdle();
      if (canvas.stopped) return;
      await new Promise<void>((resolve) => {
        canvas.wake = () => {
          canvas.wake = null;
          resolve();
        };
      });
      markBusy();
    }
  }

  /**
   * One pass: the entries past the cursor, their blobs first, then their
   * documents, then the cursor. Returns true when nothing is left to ship.
   *
   * The order is the guarantee. Bytes reach Cloud Storage before the document
   * that names them reaches Firestore, so a guest who can see an item can
   * always fetch it — the mirror never advertises content it has not delivered.
   * And the cursor moves LAST, so the only thing a crash can cost is writing an
   * identical document to the same seq a second time.
   */
  private async drain(canvas: Canvas): Promise<boolean> {
    const { engine, store } = this.options;
    const entries = await engine.getLog(canvas.projectId, canvas.state.lastMirroredSeq);
    if (entries.length === 0) return true;

    // A slice at a time, so a long backfill checkpoints as it goes rather than
    // discovering at the end that it has to start over.
    const slice = entries.slice(0, 200);
    const bucketed = canvas.bucket !== undefined;
    if (bucketed) {
      for (const hash of new Set(slice.flatMap(hashesInEntry))) {
        if (canvas.state.uploaded.has(hash)) continue;
        const blob = await store.getBlob(canvas.projectId, hash);
        // A hash the local store no longer has is one `isocan gc` swept before
        // this canvas was ever shared. Its bytes are gone locally and cannot be
        // conjured; the entry still belongs in the mirror, because history that
        // skips ops would not replay.
        if (!blob) continue;
        await canvas.remote.upload(
          `blobs/${hash}`,
          await fs.readFile(blob.path),
          blob.meta.mimeType,
        );
        canvas.state.uploaded.add(hash);
      }
    }

    const writes: RemoteWrite[] = [];
    for (const entry of slice) {
      const json = JSON.stringify(entry);
      const fields =
        Buffer.byteLength(json) <= MAX_INLINE_ENTRY_BYTES
          ? { seq: { integerValue: String(entry.seq) }, entry: { stringValue: json } }
          : {
              seq: { integerValue: String(entry.seq) },
              entryPath: { stringValue: await this.spill(canvas, entry.seq, json) },
            };
      writes.push({ path: opDocPath(canvas.projectId, entry.seq), fields });
    }
    for (const batch of batchWrites(writes)) await canvas.remote.commit(batch);

    canvas.state.lastMirroredSeq = slice[slice.length - 1]!.seq;
    await store.writeMirrorState(canvas.projectId, {
      lastMirroredSeq: canvas.state.lastMirroredSeq,
      uploadedBlobs: [...canvas.state.uploaded],
    });
    canvas.status.mirroredSeq = canvas.state.lastMirroredSeq;
    canvas.status.blobs = canvas.state.uploaded.size;
    return slice.length === entries.length;
  }

  /**
   * An entry too big to be a Firestore field, put where big things already go.
   *
   * Firestore refuses a property over 1,048,487 bytes, and one entry that large
   * — a pasted essay of a comment, the inverse of a delete that took two
   * thousand items with it — would otherwise stop this canvas mirroring
   * FOREVER: the write is a 400, a 400 is permanent, and every op after it
   * never leaves the machine. The mirror already knows how to put bytes in
   * Cloud Storage, so it puts these there too and the document carries the
   * address instead of the entry.
   *
   * The reader's contract, which #73 implements: a mirror doc has `entry` (the
   * LogEntry as JSON) or `entryPath` (where to fetch that JSON), never neither.
   * #71's storage rules must gate `entries/` on membership exactly as they gate
   * `blobs/` — same secret, same readers, same reason.
   */
  private async spill(canvas: Canvas, seq: number, json: string): Promise<string> {
    if (canvas.bucket === undefined) {
      // Nowhere to put it. This is the one genuinely stuck state left, so it
      // says what it is and what fixes it rather than reading as an outage.
      throw new RemoteError(
        `op ${seq} of ${canvas.projectId} is ${Buffer.byteLength(json).toLocaleString()} bytes, ` +
          "too big for a Firestore document, and this project has no Cloud Storage bucket to " +
          "put it in. Link a billing account and run `isocan share` again — the free tier " +
          "covers it — and mirroring resumes from here.",
        400,
      );
    }
    const target = `entries/${seqDocId(seq)}.json`;
    await canvas.remote.upload(target, Buffer.from(json), "application/json");
    return target;
  }
}

/** Exponential, capped: an outage should be retried patiently, not abandoned,
 * and a minute is short enough that recovery feels immediate. */
export function backoffMs(failures: number): number {
  return Math.min(MAX_BACKOFF_MS, 500 * 2 ** Math.min(failures - 1, 10));
}

async function defaultRemote(record: RemoteRecordShape): Promise<Remote | null> {
  if (!record.keyFile) return null;
  return systemRemote({
    key: await readServiceAccountKey(record.keyFile),
    firebaseProject: record.firebaseProject!,
    ...(record.storageBucket !== undefined ? { bucket: record.storageBucket } : {}),
  });
}

function reasonOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
