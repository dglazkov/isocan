import { afterEach, expect, it } from "vitest";
import { groupCopyAction, groupCopySource, registerModule, unregisterModule } from "@isocan/core";
import { groupFixture } from "../../../api/test/group-fixture.ts";
import { sandboxModule, SANDBOX_OF_PROP, SANDBOX_RUN_PROP, transcriptFor } from "../src/core.ts";

afterEach(() => unregisterModule(sandboxModule.name));
it("remaps a copied transcript to its copied program and drops a foreign program when copied alone", async () => {
  registerModule(sandboxModule);
  const source = groupFixture(); source.card("program", "Acme program"); source.card("output", "Acme output", 600);
  source.apply({ type: "item.update", itemId: "program", patch: { properties: { [SANDBOX_RUN_PROP]: "node acme.mjs" } } });
  source.apply({ type: "item.update", itemId: "output", patch: { properties: { [SANDBOX_OF_PROP]: "program" } } });
  const group = (await source.api.wrap(["program", "output"], "Acme work")).itemId!;
  let next = 0;
  const action = groupCopyAction(groupCopySource(source.state.project.id, source.state.canvas, [group]), "prj_target", { newItemId: () => `itm_copy${++next}`, newVersionId: () => `ver_copy${++next}` });
  const target = groupFixture(true, "prj_target");
  await target.client.changeGroup(target.state.project.id, target.actor, action);
  const copied = Object.values(target.state.canvas.items);
  const program = copied.find((item) => item.title === "Acme program")!;
  const output = copied.find((item) => item.title === "Acme output")!;
  expect(output.properties[SANDBOX_OF_PROP]).toBe(program.id);
  expect(transcriptFor(target.state.canvas, program.id)?.id).toBe(output.id);
  const alone = groupCopyAction(groupCopySource(source.state.project.id, source.state.canvas, ["output"]), "prj_target", { newItemId: () => `itm_alone${++next}`, newVersionId: () => `ver_alone${++next}` });
  expect(alone.items).toHaveLength(1);
  expect(alone.items[0]!.properties?.[SANDBOX_OF_PROP]).toBeUndefined();
});
