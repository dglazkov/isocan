import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MODULE_API_VERSION,
  PROPOSED,
  enginesSatisfied,
  manifestRecord,
  moduleSlug,
  moduleWebPath,
  unknownProposals,
} from "../src/modules.ts";

/**
 * **A runtime module's manifest, judged** (`docs/projects/modules/design.md`,
 * phase 3). The engines check refuses with a sentence naming both versions;
 * the record a manifest declares is the code-free half of the module; the
 * slug and the served path are spelled once.
 */
describe("the engines check", () => {
  it("admits anything for * and nothing stated", () => {
    expect(enginesSatisfied(undefined, "0.1.0")).toEqual({ ok: true });
    expect(enginesSatisfied("*", "3.2.1")).toEqual({ ok: true });
  });

  it("reads >= as at least, and says both versions when it refuses", () => {
    expect(enginesSatisfied(">=0.1.0", "0.1.0")).toEqual({ ok: true });
    expect(enginesSatisfied(">=0.1.0", "1.4.0")).toEqual({ ok: true });
    expect(enginesSatisfied(">=9.0.0", "0.1.0")).toEqual({ ok: false, why: "needs module API >=9.0.0, and this build is 0.1.0" });
  });

  it("reads ^ the way npm does — the same line, and the same minor while the major is 0", () => {
    expect(enginesSatisfied("^0.1.0", "0.1.7")).toEqual({ ok: true });
    expect(enginesSatisfied("^0.1.0", "0.2.0").ok).toBe(false);
    expect(enginesSatisfied("^1.2.0", "1.9.0")).toEqual({ ok: true });
    expect(enginesSatisfied("^1.2.0", "2.0.0").ok).toBe(false);
    expect(enginesSatisfied("0.1", "0.1.0")).toEqual({ ok: true });
  });

  it("refuses a range it cannot read rather than guessing", () => {
    const verdict = enginesSatisfied("latest", "0.1.0");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.why).toContain('cannot read the engines range "latest"');
  });

  it("judges against the module API's own version, not the app's", () => {
    /**
     * **This asserted the opposite until 9 Sep 2026**, and that is why the
     * check had never refused anything: it pinned the number to the root
     * package's version, which is 0.1.0 and has never moved, so every range
     * was satisfied by a constant.
     *
     * VS Code can judge `engines.vscode` against the app version because their
     * stable API has not broken since 1.0. Ours is pre-1.0 and changes weekly,
     * so the two numbers answer different questions and must be free to move
     * apart. This holds them apart rather than together.
     */
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../../../package.json", import.meta.url)), "utf8"));
    expect(MODULE_API_VERSION).not.toBe(pkg.version);
    expect(MODULE_API_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("refuses a module built against the API before the host landed", () => {
    /* The break that earned the bump: `InspectorFacts` gained a required
       `host`, so a module compiled against 0.1 cannot run here. `^0.1.0` is
       how such a module pins itself, and this is the first refusal the check
       has ever produced. */
    const verdict = enginesSatisfied("^0.1.0");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.why).toContain("needs module API ^0.1.0");
    expect(enginesSatisfied("^0.2.0").ok).toBe(true);
    expect(enginesSatisfied(">=0.2.0").ok).toBe(true);
    expect(enginesSatisfied("*").ok).toBe(true);
  });

  it("names the parts of the API it intends to change", () => {
    /* A module using one of these must say so, and a home must say yes — the
       bargain that lets the slots keep moving. A proposal this build does not
       know is a refusal with a name rather than a silent partial load. */
    expect(PROPOSED).toContain("host");
    expect(unknownProposals(["overlays", "drops"])).toEqual([]);
    expect(unknownProposals(["overlays", "telepathy"])).toEqual(["telepathy"]);
    expect(unknownProposals(undefined)).toEqual([]);
  });
});

describe("what a manifest declares", () => {
  const manifest = {
    name: "@acme/diagrams",
    version: "0.1.0",
    kinds: [{ id: "diagram", mimes: ["text/vnd.mermaid"], label: "Diagrams", noun: "diagram" }],
    web: "dist/web.js",
  };

  it("is the code-free half of the module", () => {
    expect(manifestRecord(manifest)).toEqual({ name: "@acme/diagrams", kinds: manifest.kinds });
    expect(manifestRecord({ name: "@x/y", version: "1", propertyKeys: ["y.k"] })).toEqual({ name: "@x/y", propertyKeys: ["y.k"] });
  });

  it("is addressed by the package name's last segment, in one spelling", () => {
    expect(moduleSlug("@acme/diagrams")).toBe("diagrams");
    expect(moduleSlug("hello")).toBe("hello");
    expect(moduleWebPath(manifest)).toBe("/modules/diagrams/dist/web.js");
    expect(moduleWebPath({ name: "@x/cli-only", version: "1" })).toBeNull();
  });
});
