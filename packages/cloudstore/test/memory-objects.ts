import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import http from "node:http";
import { Readable } from "node:stream";
import type { UploadTicket } from "@isocan/core";
import type { ObjectStat, ObjectStore } from "../src/objects.ts";

/**
 * The `ObjectStore` port, in one process, over a `Map`.
 *
 * This is the double the `CloudStore` suites run against, and it is worth
 * being precise about what that buys and what it does not. It buys: every
 * line of `CloudStore` that decides WHAT to store and WHERE — the snapshot
 * cadence, the archive, the overflow branch, the blob addressing, the
 * upload-and-register round trip — exercised for real, against a real
 * Firestore. It does not buy: any claim about Google Cloud Storage. That
 * claim lives entirely in `GcsObjects`, which is why that file is kept short
 * enough to review by reading.
 *
 * The signed-URL half is a real HMAC over a real canonical string, verified
 * on the way back in — so a `CloudStore` that signed the wrong object name or
 * let the client change the content type is caught here. It is still a double
 * signing for itself, which is exactly why `signed-url.test.ts` exists
 * separately and verifies a genuine V4 RSA signature against the canonical
 * request with `node:crypto`.
 */
export class MemoryObjects implements ObjectStore {
  private readonly data = new Map<string, { bytes: Buffer; contentType: string; updated: Date }>();
  private readonly secret = randomBytes(32);
  private server: http.Server | null = null;
  private origin = "https://memory-objects.invalid";

  /** Start the listener the signed-URL round trip PUTs to. Only the tests
   * that perform a round trip need it. */
  async listen(): Promise<string> {
    if (this.server) return this.origin;
    const server = http.createServer((req, res) => this.handle(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    this.server = server;
    this.origin = `http://127.0.0.1:${port}`;
    return this.origin;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = null;
  }

  /** What is actually stored, for tests that want to look. */
  keys(): string[] {
    return [...this.data.keys()].sort();
  }

  async put(key: string, bytes: Buffer, meta: { contentType: string }): Promise<void> {
    this.data.set(key, { bytes: Buffer.from(bytes), contentType: meta.contentType, updated: new Date() });
  }

  async readAll(key: string): Promise<Buffer | null> {
    const found = this.data.get(key);
    return found ? Buffer.from(found.bytes) : null;
  }

  async openRead(key: string, range?: { start: number; end: number }): Promise<Readable | null> {
    const found = this.data.get(key);
    if (!found) return null;
    const bytes = range ? found.bytes.subarray(range.start, range.end + 1) : found.bytes;
    return Readable.from([Buffer.from(bytes)]);
  }

  async stat(key: string): Promise<ObjectStat | null> {
    const found = this.data.get(key);
    return found ? { size: found.bytes.length, updated: found.updated } : null;
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  /** What a compose does, without the compose. */
  async append(key: string, bytes: Buffer): Promise<void> {
    const found = this.data.get(key);
    if (!found) return this.put(key, bytes, { contentType: "application/x-ndjson" });
    found.bytes = Buffer.concat([found.bytes, bytes]);
    found.updated = new Date();
  }

  async signedPutUrl(
    key: string,
    options: { contentType: string; expiresMs: number; ifGenerationMatch0: boolean },
  ): Promise<UploadTicket> {
    const expires = Date.now() + options.expiresMs;
    const generation = options.ifGenerationMatch0 ? "0" : "";
    const url = new URL(`${this.origin}/${encodeURIComponent(key)}`);
    url.searchParams.set("expires", String(expires));
    url.searchParams.set("contentType", options.contentType);
    if (generation) url.searchParams.set("ifGenerationMatch", generation);
    url.searchParams.set("sig", this.sign(key, options.contentType, expires, generation));
    return {
      url: url.toString(),
      headers: {
        "Content-Type": options.contentType,
        ...(options.ifGenerationMatch0 ? { "x-goog-if-generation-match": "0" } : {}),
      },
      expiresAt: new Date(expires).toISOString(),
    };
  }

  private sign(key: string, contentType: string, expires: number, generation: string): string {
    return createHmac("sha256", this.secret)
      .update(["PUT", key, contentType, String(expires), generation].join("\n"))
      .digest("hex");
  }

  /**
   * The other end of the ticket. Refuses everything a real signed URL would
   * refuse — a changed object name, a changed content type, an expired URL, a
   * missing `x-goog-if-generation-match: 0` on a create-only ticket, and that
   * precondition failing against an object that is already there.
   */
  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? "/", this.origin);
    const key = decodeURIComponent(url.pathname.slice(1));
    const expires = Number(url.searchParams.get("expires") ?? 0);
    const contentType = url.searchParams.get("contentType") ?? "";
    const generation = url.searchParams.get("ifGenerationMatch") ?? "";
    const presented = Buffer.from(url.searchParams.get("sig") ?? "", "utf8");

    const fail = (status: number, why: string) => {
      res.writeHead(status, { "Content-Type": "text/plain" });
      res.end(why);
    };
    if (req.method !== "PUT") return fail(405, "signed for PUT");
    const expected = Buffer.from(this.sign(key, contentType, expires, generation), "utf8");
    if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
      return fail(403, "signature does not match this request");
    }
    if (Date.now() > expires) return fail(403, "expired");
    if ((req.headers["content-type"] ?? "") !== contentType) {
      return fail(403, "Content-Type is signed and does not match");
    }
    if (generation === "0") {
      if (req.headers["x-goog-if-generation-match"] !== "0") {
        return fail(403, "x-goog-if-generation-match is signed and was not sent");
      }
      if (this.data.has(key)) return fail(412, "precondition failed: object already exists");
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      void this.put(key, Buffer.concat(chunks), { contentType }).then(() => {
        res.writeHead(200);
        res.end();
      });
    });
  }
}
