import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { CanvasContents, Item, Operation } from "@isocan/core";
import wireframeWeb from "../../modules/wireframe/src/web.tsx";
import { readWire } from "../../modules/wireframe/src/render.ts";
import { specs } from "../../modules/wireframe/src/spec-cache.ts";
import { PROTOTYPE_PROP } from "../../modules/wireframe/src/prototype.ts";
import { harness, type FakeItem } from "../../modules/wireframe/test/cli-harness.ts";
import { landFlowVoice, previewFlowVoice, writeFlowVoices } from "../src/lib/flowvoice.ts";
import { itemMenu } from "../src/lib/menuentries.tsx";
import { modules } from "../src/modules.ts";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import type { MenuAction, MenuEntry } from "../src/components/ContextMenu.tsx";

/**
 * **Choose a voice… — the web's door to `isocan wire voice`** (copy-edit
 * phase 5). A flow built the CLI's way on a canvas held in memory
 * (`cli-harness.ts`); the row is offered on a screen of the fleshed flow and
 * on its prototype, never before flesh; the voices are the CLI's
 * placeholders, said once; and applying one sends ONE group — a version per
 * screen it touches plus the prototype rebuilt — whose files are byte for
 * byte what `wire voice --from <file> --pick 2` lands for the same voices on
 * the same canvas.
 */

const acme = { id: "usr_acme", name: "Acme" };
const REQUEST = "a delivery app for Acme couriers — sign in, see today's parcels, open one";
const labels = (entries: MenuEntry[]) => entries.filter((e): e is MenuAction => !("separator" in e)).map((a) => a.label);

// The shell holds the wireframe module's activation record until its web half is fetched; a canvas with wires
// fetches it before anyone can right-click, so the test hands the record the half it would have fetched.
Object.assign(modules().find((m) => m.core.name === wireframeWeb.core.name)!, { copy: wireframeWeb.copy, menu: wireframeWeb.menu });

describe("Choose a voice… — the web's door to wire voice", () => {
  it("is offered on a fleshed flow's screens and prototype; one voice lands as one group, byte for byte the CLI's pick", async () => {
    const h = harness();
    const canvasOf = (): CanvasContents => ({ items: Object.fromEntries([...h.items].map(([k, v]) => [k, structuredClone(v)])), threads: {}, connectors: {} }) as unknown as CanvasContents;
    /** The shell's view of the canvas, and the specs its underlays would have read. */
    const show = () => {
      const canvas = canvasOf();
      for (const item of Object.values(canvas.items)) {
        const v = item.versions.find((x) => x.id === item.currentVersionId);
        if (v && item.properties.fidelity === "wireframe") specs.set(v.blobHash, readWire(h.blobs.get(v.blobHash)!));
      }
      useCanvasStore.setState({ canvasId: "canvas-acme", canvas, notice: null });
      return canvas;
    };
    const ctx = { canvasId: "canvas-acme", actor: acme, world: { x: 0, y: 0 }, navigate: () => {} };
    const menuOn = (id: string) => labels(itemMenu([useCanvasStore.getState().canvas!.items[id]! as Item], ctx));

    await h.cli("wire", REQUEST, "--answerer", "stub", "--seed", "4", "--basic");
    const screens = h.wires().filter((w) => !h.specOf(w.id).variantOf);
    show();
    expect(menuOn(screens[0]!.id)).not.toContain("Choose a voice…"); // bars: nothing to voice yet
    await h.cli("wire", "flesh", "--pack", "deliveries");
    await h.cli("wire", "keep", screens[0]!.id, screens[1]!.id);
    await h.cli("wire", "prototype");
    expect(h.errors).toEqual([]);
    const proto = [...h.items.values()].find((i) => i.properties[PROTOTYPE_PROP])!;
    show();
    expect(menuOn(screens[0]!.id)).toContain("Choose a voice…");
    expect(menuOn(proto.id)).toContain("Choose a voice…");

    // The web's host over the same canvas: what it sends is applied, as the daemon's echo would.
    const sent: Array<{ ops: Operation[]; group?: string }> = [];
    const host = {
      getCanvas: canvasOf,
      readText: async (hash: string) => h.blobs.get(hash)!,
      putBlob: async (blob: Blob) => {
        const text = await blob.text();
        return { blobHash: h.blob(text), size: text.length };
      },
      send: async (ops: readonly Operation[], group?: string) => {
        sent.push({ ops: [...ops], ...(group ? { group } : {}) });
        for (const op of ops) h.apply(op);
      },
    };

    // No text model at the home: the CLI's placeholder voices, asked once, said once.
    let asked = 0;
    const generate = async () => {
      asked++;
      throw Object.assign(new Error("this home has no text model"), { code: "text-unavailable" });
    };
    const voices = await writeFlowVoices("canvas-acme", acme, proto.id, { n: 3 }, { generate, host });
    expect(asked).toBe(1);
    expect(voices).toMatchObject({ by: "placeholder words", placeholder: true });
    expect(voices.voices.map((v) => v.stance)).toEqual(["Placeholder A", "Placeholder B", "Placeholder C"]);
    expect(voices.screens.length).toBeGreaterThan(1);
    expect(useCanvasStore.getState().notice).toContain("placeholder words, not written copy");
    for (const e of voices.voices[1]!.edits) expect(e.address).toMatch(/^itm_\S+::/);
    expect(sent).toHaveLength(0);

    // The preview: the first two screens, now and in the voice, nothing sent.
    const preview = await previewFlowVoice(voices, voices.voices[1]!);
    expect(preview.map((p) => p.itemId)).toEqual(voices.screens.slice(0, 2).map((s) => s.itemId));
    expect(preview.some((p) => p.after.includes("Placeholder") && p.after !== p.before)).toBe(true);
    expect(sent).toHaveLength(0);

    // Use voice 2: ONE group — a version per screen it touches, and the prototype rebuilt.
    const before = new Map([...h.items].map(([k, v]) => [k, structuredClone(v)] as const));
    const done = await landFlowVoice("canvas-acme", acme, screens[0]!.id, voices, voices.voices[1]!, { host });
    expect(sent).toHaveLength(sent.filter((s) => s.group === done.group).length);
    const web = sent.flatMap((s) => s.ops);
    expect(new Set(sent.map((s) => s.group)).size).toBe(1);
    const touched = new Set(voices.voices[1]!.edits.map((e) => e.address.split("::")[0]!));
    const versioned = web.filter((op) => op.type === "item.addVersion").map((op) => (op as { itemId: string }).itemId);
    for (const id of touched) expect(versioned).toContain(id);
    expect(versioned).toContain(proto.id);
    expect(done.prototypes).toBe(1);
    const filesOf = (ops: Operation[]) =>
      ops.map((op) => (op.type === "item.addVersion" ? { type: op.type, itemId: op.itemId, file: h.blobs.get(op.version.blobHash) } : { type: op.type, itemId: (op as { itemId?: string }).itemId }));
    const webFiles = filesOf(web);

    // The same canvas again, and the CLI's pick of the same voices from a file: the same files, one group.
    h.items.clear();
    for (const [k, v] of before) h.items.set(k, v as FakeItem);
    const file = `${tmpdir()}/acme-voices-${Date.now()}.json`;
    await writeFile(file, JSON.stringify({ flow: voices.flow, by: voices.by, placeholder: true, variants: voices.voices }));
    const n = h.sent.length;
    await h.cli("wire", "voice", "--from", file, "--pick", "2");
    expect(h.errors).toEqual([]);
    const cli = h.sent.slice(n);
    expect(new Set(cli.map((o) => o.group)).size).toBe(1);
    expect(filesOf(cli.map((o) => o.op))).toEqual(webFiles);
    expect(JSON.parse(await readFile(file, "utf8")).variants).toHaveLength(3);
  });
});
