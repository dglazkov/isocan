// The "links, counted" table: what inferLinks says about the two synthetic flows the module's tests use,
// and what today's screenEdges collapses them to.
// Run from the repo root: npx tsx docs/research/flow-arrows/counts.mts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const m: any = await import("../../../packages/modules/wireframe/src/core.ts");
const { wireframe, inferLinks, screenEdges, decideFlow, flowRequest, flowScreen, readResponse, structureRequest, applyStructure, propsRequests, applyPropsRound, wireSize, LINK_BACK } = m;
type S = { id: string; title: string; spec: any };
function report(name: string, kept: S[]) {
  const links = inferLinks(kept);
  const edges = screenEdges(links);
  const toScreen = links.filter((l: any) => l.to && l.to !== LINK_BACK && l.to !== l.from);
  const pairs = new Set(edges.map((e: any) => `${e.from}>${e.to}`));
  let x = 0; const box: Record<string, any> = {};
  for (const s of kept) { const { width, height } = wireSize(s.spec); box[s.id] = { x, w: width, h: height }; x += width + 80; }
  const jumps = edges.filter((e: any) => { const a = box[e.from], b = box[e.to]; return Math.abs(b.x + b.w / 2 - (a.x + a.w / 2)) > (a.w + b.w) / 2 + 200; });
  const per: Record<string, string[]> = {};
  for (const l of toScreen) (per[`${l.from}>${l.to}`] ??= []).push(`${l.label} (${l.rule}, ${l.transition})`);
  console.log(`\n${name}`);
  console.log(`  links ${links.length} · to a kept screen ${toScreen.length} · back ${links.filter((l: any) => l.to === LINK_BACK).length} · missing ${links.filter((l: any) => l.to === null).length}`);
  console.log(`  arrows drawn today ${edges.length} · both-ways pairs ${edges.filter((e: any) => pairs.has(`${e.to}>${e.from}`)).length / 2} · jumps ${jumps.length}`);
  for (const [k, v] of Object.entries(per)) console.log(`  ${k.padEnd(28)} ${v.join(" + ")}${pairs.has(k.split(">").reverse().join(">")) ? "   [both ways]" : ""}`);
}
const o = { request: "Acme couriers", flow: "flw_acme" };
const sc = (id: string, spec: any): S => ({ id, title: spec.title, spec });
report("4-screen fixture (links.test.ts)", [sc("signin", wireframe("sign-in", o)), sc("home", wireframe("home", o)), sc("list", wireframe("list", o)), sc("detail", wireframe("detail", o))]);
const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("../../../packages/modules/wireframe/test/fixtures/jev-acme-couriers.json", import.meta.url)), "utf8"));
const req1 = flowRequest(fixture.request);
const decision = decideFlow(req1, readResponse(req1, fixture.round1));
let specs = decision.archetypes.map((a: any) => flowScreen(a.id, fixture.request, "flw_acme", decision));
const titles = specs.map((s: any) => s.title);
specs = specs.map((spec: any, i: number) => { const req = structureRequest(spec, titles); return applyStructure(spec, req, readResponse(req, fixture.round2[i]!)); });
const reqs = propsRequests(specs);
specs = applyPropsRound(specs, reqs, reqs.map((req: any, i: number) => readResponse(req, fixture.round3[i]!)));
report("Jev flow (jev-acme-couriers.json), all 7 kept", specs.map((spec: any, i: number) => sc(`s${i}_${spec.archetype}`, spec)));
