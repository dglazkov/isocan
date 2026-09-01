import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { backingOf, type Item } from "@isocan/core";

const src = readFileSync(
  fileURLToPath(new URL("../src/components/ArtifactStage.tsx", import.meta.url)),
  "utf8",
);

const actor = { id: "usr_a", name: "A" };
const version = (id: string, blobHash: string) => ({
  id,
  blobHash,
  mimeType: "text/html",
  filename: "a.html",
  size: 1,
  createdAt: "",
  createdBy: actor,
});

/** Twelve versions with the ninth promoted — the shape that was reported. */
const promoted: Item = {
  id: "itm_1",
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  title: "Screen",
  description: "",
  properties: { file: "src/a.html" },
  versions: Array.from({ length: 12 }, (_, i) => version(`ver_${i + 1}`, `hash_${i + 1}`)),
  currentVersionId: "ver_9",
  createdAt: "",
  createdBy: actor,
  updatedAt: "",
  updatedBy: actor,
};

/**
 * **`force` is the escape hatch on the drift check, so it has to be spent on
 * drift and nothing else.**
 *
 * Promoting v9 of a twelve-version item leaves the file holding v12, because
 * nothing writes a file on its own. That is not somebody editing outside the
 * canvas — it is the canvas moving — and the daemon has always known the
 * difference: `writeBound` refuses on "not anything this canvas ever wrote"
 * and is handed every version's hash.
 *
 * The client did not know it, so this button offered "Overwrite file" and
 * passed `force`, turning the real protection off for the one case that
 * never needed it. If a teammate HAD edited that file, the forced write
 * would have eaten it — while the button explained itself as routine.
 */
describe("saving a promoted item to disk", () => {
  it("reads a file holding another version of itself as behind, not drift", () => {
    // v12's bytes on disk, v9 promoted.
    expect(backingOf(promoted, true, () => "hash_12")?.state).toBe("behind");
    // The promoted one: nothing to do.
    expect(backingOf(promoted, true, () => "hash_9")?.state).toBe("written");
    // Somebody else's work.
    expect(backingOf(promoted, true, () => "hash_theirs")?.state).toBe("drifted");
  });

  it("spends force on drift alone", () => {
    // The press passes `drifted`, never `behind` and never a bare truth.
    expect(src).toContain("onClick={() => void save(drifted)}");
    expect(src).not.toContain("void save(true)");
    expect(src).toContain('const drifted = backing.state === "drifted";');
  });

  it("says which of the two it is, because they need different answers", () => {
    expect(src).toContain('const behind = backing.state === "behind";');
    expect(src).toContain("catches it up");
    expect(src).toContain('"Update file"');
  });
});
