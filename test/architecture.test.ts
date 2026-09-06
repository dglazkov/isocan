import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const doc = readFileSync(`${repo}docs/architecture.md`, "utf8");

/**
 * **"Distance to the map" is a list of ABSENCES, and an absence is the one
 * kind of claim that goes stale without anything failing.**
 *
 * Step 6 of `docs/research/2026-09-06-architecture-review.md`. The section
 * said the Share dialog and the grant routes were unbuilt for the three weeks
 * after phase 14 built them — a document confidently describing a smaller
 * product than the one shipping, with nothing able to tell. It is the same
 * shape `docs/ROADMAP.md` exists to end for a document's status, one level
 * along: a fact kept by hand beside a thing that moves.
 *
 * Not every bullet can be checked mechanically — "queueing bytes offline is a
 * second durable store" is a design position, not a grep. Two can, and those
 * two are the ones most likely to be built by somebody who never opens this
 * file. So they are checked, and the rest carry their reasoning where a reader
 * will meet it.
 */
const section = doc.slice(doc.indexOf("## Distance to the map"));

function grep(pattern: string, ...paths: string[]): string {
  try {
    // A deadline of its own: `execFileSync` blocks the worker thread, so
    // vitest's own timer cannot fire and the test's budget is a wish
    // (`syncexec.test.ts` holds this for every synchronous exec in the suite).
    return execFileSync("git", ["grep", "-l", pattern, "--", ...paths], {
      cwd: repo,
      encoding: "utf8",
      timeout: 30_000,
    });
  } catch {
    return ""; // git grep exits 1 when it finds nothing
  }
}

describe("what the architecture says it does not have yet", () => {
  it("is a section that still exists to be checked", () => {
    // The cheapest way for this file to become decorative is for the heading
    // to be renamed and every assertion below to quietly pass on "".
    expect(doc, "the inventory heading moved").toContain("## Distance to the map");
    expect(section.length).toBeGreaterThan(200);
  });

  it("no longer calls the Share dialog or the grant routes unbuilt", () => {
    /**
     * The exact staleness the review found, held so it cannot come back. Both
     * are demonstrably here — which is what made the claim checkable, and what
     * makes leaving it a bug rather than a matter of opinion.
     */
    expect(existsSync(`${repo}packages/web/src/components/ShareDialog.tsx`), "ShareDialog.tsx").toBe(true);
    expect(readFileSync(`${repo}packages/server/src/http.ts`, "utf8")).toContain('"/api/projects/:id/grants"');
    const claim = /The Share dialog and grant routes[^*]/.exec(section);
    expect(
      claim?.[0],
      "the Share dialog and the grant routes are built; the inventory must not list them as missing",
    ).toBeUndefined();
  });

  it("is right that no client branches on MAX_DIRECT_UPLOAD_BYTES", () => {
    /**
     * The bullet says the daemon serves the ticket and neither client uses it.
     * If somebody builds that branch, this fails and the inventory gets
     * corrected in the same commit — which is the whole point: a doc that
     * cannot be wrong silently is a doc worth reading.
     */
    const clients = grep("MAX_DIRECT_UPLOAD_BYTES", "packages/cli/src", "packages/web/src", "packages/api/src");
    expect(
      clients.trim(),
      "a client now branches on MAX_DIRECT_UPLOAD_BYTES — update docs/architecture.md's " +
        '"Distance to the map", which still says neither does',
    ).toBe("");
    expect(section, "and the bullet naming it is still there").toContain("MAX_DIRECT_UPLOAD_BYTES");
  });

  it("is right that blobs still cannot be added offline", () => {
    // The other checkable one: phase 10 cut exactly this, and the tell is that
    // the upload path has no durable byte queue behind it.
    const queued = grep("queueBlob\\|pendingBlobs\\|blobQueue", "packages/web/src");
    expect(
      queued.trim(),
      'bytes look queueable offline now — update "Distance to the map", which says they are not',
    ).toBe("");
    expect(section).toContain("Blobs offline");
  });
});
