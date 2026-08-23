import type { Readable } from "node:stream";
import { Storage, type Bucket, type File } from "@google-cloud/storage";
import type { UploadTicket } from "@isocan/core";
import type { ObjectStat, ObjectStore } from "./objects.ts";

/**
 * Google Cloud Storage behind the `ObjectStore` port.
 *
 * Deliberately boring, and kept that way on purpose: this file is the one
 * piece of the phase that no local test can execute, so its whole defence is
 * that it is short enough to read in full and does nothing but delegate. Any
 * branch that appears here is a branch nobody is testing — so if a behavior
 * can live in `cloud-store.ts` instead, it does.
 *
 * Two places where GCS made that impossible, both named rather than hidden:
 * `append` (object stores have no append — see below) and `notFound`, which
 * has to recognize a 404 by its status code because the client library throws
 * rather than returning null.
 */
export class GcsObjects implements ObjectStore {
  private readonly bucket: Bucket;

  constructor(storage: Storage, bucketName: string) {
    this.bucket = storage.bucket(bucketName);
  }

  /** The ordinary construction: application default credentials, one bucket.
   * On Cloud Run that is the runtime service account, and nothing here ever
   * sees a key file. */
  static open(bucketName: string, projectId?: string): GcsObjects {
    return new GcsObjects(new Storage(projectId ? { projectId } : {}), bucketName);
  }

  async put(key: string, data: Buffer, meta: { contentType: string }): Promise<void> {
    // `resumable: false` because every object we write ourselves is small — a
    // snapshot or an archive part. A resumable session for a 40 KiB write is
    // three round trips to save nothing.
    await this.bucket.file(key).save(data, { contentType: meta.contentType, resumable: false });
  }

  async readAll(key: string): Promise<Buffer | null> {
    try {
      const [data] = await this.bucket.file(key).download();
      return data;
    } catch (err) {
      if (notFound(err)) return null;
      throw err;
    }
  }

  async openRead(key: string, range?: { start: number; end: number }): Promise<Readable | null> {
    if (!(await this.exists(key))) return null;
    return this.bucket.file(key).createReadStream(range ? { start: range.start, end: range.end } : {});
  }

  async stat(key: string): Promise<ObjectStat | null> {
    try {
      const [metadata] = await this.bucket.file(key).getMetadata();
      return {
        size: Number(metadata.size ?? 0),
        updated: metadata.updated ? new Date(metadata.updated) : new Date(0),
      };
    } catch (err) {
      if (notFound(err)) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }

  /**
   * Append by COMPOSE, because GCS objects are immutable.
   *
   * Write the new bytes as a scratch object beside the target, ask GCS to
   * concatenate `[target, scratch] → target` server-side, then drop the
   * scratch. The bytes never round-trip through this process, which is the
   * whole reason not to do the obvious read-modify-write: an archive grows
   * without bound and re-uploading it on every compaction would eventually
   * cost more than the compaction saves.
   *
   * The failure mode is honest: a crash between the compose and the delete
   * leaves a scratch object behind. It is named `<key>.part-*`, it is in the
   * canvas's own prefix, and it costs a fraction of a cent — the bucket's
   * lifecycle rule is where that gets swept, not here.
   */
  async append(key: string, data: Buffer): Promise<void> {
    const target = this.bucket.file(key);
    if (!(await this.exists(key))) {
      await target.save(data, { contentType: "application/x-ndjson", resumable: false });
      return;
    }
    const part = this.bucket.file(`${key}.part-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await part.save(data, { contentType: "application/x-ndjson", resumable: false });
    try {
      await this.bucket.combine([target, part] as File[], target);
    } finally {
      await part.delete({ ignoreNotFound: true });
    }
  }

  async signedPutUrl(
    key: string,
    options: { contentType: string; expiresMs: number; ifGenerationMatch0: boolean },
  ): Promise<UploadTicket> {
    const expires = Date.now() + options.expiresMs;
    // Every one of these is SIGNED, and that is the point: a holder of the
    // URL cannot change the object it names, the method, the content type, or
    // the create-only precondition without invalidating the signature.
    const extensionHeaders = options.ifGenerationMatch0
      ? { "x-goog-if-generation-match": "0" }
      : undefined;
    const [url] = await this.bucket.file(key).getSignedUrl({
      version: "v4",
      action: "write",
      expires,
      contentType: options.contentType,
      ...(extensionHeaders ? { extensionHeaders } : {}),
    });
    return {
      url,
      // The client must send these EXACTLY. They are not advice: they are
      // part of what was signed, and an upload that omits one is refused by
      // Google rather than by us, with a message about signatures.
      headers: {
        "Content-Type": options.contentType,
        ...(options.ifGenerationMatch0 ? { "x-goog-if-generation-match": "0" } : {}),
      },
      expiresAt: new Date(expires).toISOString(),
    };
  }

  private async exists(key: string): Promise<boolean> {
    const [exists] = await this.bucket.file(key).exists();
    return exists;
  }
}

/** GCS reports a missing object by throwing. */
function notFound(err: unknown): boolean {
  return (err as { code?: number } | null)?.code === 404;
}
