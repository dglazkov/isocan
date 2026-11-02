// Builds the harness's data from the recorded Jev flow the module's own tests replay
// (packages/modules/wireframe/test/fixtures/jev-acme-couriers.json): every screen kept,
// laid in one row as flow.ts lays them (GAP 80), plus one unkept variation under the list.
// Run from the repo root: npx tsx docs/research/flow-arrows/gen.mts
// Writes harness-data.js beside this file (generated; not committed).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const m = await import("../../../packages/modules/wireframe/src/core.ts");
const { inferLinks, screenEdges, decideFlow, flowRequest, flowScreen, readResponse, structureRequest, applyStructure, propsRequests, applyPropsRound, wireSize, renderWire, LINK_BACK } = m as any;
const fixture = JSON.parse(readFileSync(here("../../../packages/modules/wireframe/test/fixtures/jev-acme-couriers.json"), "utf8"));
const req1 = flowRequest(fixture.request);
const decision = decideFlow(req1, readResponse(req1, fixture.round1));
let specs = decision.archetypes.map((a: any) => flowScreen(a.id, fixture.request, "flw_acme", decision));
const titles = specs.map((s: any) => s.title);
specs = specs.map((spec: any, i: number) => { const req = structureRequest(spec, titles); return applyStructure(spec, req, readResponse(req, fixture.round2[i]!)); });
const reqs = propsRequests(specs);
specs = applyPropsRound(specs, reqs, reqs.map((req: any, i: number) => readResponse(req, fixture.round3[i]!)));
const screens = specs.map((spec: any, i: number) => ({ id: `s${i}_${spec.archetype}`, title: spec.title, spec }));
let x = 0;
const out: any[] = screens.map((s: any) => { const { width, height } = wireSize(s.spec); const r = { id: s.id, title: s.title, x, y: 0, w: width, h: height, html: renderWire(s.spec) }; x += width + 80; return r; });
const vs = wireSize(screens[3].spec);
out.push({ id: "v3", title: `${screens[3].title} · variation`, x: out[3].x, y: out[3].h + 80, w: vs.width, h: vs.height, html: renderWire(screens[3].spec), unkept: true });
const links = inferLinks(screens);
writeFileSync(here("./harness-data.js"), `window.DATA = ${JSON.stringify({ screens: out, links, edges: screenEdges(links), BACK: LINK_BACK })};`);
console.log(`${out.length} screens, ${links.length} links, ${screenEdges(links).length} pair-edges (what today's arrows draw)`);
