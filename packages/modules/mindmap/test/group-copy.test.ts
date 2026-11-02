import { afterEach, expect, it } from "vitest";
import { groupCopyAction, groupCopySource, registerModule, unregisterModule } from "@isocan/core";
import { groupFixture } from "../../../api/test/group-fixture.ts";
import { mindmap, MAP_PARENT_PROP, MAP_PROP, mapEdges } from "../src/core.ts";

afterEach(() => unregisterModule(mindmap.name));
it("keeps a copied map's identity and internal edges inside the new group", async () => {
  registerModule(mindmap);
  const source = groupFixture(); source.card("parent", "Acme parent"); source.card("child", "Acme child", 600);
  source.apply({ type: "item.update", itemId: "parent", patch: { properties: { [MAP_PROP]: "map_acme" } } });
  source.apply({ type: "item.update", itemId: "child", patch: { properties: { [MAP_PROP]: "map_acme", [MAP_PARENT_PROP]: "parent" } } });
  const group = (await source.api.wrap(["parent", "child"], "Acme map")).itemId!;
  let next = 0;
  const action = groupCopyAction(groupCopySource(source.state.project.id, source.state.canvas, [group]), "prj_target", { newItemId: () => `itm_copy${++next}`, newVersionId: () => `ver_copy${++next}` });
  const target = groupFixture(true, "prj_target");
  await target.client.changeGroup(target.state.project.id, target.actor, action);
  const copied = Object.values(target.state.canvas.items);
  const parent = copied.find((item) => item.title === "Acme parent")!;
  const child = copied.find((item) => item.title === "Acme child")!;
  expect(child.properties[MAP_PARENT_PROP]).toBe(parent.id);
  expect(parent.properties[MAP_PROP]).not.toBe("map_acme");
  expect(child.properties[MAP_PROP]).toBe(parent.properties[MAP_PROP]);
  expect(mapEdges(target.state.canvas, parent.properties[MAP_PROP]!).map((edge) => [edge.from.id, edge.to.id])).toEqual([[parent.id, child.id]]);
  const alone = groupCopyAction(groupCopySource(source.state.project.id, source.state.canvas, ["child"]), "prj_target", { newItemId: () => `itm_alone${++next}`, newVersionId: () => `ver_alone${++next}` });
  expect(alone.items[0]!.properties?.[MAP_PARENT_PROP]).toBeUndefined();
});
