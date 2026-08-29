import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bindVerdict, claimName, takenSentence } from "../src/claim.ts";

describe("what a directory already claims", () => {
  it("nothing there is free", () => {
    expect(bindVerdict(null, "prj_a")).toBe("free");
    expect(bindVerdict(undefined, "prj_a")).toBe("free");
  });

  it("this canvas's own marker is adoption, not a rebind", () => {
    // The fresh-clone case: the repo already knows which canvas it is and the
    // only thing missing is this machine's roster row. Nothing is written to
    // the repo, which is why it is safe where a rebind is not.
    expect(bindVerdict({ canvasId: "prj_a" }, "prj_a")).toBe("adopt");
  });

  it("somebody else's marker is taken", () => {
    expect(bindVerdict({ canvasId: "prj_b", title: "Acme Board" }, "prj_a")).toBe("taken");
  });

  it("names the canvas, because 'already bound' names nobody", () => {
    expect(takenSentence("/w/repo", { canvasId: "prj_b", title: "Acme Board" })).toBe(
      "/w/repo already belongs to Acme Board",
    );
  });

  it("falls back to the id rather than saying 'undefined'", () => {
    // Markers written before the title key exist in the wild; they are
    // perfectly valid bindings and must still produce a readable sentence.
    expect(claimName({ canvasId: "prj_b" })).toBe("prj_b");
    expect(claimName({ canvasId: "prj_b", title: "   " })).toBe("prj_b");
  });
});

/**
 * **The guard, because this rule was already written down — on ONE surface.**
 *
 * The web refused to rebind a claimed directory; `isocan use` overwrote it
 * without a word. Neither was a mystery: both had reasoned about the case and
 * reached different answers in different files, which is what a rule looks
 * like just before it becomes a bug. So the verdict lives in core and every
 * surface reads it, and this fails the day one of them starts comparing
 * canvas ids by hand again.
 */
describe("every surface reads the same verdict", () => {
  const read = (rel: string) =>
    readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

  it("the bind route, the CLI and the picker all call bindVerdict", () => {
    for (const rel of [
      "../../server/src/http.ts",
      "../../cli/src/main.ts",
      "../../web/src/components/WbFiles.tsx",
    ]) {
      expect(read(rel)).toContain("bindVerdict(");
    }
  });

  it("nobody re-derives 'taken' by hand", () => {
    // The shape the bind route had, and the shape `use` did not have at all.
    // Comments are stripped first: this file's own explanation of the banned
    // move must not be the thing that trips it.
    for (const rel of ["../../server/src/http.ts", "../../cli/src/main.ts"]) {
      const code = read(rel)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      // Marker-shaped names only. A SESSION's canvasId compared against the
      // canvas it belongs to is a different question with the same spelling,
      // and banning that would be banning the language.
      expect(code).not.toMatch(/\b(existing|claim|marker|standing|binding)\.canvasId !== /);
    }
  });
});
