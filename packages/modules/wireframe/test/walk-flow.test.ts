import { describe, expect, it } from "vitest";
import type { Item } from "@isocan/core";
import { flowReach } from "@isocan/core/walk";
import { PROTOTYPE_MARKER, assemblePrototype, inferLinks, screenEdges, wireframe, type WireScreen } from "../src/core.ts";
import { prototypeWalkFlow } from "../src/walk-flow.ts";

/**
 * **A walk follows a prototype's links** (proactive-agent phase 9, design
 * §11). The module reads the table `assemblePrototype` embeds and hands core
 * the graph; core walks it from where it opens. Synthetic: Acme's courier
 * app — sign in, home, a list of deliveries, one delivery.
 */
const o = { request: "Acme couriers", flow: "flw_acme" };
const screen = (id: string, spec: ReturnType<typeof wireframe>, title = spec.title): WireScreen => ({ id, title, spec });
const item = { id: "itm_proto", title: "Prototype" } as Item;

describe("prototypeWalkFlow", () => {
  it("reads the prototype's start, screens and links, and core walks them link by link", () => {
    const kept = [screen("it_signin", wireframe("sign-in", o)), screen("it_home", wireframe("home", o)), screen("it_list", wireframe("list", o)), screen("it_detail", wireframe("detail", o))];
    const links = inferLinks(kept);
    const graph = prototypeWalkFlow(item, assemblePrototype(kept, links))!;
    expect(graph.start).toBe("it_signin");
    expect(graph.screens).toEqual(["it_signin", "it_home", "it_list", "it_detail"]);
    expect(graph.links.map((l) => `${l.from}>${l.to}`)).toEqual(expect.arrayContaining(screenEdges(links).map((e) => `${e.from}>${e.to}`)));
    expect(flowReach(graph).screens[0]).toBe("it_signin");
    expect(flowReach(graph).screens).toEqual(expect.arrayContaining(["it_home"]));
  });

  it("is null for a screen that is not a prototype, and its marker is the prototype's own", () => {
    expect(prototypeWalkFlow(item, "<!doctype html><body><h1>Home</h1></body>")).toBeNull();
    expect(prototypeWalkFlow(item, `${PROTOTYPE_MARKER}<script type="application/json" id="isocan-prototype">not json</script>`)).toBeNull();
    expect(prototypeWalkFlow(item, `${PROTOTYPE_MARKER}<script type="application/json" id="isocan-prototype">{"start":"a","screens":[{"id":"a"}],"links":[]}</script>`)).toEqual({ start: "a", screens: ["a"], links: [] });
  });
});
