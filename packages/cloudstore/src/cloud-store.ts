import { createHash, randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import type { CollectionReference, DocumentData, Firestore } from "@google-cloud/firestore";
import type {
  ActorRegistry,
  LogEntry,
  Canvas,
  CanvasState,
  SlashCommand,
  UploadTicket,
} from "@isocan/core";
import {
  applyActorColor,
  applyActorJoin,
  applyActorMark,
  applyOperation,
  bindName,
  COMMAND_NAME,
  emptyCanvas,
  extensionFor,
  OplogFencedError,
  OpValidationError,
  parseCommandFile,
  emptyActorRegistry,
} from "@isocan/core";
import type {
  BlobListing,
  BlobMeta,
  BlobUploadRequest,
  LoadedCanvas,
  Store,
} from "@isocan/server";
import type { ObjectStore } from "./objects.ts";
import {
  ACTORS,
  ACTORS_SNAPSHOT,
  archiveKey,
  blobKey,
  blobMetaCollection,
  canvasDoc,
  CANVASES,
  COMMANDS,
  opOverflowKey,
  opsCollection,
  padSeq,
  snapshotKey,
} from "./naming.ts";

/** gRPC `ALREADY_EXISTS`. What a create-only precondition refuses with, and
 * the single fact this whole backing's safety rests on. */
const ALREADY_EXISTS = 6;

/**
 * Above this, a log entry's bytes go to the object store and the document
 * keeps a pointer. Firestore's hard document limit is 1 MiB; this leaves room
 * for the denormalized fields and for the encoding overhead nobody remembers.
 *
 * No op carries unbounded data — ink lives in blobs, not ops — so the biggest
 * realistic entry is an `items.move` over an enormous selection, and an entry
 * carries its inverse too, so it is roughly double. That is about fifteen
 * thousand moved items: unlikely, not impossible, and a silent write failure
 * at the durability boundary is the worst failure this system has. The object
 * is written BEFORE the document, so the create-only ack still means durable.
 */
const OP_OVERFLOW_BYTES = 900 * 1024;

/** How long a client has to use an upload ticket. Minutes, not days: the URL
 * is a capability, and it is minted the moment before it is used. */
const UPLOAD_TTL_MS = 15 * 60 * 1000;

/** Firestore refuses a batch over 500 writes. */
const BATCH_LIMIT = 400;

export interface CloudStoreOptions {
  firestore: Firestore;
  objects: ObjectStore;
  /** Flush the snapshot after this many ops… */
  snapshotEveryOps?: number;
  /** …or this long, whichever comes first. */
  snapshotEveryMs?: number;
  /** Called on close, after the last flush. The daemon shares one Firestore
   * between the store and the desk, so terminating it is neither one's to do
   * alone. */
  shutdown?: () => Promise<void>;
}

interface PendingSnapshot {
  state: CanvasState;
  lastSeq: number;
  opsSince: number;
  lastFlushMs: number;
  timer?: NodeJS.Timeout | undefined;
}

interface SnapshotObject {
  lastSeq: number;
  items: CanvasState["canvas"]["items"];
  threads: CanvasState["canvas"]["threads"];
  trash: CanvasState["canvas"]["trash"];
  /** Standing agents (agents-on-demand phase 2). Absent in snapshots written
   * before the field — those predate any `agent.enroll` op, so absent means
   * empty, never lost. */
  agents?: CanvasState["canvas"]["agents"];
}

/**
 * The hosted home's disk: Firestore for the log and the small documents,
 * object storage for the bulk.
 *
 * ## The one idea
 *
 * The op document's id IS its seq, zero-padded, and every op write is a
 * `create()` — a server-side precondition, not a read-then-write. Two
 * instances overlapping during a rollout cannot interleave a log: the second
 * is refused by the schema itself, from any two processes, with no window.
 * That guarantee is absolute only while a claimed seq stays claimed, which is
 * why compaction here **deletes nothing** (see `compactOplog`).
 *
 * ## What is different from a disk, and why it is allowed to be
 *
 * `saveSnapshot` is DEBOUNCED. The engine still calls it after every op — the
 * seam is unchanged and the engine cannot tell — but a full-canvas object
 * write on every op would put a bucket round trip on the durability path for
 * data that is derived. The log is truth; a snapshot is a fast boot. The
 * consequence is real and worth stating: a cloud boot routinely finds a
 * snapshot that lags, so `recoveredSeqs` is normally NON-EMPTY where a file
 * home's is normally empty. Recovery stops being the exceptional path and
 * becomes the everyday one — which is what the architecture wanted when it
 * put dev on min-instances 0.
 *
 * ## Two Firestore rules that shape the schema rather than the code
 *
 * A `LogEntry` is stored as an OPAQUE JSON STRING, not a structured map. The
 * oplog is read exactly one way — by seq range, replayed through the reducer
 * — so structure buys no query we will ever make, and it would cost every
 * future op author a list of type rules to keep in their head (`undefined` is
 * rejected outright, arrays may not nest, map keys are constrained, `Date`s
 * coerce). Storing the entry as the JSON already on the wire means a new
 * `Operation` shape can never break persistence. The denormalized
 * `seq`/`ts`/`actorId`/`opType`/`writer` fields beside it are for the console
 * and the audit story, and are cheap.
 *
 * And ids that increase monotonically concentrate on one tablet — Firestore's
 * "500/50/5" rule, roughly 500 writes/sec without ramping. Ours are monotonic
 * by construction and must be, because the seq IS the precondition. At one
 * writer per canvas and human-driven ops we are three orders of magnitude
 * below it; it is named in the map's ceiling paragraph rather than designed
 * around.
 */
export class CloudStore implements Store {
  private readonly db: Firestore;
  private readonly objects: ObjectStore;
  private readonly snapshotEveryOps: number;
  private readonly snapshotEveryMs: number;
  private readonly shutdown: (() => Promise<void>) | undefined;
  private readonly pending = new Map<string, PendingSnapshot>();
  /** The canvas metadata last written to each canvas document, so the
   * document is rewritten when it CHANGES rather than once per op. */
  private readonly writtenCanvas = new Map<string, string>();
  /** This boot, named. Stamped on every op document so a fenced writer can
   * say who beat it rather than only that it lost. */
  readonly writerId = randomUUID().slice(0, 8);

  constructor(options: CloudStoreOptions) {
    this.db = options.firestore;
    this.objects = options.objects;
    this.snapshotEveryOps = options.snapshotEveryOps ?? 50;
    this.snapshotEveryMs = options.snapshotEveryMs ?? 5_000;
    this.shutdown = options.shutdown;
  }

  /** Nothing to create: Firestore has no schema to declare and the bucket is
   * provisioned outside the process. */
  async init(): Promise<void> {}

  async close(): Promise<void> {
    for (const id of [...this.pending.keys()]) await this.flushSnapshot(id);
    await this.shutdown?.();
  }

  // ---- canvases ----

  async listCanvases(): Promise<Canvas[]> {
    const found = await this.db.collection(CANVASES).where("deleted", "==", false).get();
    const canvases: Canvas[] = [];
    for (const doc of found.docs) {
      // `project` is the stored FIELD NAME, a deliberate holdout (phase 13.5):
      // every canvas document in dev's Firestore already carries it.
      const record = doc.data()["project"] as Canvas | undefined;
      if (record) canvases.push(record);
    }
    canvases.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return canvases;
  }

  /** A bucket has no directories and Firestore has no schema, so there is
   * nothing to make. The name is a filesystem word for "make room for a
   * canvas" and it stays — renaming it would churn the engine and its tests
   * for cosmetics, and phase 1's lesson is that an honest leaky seam beats a
   * speculative clean one. */
  async createCanvasDir(_id: string): Promise<void> {}

  /**
   * True for a soft-DELETED canvas too, and that is deliberate.
   *
   * The engine asks this exactly once — to refuse `project.create` on an id
   * that is taken — and in this backing an id stays taken forever: the ops
   * are still there, at seqs 1..N, because compaction and deletion never free
   * a seq. Answering false would let a create through and it would be
   * refused two lines later by the create-only precondition, surfacing as
   * `writer-fenced` — which would be a lie, since there is no other writer.
   * `duplicate-id` is the truth, and it is the word the vocabulary already
   * has for it.
   *
   * This is the one place the two backings genuinely differ in what they
   * ALLOW rather than in what they return: a file home frees the id by moving
   * the directory aside. Canvas ids are minted, never chosen, so nothing
   * reaches this in practice — but it is a difference, so it is written down
   * and each backing asserts its own half.
   */
  async canvasExists(id: string): Promise<boolean> {
    return (await this.db.doc(canvasDoc(id)).get()).exists;
  }

  async load(id: string): Promise<LoadedCanvas | null> {
    const canvas = await this.db.doc(canvasDoc(id)).get();
    if (!canvas.exists) return null;
    const data = canvas.data()!;
    if (data["deleted"] === true) return null;
    const record = data["project"] as Canvas | undefined; // stored field name: holdout
    if (!record) return null;
    const compactedThrough = (data["compactedThrough"] as number | undefined) ?? 0;

    const snapshot = await this.readSnapshot(id);
    let state: CanvasState = {
      project: record,
      canvas: snapshot
        ? {
            items: snapshot.items,
            threads: snapshot.threads,
            trash: snapshot.trash,
            agents: snapshot.agents ?? {},
          }
        : { ...emptyCanvas(), trash: [] },
    };
    let lastSeq = snapshot?.lastSeq ?? 0;
    const entries = await this.readOps(id, compactedThrough);

    // The crash-recovery path, unchanged, now reading from the cloud — and on
    // this backing it is the ordinary path rather than the exceptional one.
    const recoveredSeqs: number[] = [];
    for (const entry of entries) {
      if (entry.seq <= lastSeq) continue;
      if (entry.envelope.op.type === "project.create") continue; // the canvas doc exists
      const next = applyOperation(state, entry.envelope);
      if (next === null) return null; // replayed a project.delete — treat as gone
      state = next;
      lastSeq = entry.seq;
      recoveredSeqs.push(entry.seq);
    }
    if (recoveredSeqs.length > 0) await this.writeSnapshot(id, state, lastSeq);
    return { state, lastSeq, entries, recoveredSeqs };
  }

  async saveCanvas(canvas: Canvas): Promise<void> {
    await this.writeCanvasDoc(canvas);
  }

  /**
   * Debounced. The pending state is held here and flushed when enough ops or
   * enough time have passed, on idle, and on `close()`.
   *
   * The canvas DOCUMENT is not debounced with it, but neither is it written
   * per op: it is written when the canvas metadata actually changes. That
   * matters twice — `canvasExists` and `listCanvases` must answer correctly
   * the instant a canvas is created, and `canvases/{id}` is a single document
   * with Firestore's ~1 write/second limit on it, which a per-op write would
   * walk straight into.
   */
  async saveSnapshot(id: string, state: CanvasState, lastSeq: number): Promise<void> {
    await this.writeCanvasDoc(state.project);
    const pending = this.pending.get(id);
    const now = Date.now();
    if (!pending) {
      this.pending.set(id, { state, lastSeq, opsSince: 1, lastFlushMs: now });
      this.armIdleFlush(id);
      return;
    }
    pending.state = state;
    pending.lastSeq = lastSeq;
    pending.opsSince += 1;
    if (pending.opsSince >= this.snapshotEveryOps || now - pending.lastFlushMs >= this.snapshotEveryMs) {
      await this.flushSnapshot(id);
      return;
    }
    this.armIdleFlush(id);
  }

  /**
   * One create-only document write. The ack IS the fsync.
   *
   * The write is a `create()` rather than a `set()` because that is a
   * SERVER-SIDE precondition (`currentDocument.exists = false`) evaluated on
   * the write path — not a read followed by a write — so there is no window
   * in which two processes both pass it. `ALREADY_EXISTS` means, and can only
   * mean, that another writer has already claimed this seq.
   */
  /**
   * The newest `ops/{seq}` document, by the single-field index Firestore keeps
   * on `seq` — one document read, never the whole collection. Compacted marks
   * keep their seq, so a canvas whose live log was compacted to nothing still
   * answers with the seq it reached; the snapshot's `lastSeq` covers a canvas
   * with a snapshot and no live op (it cannot be ahead of the log, so `max`
   * is belt and braces).
   */
  async tipSeq(id: string): Promise<number | null> {
    const canvas = await this.db.doc(canvasDoc(id)).get();
    if (!canvas.exists || canvas.data()?.["deleted"] === true) return null;
    const newest = await this.db
      .collection(opsCollection(id))
      .orderBy("seq", "desc")
      .limit(1)
      .get();
    const fromLog = newest.empty ? 0 : ((newest.docs[0]!.data()["seq"] as number | undefined) ?? 0);
    const snapshot = await this.readSnapshot(id);
    return Math.max(fromLog, snapshot?.lastSeq ?? 0);
  }

  async appendLog(id: string, entry: LogEntry): Promise<void> {
    const json = JSON.stringify(entry);
    const ref = this.db.collection(opsCollection(id)).doc(padSeq(entry.seq));
    const common = {
      seq: entry.seq,
      ts: entry.envelope.ts,
      actorId: entry.envelope.actor.id,
      opType: entry.envelope.op.type,
      writer: this.writerId,
    };
    let data: DocumentData;
    if (Buffer.byteLength(json, "utf8") > OP_OVERFLOW_BYTES) {
      // Object first, document second: the create-only ack must still mean
      // "this entry is durable and complete".
      await this.objects.put(opOverflowKey(id, entry.seq), Buffer.from(json, "utf8"), {
        contentType: "application/json",
      });
      data = { ...common, overflow: true };
    } else {
      data = { ...common, json };
    }
    try {
      await ref.create(data);
    } catch (err) {
      if ((err as { code?: number }).code === ALREADY_EXISTS) {
        throw new OplogFencedError(id, entry.seq);
      }
      throw err;
    }
  }

  /**
   * Soft, like the file backing's rename-aside, and for a stronger reason
   * here: the ops stay exactly where they are, so every seq this canvas ever
   * used remains claimed. A hard delete would free them all.
   */
  async softDeleteCanvas(id: string): Promise<void> {
    await this.flushSnapshot(id);
    this.pending.delete(id);
    this.writtenCanvas.delete(id);
    await this.db.doc(canvasDoc(id)).set(
      { deleted: true, deletedAt: new Date().toISOString() },
      { merge: true },
    );
  }

  // ---- slash commands ----

  async loadCommands(): Promise<SlashCommand[]> {
    const found = await this.db.collection(COMMANDS).get();
    const commands: SlashCommand[] = [];
    for (const doc of found.docs.sort((a, b) => a.id.localeCompare(b.id))) {
      if (!COMMAND_NAME.test(doc.id)) continue;
      const text = doc.data()["text"];
      if (typeof text !== "string") continue;
      try {
        const parsed = parseCommandFile(doc.id, text);
        if (parsed) commands.push(parsed);
      } catch {
        // One malformed command must not take the menu down with it.
      }
    }
    return commands;
  }

  async saveCommand(name: string, text: string): Promise<void> {
    if (!COMMAND_NAME.test(name)) throw new Error(`not a command name: ${name}`);
    await this.db.collection(COMMANDS).doc(name).set({ text });
  }

  async deleteCommand(name: string): Promise<boolean> {
    if (!COMMAND_NAME.test(name)) throw new Error(`not a command name: ${name}`);
    const ref = this.db.collection(COMMANDS).doc(name);
    const existing = await ref.get();
    if (!existing.exists) return false;
    await ref.delete();
    return true;
  }

  // ---- the actor registry's PUBLIC face ----

  async loadActors(): Promise<{ registry: ActorRegistry; lastSeq: number }> {
    const snapshot = await this.db.doc(ACTORS_SNAPSHOT).get();
    let { registry, lastSeq } = actorsFromDocument(snapshot.data());

    // A document from before `harnesses` learns them from the claims it
    // already folded — the same once-per-home backfill the file store does,
    // and for the same reason: every claim carries its session key.
    const backfill = snapshot.exists && snapshot.data()?.["harnesses"] === undefined;
    const entries = await this.readLog(this.db.collection(ACTORS), backfill ? 0 : lastSeq, (seq) =>
      this.actorOverflowKey(seq),
    );
    let recovered = false;
    for (const entry of entries) {
      const op = entry.envelope.op;
      if (entry.seq <= lastSeq) {
        if (backfill && op.type === "actor.claim") {
          registry = bindName(registry, { actor: entry.envelope.actor, ts: entry.envelope.ts, sessionKey: op.sessionKey });
          recovered = true;
        }
        continue;
      }
      if (op.type === "actor.claim") {
        // Only the PUBLIC half replays; the claims table is desk state and is
        // not reconstructible from here at all (the two-ledger rule).
        registry = bindName(registry, { actor: entry.envelope.actor, ts: entry.envelope.ts, sessionKey: op.sessionKey });
      } else if (op.type === "actor.setColor") {
        registry = applyActorColor(registry, op);
      } else if (op.type === "actor.setMark") {
        registry = applyActorMark(registry, op);
      } else if (op.type === "actor.join") {
        registry = applyActorJoin(registry, op);
      } else {
        continue;
      }
      lastSeq = entry.seq;
      recovered = true;
    }
    if (recovered) await this.saveActors(registry, lastSeq);
    return { registry, lastSeq };
  }

  /**
   * **The whole registry, not a list of its fields** — the same correction the
   * file store took, because this had the same bug and it is the one that
   * reached people.
   *
   * Naming `names` and `colors` dropped `marks` on every write: a chosen
   * emoji applied, was served while the instance lived, and was never in the
   * document. So it did not survive a restart and no teammate ever saw it.
   * This is the third time a field-by-field rebuild has quietly stopped
   * saving something here — `toGrant` dropped `capability` the same way, on
   * this same backing.
   */
  async saveActors(registry: ActorRegistry, lastSeq: number): Promise<void> {
    await this.db.doc(ACTORS_SNAPSHOT).set(actorsToDocument(registry, lastSeq));
  }

  async appendActorsLog(entry: LogEntry): Promise<void> {
    const json = JSON.stringify(entry);
    const ref = this.db.collection(ACTORS).doc(padSeq(entry.seq));
    const common = {
      seq: entry.seq,
      ts: entry.envelope.ts,
      actorId: entry.envelope.actor.id,
      opType: entry.envelope.op.type,
      writer: this.writerId,
    };
    let data: DocumentData;
    if (Buffer.byteLength(json, "utf8") > OP_OVERFLOW_BYTES) {
      await this.objects.put(this.actorOverflowKey(entry.seq), Buffer.from(json, "utf8"), {
        contentType: "application/json",
      });
      data = { ...common, overflow: true };
    } else {
      data = { ...common, json };
    }
    try {
      await ref.create(data);
    } catch (err) {
      if ((err as { code?: number }).code === ALREADY_EXISTS) {
        // The registry is home-scoped, so the "canvas" it names is the home.
        throw new OplogFencedError(ACTORS, entry.seq);
      }
      throw err;
    }
  }

  // ---- blobs ----

  async putBlob(
    id: string,
    data: Buffer,
    meta: { mimeType: string; filename: string },
  ): Promise<{ blobHash: string; size: number; mimeType: string }> {
    const blobHash = createHash("sha256").update(data).digest("hex");
    const ref = this.db.collection(blobMetaCollection(id)).doc(blobHash);
    const existing = await ref.get();
    if (existing.exists) {
      const found = existing.data() as BlobMeta;
      return { blobHash, size: found.size, mimeType: found.mimeType };
    }
    const file = `${blobHash}.${extensionFor(meta.filename, meta.mimeType)}`;
    await this.objects.put(blobKey(id, file), data, { contentType: meta.mimeType });
    const record = {
      file,
      mimeType: meta.mimeType,
      filename: meta.filename,
      size: data.length,
      at: new Date().toISOString(),
    };
    try {
      await ref.create(record);
    } catch (err) {
      // Lost a race to name the same bytes. First upload wins the metadata,
      // which is what the file backing does too — the bytes are identical by
      // construction, so there is nothing to reconcile.
      if ((err as { code?: number }).code !== ALREADY_EXISTS) throw err;
      const found = (await ref.get()).data() as BlobMeta;
      return { blobHash, size: found.size, mimeType: found.mimeType };
    }
    return { blobHash, size: data.length, mimeType: meta.mimeType };
  }

  async blobMeta(id: string, blobHash: string): Promise<BlobMeta | null> {
    const doc = await this.db.collection(blobMetaCollection(id)).doc(blobHash).get();
    return doc.exists ? (doc.data() as BlobMeta) : null;
  }

  async openBlob(
    id: string,
    blobHash: string,
    range?: { start: number; end: number },
  ): Promise<Readable | null> {
    const meta = await this.blobMeta(id, blobHash);
    if (!meta) return null;
    return this.objects.openRead(blobKey(id, meta.file), range);
  }

  async beginUpload(id: string, request: BlobUploadRequest): Promise<UploadTicket> {
    const file = `${request.blobHash}.${extensionFor(request.filename, request.mimeType)}`;
    return this.objects.signedPutUrl(blobKey(id, file), {
      contentType: request.mimeType,
      expiresMs: UPLOAD_TTL_MS,
      // Create-only, for the same reason op writes are: a ticket that leaked
      // must not be able to replace bytes an item already points at.
      ifGenerationMatch0: true,
    });
  }

  async registerBlob(
    id: string,
    request: BlobUploadRequest,
  ): Promise<{ blobHash: string; size: number; mimeType: string }> {
    const file = `${request.blobHash}.${extensionFor(request.filename, request.mimeType)}`;
    const stat = await this.objects.stat(blobKey(id, file));
    if (!stat) {
      throw new OpValidationError("bad-op", `no uploaded bytes under ${request.blobHash}`);
    }
    const ref = this.db.collection(blobMetaCollection(id)).doc(request.blobHash);
    // The SIZE comes from the object store, not from the client — it is the
    // one field we can know without reading the bytes back, and an item that
    // reports the wrong size is a broken download. The HASH is taken on
    // faith; that limit is accepted in writing in the phase's Findings.
    const record = {
      file,
      mimeType: request.mimeType,
      filename: request.filename,
      size: stat.size,
      at: new Date().toISOString(),
    };
    try {
      await ref.create(record);
    } catch (err) {
      if ((err as { code?: number }).code !== ALREADY_EXISTS) throw err;
      const found = (await ref.get()).data() as BlobMeta;
      return { blobHash: request.blobHash, size: found.size, mimeType: found.mimeType };
    }
    return { blobHash: request.blobHash, size: stat.size, mimeType: request.mimeType };
  }

  // ---- garbage collection ----

  /** One collection query. No shared index document exists to read, modify or
   * write — which is the whole reason `blobmeta/{hash}` is one doc per blob,
   * and the reason the engine's loop had to move behind this seam first. */
  async listBlobs(id: string): Promise<BlobListing[]> {
    const found = await this.db.collection(blobMetaCollection(id)).get();
    const now = Date.now();
    return found.docs.map((doc) => {
      const data = doc.data();
      const at = data["at"];
      return {
        hash: doc.id,
        meta: data as BlobMeta,
        // The write time IS this backing's mtime. There is no cheaper answer:
        // a HEAD per blob would be one network round trip per object on every
        // GC pass, to learn a timestamp we already wrote down.
        ageMs: typeof at === "string" ? now - Date.parse(at) : null,
      };
    });
  }

  async deleteBlobs(id: string, hashes: string[]): Promise<void> {
    if (hashes.length === 0) return;
    const collection = this.db.collection(blobMetaCollection(id));
    for (const chunk of chunks(hashes, BATCH_LIMIT)) {
      const refs = chunk.map((hash) => collection.doc(hash));
      const docs = await this.db.getAll(...refs);
      // Bytes first, then the record. A crash between them leaves a record
      // naming nothing, which the next pass collects; the other order would
      // leave bytes nothing can name, which nothing ever collects.
      for (const doc of docs) {
        const meta = doc.data() as BlobMeta | undefined;
        if (meta?.file) await this.objects.delete(blobKey(id, meta.file));
      }
      const batch = this.db.batch();
      for (const ref of refs) batch.delete(ref);
      await batch.commit();
    }
  }

  /**
   * Compaction that DELETES NOTHING.
   *
   * This is the hazard the map did not see, and it is worth stating in full:
   * deleting an op document frees its id, and a create-only precondition on a
   * free id passes. So a sufficiently stale writer — one booted from an old
   * snapshot, exactly the deploy-overlap case the schema exists to defend
   * against — could `create()` a seq the live writer had already used and
   * compacted away, and succeed. The guarantee would have a hole precisely
   * the width of the compaction horizon.
   *
   * So compaction here means: archive the dropped entries, MARK their
   * documents as compacted, and advance a horizon on the canvas document.
   * Every seq ever used stays occupied forever, and the precondition is
   * absolute rather than horizon-limited. The cost is Firestore storage
   * growing with total ops rather than live ops — about a dollar per million
   * ops per month, which is nothing at journey scale.
   *
   * The lever, if a later phase ever needs the stronger thing: read
   * `canvases/{id}.lastSeq` and assert `seq === lastSeq + 1` inside the same
   * transaction as the create. That closes the stale-writer hole at ANY seq,
   * not just below the horizon — at the price of turning every op into a
   * transaction, which is two round trips on the durability path.
   *
   * The horizon is `min(retained) - 1`, not `max(dropped)`, because
   * `chooseRetained` extends its cut to a pair-complete set and can therefore
   * pull an OLD entry back above the line. The mark is what makes the read
   * exact; the horizon is only what bounds it.
   */
  async compactOplog(id: string, retained: LogEntry[], dropped: LogEntry[]): Promise<void> {
    if (dropped.length === 0) return;
    // Flush first: after this, nothing below the horizon is needed to rebuild
    // state, so a boot that reads only the tail is complete.
    await this.flushSnapshot(id);

    const lines = dropped.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
    await this.objects.append(archiveKey(id), Buffer.from(lines, "utf8"));

    const collection = this.db.collection(opsCollection(id));
    for (const chunk of chunks(dropped, BATCH_LIMIT)) {
      const batch = this.db.batch();
      for (const entry of chunk) {
        batch.set(collection.doc(padSeq(entry.seq)), { compacted: true }, { merge: true });
      }
      await batch.commit();
    }

    const maxDropped = Math.max(...dropped.map((entry) => entry.seq));
    const minRetained = retained.length > 0 ? Math.min(...retained.map((e) => e.seq)) : Infinity;
    const horizon = Math.min(minRetained - 1, maxDropped);
    const ref = this.db.doc(canvasDoc(id));
    const previous = ((await ref.get()).data()?.["compactedThrough"] as number | undefined) ?? 0;
    await ref.set({ compactedThrough: Math.max(previous, horizon) }, { merge: true });
  }

  /** The read half of `compactOplog`'s archive: the object is appended
   * oldest-first, so it parses straight into log order. Absent object means
   * nothing has ever been compacted. */
  async readArchivedLog(id: string): Promise<LogEntry[]> {
    const raw = await this.objects.readAll(archiveKey(id));
    if (!raw) return [];
    return raw
      .toString("utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as LogEntry);
  }

  // ---- internals ----

  private actorOverflowKey(seq: number): string {
    return `${ACTORS}/${padSeq(seq)}.json`;
  }

  /** Write the canvas document when the canvas metadata actually changed —
   * see `saveSnapshot` for why this is not per-op. */
  private async writeCanvasDoc(canvas: Canvas): Promise<void> {
    const encoded = JSON.stringify(canvas);
    if (this.writtenCanvas.get(canvas.id) === encoded) return;
    await this.db.doc(canvasDoc(canvas.id)).set(
      // `project` is the stored field name — a deliberate holdout (phase 13.5).
      { project: jsonSafe(canvas), deleted: false },
      { merge: true },
    );
    this.writtenCanvas.set(canvas.id, encoded);
  }

  private async readSnapshot(id: string): Promise<SnapshotObject | null> {
    const raw = await this.objects.readAll(snapshotKey(id));
    if (!raw) return null;
    return JSON.parse(raw.toString("utf8")) as SnapshotObject;
  }

  private async writeSnapshot(id: string, state: CanvasState, lastSeq: number): Promise<void> {
    const snapshot: SnapshotObject = {
      lastSeq,
      items: state.canvas.items,
      threads: state.canvas.threads,
      trash: state.canvas.trash,
      agents: state.canvas.agents ?? {},
    };
    await this.objects.put(snapshotKey(id), Buffer.from(JSON.stringify(snapshot), "utf8"), {
      contentType: "application/json",
    });
  }

  /** Write whatever is pending for this canvas, now. */
  private async flushSnapshot(id: string): Promise<void> {
    const pending = this.pending.get(id);
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    this.pending.delete(id);
    await this.writeSnapshot(id, pending.state, pending.lastSeq);
  }

  /** A canvas that goes quiet still gets its snapshot. `unref` so this is
   * never the reason a process stays alive. */
  private armIdleFlush(id: string): void {
    const pending = this.pending.get(id);
    if (!pending || pending.timer) return;
    pending.timer = setTimeout(() => {
      const current = this.pending.get(id);
      if (current) current.timer = undefined;
      void this.flushSnapshot(id).catch(() => {});
    }, this.snapshotEveryMs);
    pending.timer.unref?.();
  }

  private readOps(id: string, compactedThrough: number): Promise<LogEntry[]> {
    return this.readLog(this.db.collection(opsCollection(id)), compactedThrough, (seq) =>
      opOverflowKey(id, seq),
    );
  }

  /**
   * The tail read, shared by the canvas oplog and the actor registry.
   *
   * `where("seq", ">", floor).orderBy("seq")` — a single-field index, which
   * Firestore maintains automatically. Documents marked `compacted` are
   * skipped: the horizon bounds the read, and the mark makes it exact. Both
   * are needed, because a pair-complete retained set can reach back below the
   * newest dropped entry.
   */
  private async readLog(
    collection: CollectionReference,
    floor: number,
    overflow: (seq: number) => string,
  ): Promise<LogEntry[]> {
    const found = await collection.where("seq", ">", floor).orderBy("seq").get();
    const entries: LogEntry[] = [];
    for (const doc of found.docs) {
      const data = doc.data();
      if (data["compacted"] === true) continue;
      let json: string;
      if (data["overflow"] === true) {
        const raw = await this.objects.readAll(overflow(data["seq"] as number));
        if (!raw) throw new Error(`oplog entry ${doc.id} names an object that is not there`);
        json = raw.toString("utf8");
      } else {
        json = data["json"] as string;
      }
      entries.push(JSON.parse(json) as LogEntry);
    }
    return entries;
  }
}

/**
 * What `JSON.stringify` would have written to a file.
 *
 * Firestore rejects `undefined` outright, and this repo's
 * `exactOptionalPropertyTypes` makes absent-vs-undefined a live distinction —
 * so a record that a file backing would happily write can be refused here for
 * a reason that has nothing to do with isocan. Round-tripping through JSON
 * gives the cloud backing EXACTLY the file backing's semantics (undefined
 * disappears, everything else survives) rather than an approximation of them.
 */
function jsonSafe<T>(value: T): DocumentData {
  return JSON.parse(JSON.stringify(value)) as DocumentData;
}

/**
 * The actors snapshot document, both ways — exported so the round trip can be
 * asserted without a Firestore. `lastSeq` shares the document with the
 * registry but is not part of it, so it is the one key taken back out of the
 * spread; everything else is read back whole, for the reason `saveActors`
 * writes whole: a reader that lists the fields it knows drops the next one
 * somebody adds (`marks` once, and `joined` would have been next).
 */
export function actorsToDocument(registry: ActorRegistry, lastSeq: number): DocumentData {
  return jsonSafe({ lastSeq, ...registry });
}

export function actorsFromDocument(
  data: DocumentData | undefined,
): { registry: ActorRegistry; lastSeq: number } {
  const { lastSeq: _seq, ...saved } = (data ?? {}) as Partial<ActorRegistry> & {
    lastSeq?: number;
  };
  const registry: ActorRegistry = {
    ...emptyActorRegistry(),
    ...saved,
    names: (saved.names as ActorRegistry["names"]) ?? {},
    colors: (saved.colors as ActorRegistry["colors"]) ?? {},
  };
  return { registry, lastSeq: (data?.["lastSeq"] as number | undefined) ?? 0 };
}

function* chunks<T>(items: readonly T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}
