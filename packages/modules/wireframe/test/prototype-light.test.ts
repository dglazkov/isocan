import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FIDELITY_PROP, type CanvasContents, type Item } from "@isocan/core";
import { PrototypeLight } from "../src/prototype-light.tsx";
import { KEEP_PROP, PROTOTYPE_PROP, prototypeScreens, wireframe, type WireSpec } from "../src/core.ts";

/**
 * **A selected prototype lights the screens it plays** (24 Sep 2026). Held
 * here: the members are the prototype's flow's kept screens and a guest from
 * another flow, never an unkept sibling or another flow's screen; the light
 * draws only while exactly one prototype is selected; it writes nothing (it
 * is a component with no host). Synthetic: Acme's couriers.
 */

const a = { request: "Acme couriers", flow: "flw_a" };
const b = { request: "Acme returns", flow: "flw_b" };

function canvas() {
  const specs = new Map<string, WireSpec>();
  const items: Record<string, Item> = {};
  const put = (id: string, spec: WireSpec, x: number, props: Record<string, string> = {}) => {
    specs.set(`h_${id}`, spec);
    items[id] = {
      id, title: spec.title, x, y: 0, width: 390, height: 844,
      properties: { [FIDELITY_PROP]: "wireframe", ...props },
      currentVersionId: `v_${id}`, versions: [{ id: `v_${id}`, blobHash: `h_${id}`, mimeType: "text/html", filename: "s.html", size: 1 }],
    } as unknown as Item;
  };
  put("it_home", wireframe("home", a), 0, { [KEEP_PROP]: "yes" });
  put("it_list", wireframe("list", a), 500, { [KEEP_PROP]: "yes", "wireLink:main.3#row": "it_other" });
  put("it_list_v", { ...wireframe("list", a), variantOf: "it_list" }, 500);
  put("it_other", wireframe("detail", b), 3000, { [KEEP_PROP]: "yes" });
  put("it_b_home", wireframe("home", b), 3500, { [KEEP_PROP]: "yes" });
  items.it_proto = {
    id: "it_proto", title: "Prototype · Acme couriers", x: 0, y: -1400, width: 390, height: 844,
    properties: { [FIDELITY_PROP]: "wireframe", [PROTOTYPE_PROP]: "flw_a" },
    currentVersionId: "v_p", versions: [{ id: "v_p", blobHash: "h_p", mimeType: "text/html", filename: "prototype.html", size: 1 }],
  } as unknown as Item;
  const c = { items } as unknown as CanvasContents;
  const wires = [...specs].map(([hash, spec]) => ({ item: hash.slice(2), spec }));
  return { c, specs, wires };
}

describe("the screens a prototype plays", () => {
  it("are its flow's kept screens and a guest another flow lent it — no unkept sibling, no other flow's own", () => {
    const { c, wires } = canvas();
    expect(prototypeScreens(c, c.items.it_proto!, wires).map((i) => i.id)).toEqual(["it_home", "it_list", "it_other"]);
    expect(prototypeScreens(c, c.items.it_home!, wires)).toEqual([]);
  });
});

describe("PrototypeLight", () => {
  const draw = (selection: string[]) => {
    const { c, specs } = canvas();
    return renderToStaticMarkup(createElement(PrototypeLight, { canvas: c, selection, drag: null, specOf: (h: string) => specs.get(h) }));
  };

  it("rings every member and veils the rest while one prototype is selected", () => {
    const html = draw(["it_proto"]);
    expect(html).toContain('data-wire-light="it_proto"');
    const rings = [...html.matchAll(/data-member="([^"]+)"/g)].map((m) => m[1]);
    expect(rings).toEqual(["it_home", "it_list", "it_other"]);
    expect(html).toContain("wire-light-veil");
    // Holes: the veil's outer edge, then one per member and one for the prototype.
    const d = /class="wire-light-veil" d="([^"]+)"/.exec(html)![1]!;
    expect(d.match(/M /g)).toHaveLength(5);
  });

  it("draws nothing for a screen, for two things at once, or for nothing selected", () => {
    expect(draw(["it_home"])).toBe("");
    expect(draw(["it_proto", "it_home"])).toBe("");
    expect(draw([])).toBe("");
  });
});
