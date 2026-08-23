import type { Readable } from "node:stream";
import type { UploadTicket } from "@isocan/core";

/** What an object store knows about one object without opening it. */
export interface ObjectStat {
  size: number;
  /** When the bytes were last written — the cloud's answer to an mtime, and
   * what blob GC's grace period is measured against. */
  updated: Date;
}

/**
 * Bulk bytes, behind a port we own.
 *
 * There is no first-party GCS emulator and there never has been, so a test
 * suite has three choices: run against a real bucket (a provisioning ask, and
 * a network dependency in `npm test`), run against somebody else's fake (its
 * own approximation, with an error surface that is not GCS's and nobody's to
 * read), or own the boundary. This is owning the boundary — and it is the
 * right answer rather than a concession.
 *
 * The reason is measurement rather than convenience. The architecture's
 * promise is that *the vendor lives in one adapter*. A port with a memory
 * double turns that promise into a number: the untested surface becomes
 * exactly `GcsObjects`, and `GcsObjects` is short enough that reading it is a
 * complete review of it. Test `CloudStore` against a third-party fake instead
 * and the untested surface becomes "the difference between that fake and
 * GCS" — larger, undocumented, and nobody's job.
 *
 * The tradeoff, stated rather than smuggled: snapshot writes, blob bytes and
 * range reads are exercised against a double in this phase. Phase 5 stands
 * the whole thing up on real infrastructure, and the journey is the
 * acceptance suite.
 *
 * Every method takes an object KEY — a full path within one bucket. Nothing
 * here knows what a canvas is; `cloud-store.ts` owns the naming.
 */
export interface ObjectStore {
  put(key: string, data: Buffer, meta: { contentType: string }): Promise<void>;

  /** The whole object, or null if it is not there. For things we know are
   * small — a snapshot, the registry. */
  readAll(key: string): Promise<Buffer | null>;

  /** A stream, optionally a byte range (inclusive both ends, as HTTP means
   * it). Null when the object is not there. */
  openRead(key: string, range?: { start: number; end: number }): Promise<Readable | null>;

  stat(key: string): Promise<ObjectStat | null>;

  /** Idempotent: deleting what is not there is not an error. */
  delete(key: string): Promise<void>;

  /**
   * Add bytes to the END of an object, creating it if absent.
   *
   * The one method here that is not a thin delegation, because **object
   * stores have no append**. The oplog archive is the only thing that wants
   * one, and it wants it for audit rather than for reads, so the
   * implementation is allowed to be a compose (GCS) or a concatenation (the
   * double) as long as the result is what a reader would have gotten from a
   * file that was appended to.
   */
  append(key: string, data: Buffer): Promise<void>;

  /**
   * Somewhere for a client to PUT bytes we must not receive.
   *
   * `ifGenerationMatch0` signs a create-only precondition INTO the request,
   * so a leaked ticket cannot overwrite an object that already exists — blob
   * writes become create-only for the same reason op writes are. That the
   * precondition is honored inside a signed request is the one thing here
   * that no local artifact can confirm; see the phase's Findings.
   */
  signedPutUrl(
    key: string,
    options: {
      contentType: string;
      expiresMs: number;
      ifGenerationMatch0: boolean;
    },
  ): Promise<UploadTicket>;
}
