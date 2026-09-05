import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ISOCAN_VERSION, enginesSatisfied, manifestRecord, moduleSlug, moduleWebPath } from "../src/modules.ts";

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
    expect(enginesSatisfied(">=9.0.0", "0.1.0")).toEqual({ ok: false, why: "needs isocan >=9.0.0, and this is 0.1.0" });
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

  it("judges against the version the root manifest declares", () => {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../../../package.json", import.meta.url)), "utf8"));
    expect(ISOCAN_VERSION).toBe(pkg.version);
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
