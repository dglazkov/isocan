import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { moduleMarkPatch } from "@isocan/core";
import { ANSWERERS, KEEP_BY_PROP, KEEP_PROP, WIRE_FIDELITY, WIRE_MARKER, WIRE_SCRIPT_ID } from "../src/wire-format.ts";

/**
 * **The reader and the writer spell the stored format the same way.**
 *
 * Judge reads what the wireframe module writes, and may not import it (the
 * removability guard in `test/modules.test.ts`), so `wire-format.ts` spells
 * the format out by value. This reads the writer's SOURCE — as text, not as
 * an import — and fails the day a name moves on one side only: a renamed
 * property would otherwise leave the corpus silently empty, which reads
 * exactly like a person who has kept nothing yet.
 *
 * It also holds the one assumption the fold rests on that is not a name: a
 * flow's op group IS its `flow` id, so "this act was the flow's own" can be
 * read off the log. A composer that grouped its ops some other way would
 * make every flow write look like the person's.
 *
 * Only while the writer is in this build: delete the wireframe module and
 * there is nothing to drift from, and no corpus either.
 */
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const writer = path.join(repo, "packages/modules/wireframe/src");
const source = (file: string) => readFileSync(path.join(writer, file), "utf8");
const present = existsSync(writer);

describe("the stored format, against its writer", () => {
  it("marks a wire and embeds its spec the way the renderer does", () => {
    if (!present) return;
    const render = source("render.ts");
    expect(render).toContain(`export const WIRE_MARKER = ${JSON.stringify(WIRE_MARKER)};`);
    expect(render).toContain(`export const WIRE_SCRIPT_ID = ${JSON.stringify(WIRE_SCRIPT_ID)};`);
    expect(render).toContain('<script type="application/json" id="${WIRE_SCRIPT_ID}">${specJson(spec)}</script>');
  });

  it("names the keep mark, and who put it on, as the module does", () => {
    if (!present) return;
    expect(source("record.ts")).toContain(`export const KEEP_PROP = ${JSON.stringify(KEEP_PROP)};`);
    expect(source("keep.ts")).toContain("export const KEEP_BY_PROP = `${KEEP_PROP}By`;");
    // …and core's patch is what writes the `By` beside it.
    expect(moduleMarkPatch(KEEP_PROP, true, "act_acme")).toEqual({ properties: { [KEEP_PROP]: "yes", [KEEP_BY_PROP]: "act_acme" } });
    expect(moduleMarkPatch(KEEP_PROP, false)).toEqual({ removeProperties: [KEEP_PROP, KEEP_BY_PROP] });
  });

  it("knows every answerer a spec or a flow's own keep can name", () => {
    if (!present) return;
    const union = /answerer: ("[a-z]+"(?: \| "[a-z]+")*);/.exec(source("spec.ts"))?.[1];
    expect(union?.split(" | ").map((s) => JSON.parse(s) as string)).toEqual([...ANSWERERS]);
    const auto = /AUTO_KEEPERS: readonly string\[\] = (\[[^\]]*\])/.exec(source("keep.ts"))?.[1];
    for (const name of JSON.parse(auto ?? "null") as string[]) expect(ANSWERERS).toContain(name);
  });

  it("reads the spec fields the composer writes", () => {
    if (!present) return;
    const spec = source("spec.ts");
    for (const field of ["request: string;", "flow: string;", "archetype: string;", "title: string;", "need?: number;", "maybe?: true;", "variantOf?: string;", "by?: WireBy;"]) {
      expect(spec, field).toContain(`  ${field}`);
    }
    expect(source("flow.ts")).toContain(`[FIDELITY_PROP]: ${JSON.stringify(WIRE_FIDELITY)}`);
  });

  it("can tell the flow's own acts from the person's: a flow's op group is its flow id", () => {
    if (!present) return;
    const flow = source("flow.ts");
    expect(flow).toMatch(/const flow = newGroupId\(\);\s+const canvas = new FlowCanvas\(port, flow\);/);
    expect(flow).toContain("return this.port.send(op, this.group);");
    // The flow's picks ride that group too, signed with the answerer.
    expect(flow).toMatch(/keepPatch\(true, answerer\) \}, canvas\.group\)/);
    expect(source("compose-cli.ts")).toContain("new FlowCanvas(port, flow)");
  });
});
