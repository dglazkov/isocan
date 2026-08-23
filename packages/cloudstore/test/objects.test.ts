import { afterEach, describe, expect, it } from "vitest";
import { collect } from "../../../test/conformance/store-conformance.ts";
import { MemoryObjects } from "./memory-objects.ts";

/**
 * The `ObjectStore` port's own contract, against the double.
 *
 * Needs no emulator and no cloud: it is about the port, not about Google. It
 * matters because the double is what every `CloudStore` case stores its bulk
 * in, so a double that quietly disagreed with the port would make those cases
 * assert the wrong thing — and because the contract written here is exactly
 * what `GcsObjects` has to keep, which is the only leverage a review of that
 * file has.
 */

const objects = new MemoryObjects();

afterEach(async () => {
  await objects.stop();
});

describe("ObjectStore — the port's contract", () => {
  it("stores and reads whole objects, and says null for what is not there", async () => {
    await objects.put("a/b.json", Buffer.from("{}"), { contentType: "application/json" });
    expect((await objects.readAll("a/b.json"))!.toString()).toBe("{}");
    expect(await objects.readAll("a/missing.json")).toBeNull();
    expect(await objects.openRead("a/missing.json")).toBeNull();
    expect(await objects.stat("a/missing.json")).toBeNull();
  });

  it("reads a byte range, inclusive on both ends as HTTP means it", async () => {
    await objects.put("r/digits", Buffer.from("0123456789"), { contentType: "text/plain" });
    expect((await collect(await objects.openRead("r/digits", { start: 2, end: 5 })))!.toString()).toBe(
      "2345",
    );
    expect((await collect(await objects.openRead("r/digits")))!.toString()).toBe("0123456789");
  });

  it("stat reports the size and a write time, which is GC's mtime", async () => {
    await objects.put("s/thing", Buffer.from("12345"), { contentType: "text/plain" });
    const stat = (await objects.stat("s/thing"))!;
    expect(stat.size).toBe(5);
    expect(Date.now() - stat.updated.getTime()).toBeLessThan(60_000);
  });

  it("appends to an object that exists, and creates one that does not", async () => {
    // The archive's whole requirement. Object stores have no append, so this
    // is the one method that is not a delegation in either implementation.
    await objects.append("ar/log.jsonl", Buffer.from("one\n"));
    await objects.append("ar/log.jsonl", Buffer.from("two\n"));
    expect((await objects.readAll("ar/log.jsonl"))!.toString()).toBe("one\ntwo\n");
  });

  it("delete is idempotent — deleting what is not there is not an error", async () => {
    await objects.put("d/gone", Buffer.from("x"), { contentType: "text/plain" });
    await objects.delete("d/gone");
    await objects.delete("d/gone");
    expect(await objects.readAll("d/gone")).toBeNull();
  });

  it("a signed URL is scoped to one object, one method and one content type", async () => {
    await objects.listen();
    const ticket = await objects.signedPutUrl("u/one", {
      contentType: "text/plain",
      expiresMs: 60_000,
      ifGenerationMatch0: true,
    });

    // The honest request works…
    const ok = await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body: "hello" });
    expect(ok.status).toBe(200);
    expect((await objects.readAll("u/one"))!.toString()).toBe("hello");

    // …and a create-only ticket cannot be used twice.
    const again = await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body: "bye" });
    expect(again.status).toBe(412);

    // …nor pointed somewhere else, nor used with a different content type.
    // The object name is a percent-encoded path segment, so the redirection
    // has to be performed on the parsed URL rather than by string surgery —
    // the string does not contain the key in the shape it looks like it does.
    const moved = new URL(ticket.url);
    moved.pathname = `/${encodeURIComponent("u/two")}`;
    expect(
      (await fetch(moved.toString(), { method: "PUT", headers: ticket.headers, body: "x" })).status,
    ).toBe(403);
    expect(await objects.readAll("u/two")).toBeNull();
    const wrongType = await fetch(ticket.url, {
      method: "PUT",
      headers: { ...ticket.headers, "Content-Type": "text/html" },
      body: "x",
    });
    expect(wrongType.status).toBe(403);
  });
});
