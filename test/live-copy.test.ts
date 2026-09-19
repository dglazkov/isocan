import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **The one deliberate copy in this repo, held to being a copy.**
 *
 * `packages/modules/talk/src/live.ts` is a duplicate of
 * `packages/voice-agent/src/live.ts`, and the duplication is on purpose: the
 * talk module must carry no dependency on the harness package, so it cannot
 * import the file it needs. The copy's own header says the harness file is
 * the owner and that the two are *"reconciled by hand"*.
 *
 * Reconciled by hand is a comment, and this repository's standing argument is
 * that **a bound nothing enforces is a comment** — the same sentence the small
 * personas note used about "cheap". Nothing checked the two files agreed, so
 * the first change to either would silently fork the canvas facts a live
 * session is handed: the browser dialog would describe the canvas one way and
 * the standing harness another, which is precisely the drift the shared
 * function was written to prevent.
 *
 * #337 was that first change. This is the guard it left behind.
 *
 * **What this deliberately does not do** is fix the duplication. Whether the
 * module should reach the harness's file some other way is a design question
 * with a real constraint behind it; until somebody answers it, the copy is
 * allowed and the drift is not.
 */
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const OWNER = "packages/voice-agent/src/live.ts";
const COPY = "packages/modules/talk/src/live.ts";

/** The copy's licence to differ: one block, at the top, saying it is a copy.
 *  Everything after it must match the owner byte for byte. */
function withoutCopyHeader(copy: string): string {
  const open = copy.indexOf("/**");
  const close = copy.indexOf("*/", open);
  expect(open, `${COPY} should open with a block comment`).toBe(0);
  const header = copy.slice(open, close + 2);
  expect(header).toContain(`COPY of ${OWNER}`);
  return copy.slice(close + 2).replace(/^\n+/, "");
}

describe("the talk module's copy of the live provider face", () => {
  it("is the harness's file exactly, apart from the header that says it is a copy", () => {
    const owner = read(OWNER);
    const body = withoutCopyHeader(read(COPY));
    // The owner's own leading block comment starts the body of both files.
    expect(body).toBe(owner);
  });

  it("would notice a change made to one and not the other", () => {
    // Falsification: the assertion above is only worth having if an edit to
    // either file breaks it. A byte appended to the owner must not still
    // equal the copy's body.
    const owner = read(OWNER);
    const body = withoutCopyHeader(read(COPY));
    expect(body).not.toBe(owner + "// a change made to one file only\n");
  });

  it("still says which file is the owner, so a reconciliation has a direction", () => {
    const copy = read(COPY);
    expect(copy).toContain("The harness\n * file remains the owner");
  });
});
