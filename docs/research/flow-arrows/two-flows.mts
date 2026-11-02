// Two kept flows on one canvas: do the canvas arrows agree with `wire links` and the prototype?
// Run from the repo root: npx tsx docs/research/flow-arrows/two-flows.mts
// 23 Sep 2026 at bfb1e65a it printed an arrow b_signin -> a_home that neither flow's links contain.
const m: any = await import("../../../packages/modules/wireframe/src/core.ts");
const { keptArrows } = await import("../../../packages/modules/wireframe/src/arrows.tsx");
const { wireframe, renderWire, readWire, KEEP_PROP, keptFlowsOf, inferLinks, screenEdges } = m;
const a = { request: "Acme couriers", flow: "flw_a" };
const b = { request: "Test recipes", flow: "flw_b" };
const specs: Record<string, any> = { a_signin: wireframe("sign-in", a), a_home: wireframe("home", a), b_signin: wireframe("sign-in", b) };
// Flow B's sign in in a row above flow A's sign in and home; all three kept.
const place: Record<string, [number, number]> = { b_signin: [0, 0], a_signin: [0, 1200], a_home: [470, 1200] };
const blobs = new Map<string, string>();
const items: Record<string, any> = {};
for (const [id, [x, y]] of Object.entries(place)) {
  const hash = `h-${id}`;
  blobs.set(hash, renderWire(specs[id]));
  items[id] = { id, title: specs[id].title, x, y, width: 390, height: 876, properties: { fidelity: "wireframe", [KEEP_PROP]: "yes" }, currentVersionId: `v-${id}`, versions: [{ id: `v-${id}`, blobHash: hash, mimeType: "text/html" }] };
}
const canvas = { items } as any;
const read = (h: string) => (blobs.has(h) ? readWire(blobs.get(h)!) : undefined);
console.log("canvas arrows:", JSON.stringify(keptArrows(canvas, read)));
for (const f of keptFlowsOf(canvas, Object.keys(place).map((id) => ({ item: id, spec: specs[id] })))) {
  console.log("prototype/wire links for", f.flow, JSON.stringify(screenEdges(inferLinks(f.screens))));
}
