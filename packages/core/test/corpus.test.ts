import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { checkDesign } from "../src/designcheck.ts";
import { parseDesign } from "../src/designmd.ts";
import { fromDtcg, toDtcg, toCss } from "../src/tokens.ts";

/**
 * **The corpus is the fixture** (research note
 * `2026-08-24-design-systems-and-tokens.md`, recommendation 3). Twelve of the
 * seventy-four DESIGN.md files people actually publish
 * (VoltAgent/awesome-design-md, MIT), checked in so the number cannot drift:
 * on 24 Aug 42 of 74 files errored, 308 errors, and 295 of those were the
 * linter failing valid input — a reference inside a string, a block scalar,
 * an `rgba()`. On 4 Sep the whole corpus reads 13 errors in 13 files, every
 * one a true finding (ten files with no front matter at all, three contrast
 * failures), and this subset holds the two of those it contains.
 *
 * And the export: every file's DTCG is validated against the official
 * 2025.10 schema with ajv, which is how "isocan speaks W3C tokens" stops
 * being a claim in `--help` and becomes a number.
 */
const dir = fileURLToPath(new URL("./fixtures/design-md/", import.meta.url));
const files = readdirSync(dir).filter((name) => name.endsWith(".md")).sort();
const docs = files.map((name) => ({ name, doc: parseDesign(readFileSync(dir + name, "utf8")) }));

describe("the corpus, read by the linter", () => {
  it("is twelve real files, and every front matter reads without a problem", () => {
    expect(files.length).toBe(12);
    for (const { name, doc } of docs) expect(doc.problems, name).toEqual([]);
  });

  it("errors only where the file is wrong: no front matter, or a contrast failure", () => {
    const errors = docs.flatMap(({ name, doc }) =>
      checkDesign(doc)
        .filter((f) => f.severity === "error")
        .map((f) => `${name}: ${f.where} — ${f.what}`),
    );
    expect(errors).toEqual([
      "dell-1996.md: colors.primary — 4.49:1 against the ground — body text needs 4.5:1",
      "kraken.md: colors — no colour tokens",
    ]);
  });

  it("reads a reference inside a value, several of them, and a block scalar", () => {
    const together = docs.find((d) => d.name === "together.ai.md")!.doc;
    const padding = Object.values(together.tokens.components ?? {}).map((c) => c.padding).find((p) => String(p).includes("{spacing."));
    expect(String(padding)).toMatch(/\{spacing\.\w+\} \{spacing\.\w+\}/);
    const nike = docs.find((d) => d.name === "nike.md")!.doc;
    expect(String(nike.tokens.description)).toContain("photography-first");
    expect(Object.keys(nike.tokens.colors ?? {}).length).toBeGreaterThan(3);
  });
});

describe("the export, against the official schema", () => {
  const require = createRequire(import.meta.url);
  const Ajv = require("ajv") as new (opts: object) => { compile: (s: object) => ((d: unknown) => boolean) & { errors?: { instancePath: string; message?: string }[] } };
  const schema = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/dtcg-2025.10.schema.json", import.meta.url)), "utf8"));
  const validate = new Ajv({ strict: false, allErrors: true, logger: false }).compile(schema);

  it("validates for every file — colours, dimensions and typography alike", () => {
    for (const { name, doc } of docs) {
      const out = toDtcg(doc.tokens);
      const ok = validate(out);
      expect(ok, `${name}: ${(validate.errors ?? []).slice(0, 3).map((e) => `${e.instancePath} ${e.message}`).join("; ")}`).toBe(true);
    }
  });

  it("keeps what it could not say, with a reason, and never hands toCss an object on the way back", () => {
    for (const { doc } of docs) {
      const out = toDtcg(doc.tokens) as { $extensions?: Record<string, { unexported?: Record<string, { why: string }> }> };
      for (const entry of Object.values(out.$extensions?.["io.isocan"]?.unexported ?? {})) expect(entry.why.length).toBeGreaterThan(10);
      const back = fromDtcg(out as Record<string, unknown>);
      expect(toCss(back)).not.toContain("[object Object]");
    }
  });
});
