import { describe, expect, it } from "vitest";
import { transcriptOperation } from "../src/core.ts";
import { groupFixture } from "../../../api/test/group-fixture.ts";

describe("sandbox output membership", () => {
  it("creates in the program group atomically, then preserves an independently moved transcript's parent", async () => {
    const f = groupFixture(); f.card("program", "Acme program");
    const source = (await f.api.wrap(["program"], "Acme work")).itemId!;
    const output = (await f.api.new("Acme results", { at: { x: 2000, y: 0 } })).itemId!;
    const version = { id: "out_v1", blobHash: "out_hash", mimeType: "text/plain", filename: "output.txt", size: 4 };
    const count = f.writes.length;
    const creation = transcriptOperation(f.state.canvas.items.program!, null, version, "transcript", true);
    await f.client.sendOp(f.state.project.id, f.actor, creation);
    expect(f.writes).toHaveLength(count + 1);
    expect(f.state.canvas.items.transcript).toMatchObject({ containerId: source, properties: { "sandbox.of": "program" } });
    await f.api.add(output, ["transcript"], { place: true });
    const afterMove = f.state.canvas.items.transcript!;
    const update = transcriptOperation(f.state.canvas.items.program!, afterMove, { ...version, id: "out_v2" }, "unused", true);
    expect(update.type).toBe("item.addVersion");
    await f.client.sendOp(f.state.project.id, f.actor, update);
    expect(f.state.canvas.items.transcript).toMatchObject({ containerId: output, x: afterMove.x, y: afterMove.y });
    expect(f.state.canvas.items.transcript!.versions).toHaveLength(2);
    f.undo();
    expect(f.state.canvas.items.transcript!.containerId).toBe(output);
    expect(f.state.canvas.items.transcript!.versions).toHaveLength(1);
  });
});
